import fs from 'fs';
import path from 'path';
import { renderHook, act } from '@testing-library/react';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// SmartChatHeader drags in @google/genai (ESM-only, untransformable in jest).
jest.mock('../components/chat/SmartChatHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../hooks/useChatStream', () => ({
  streamChatResponse: jest.fn(() => Promise.resolve()),
}));

import api from '../services/api';
import { streamChatResponse } from '../hooks/useChatStream';
import { useChatView } from '../hooks/useChatView';
import { isImageCreateRequest, extractImageSubject } from '../lib/imageIntent';

const REPORTED = 'ek cat ka images banao';

const MATCH = [
  REPORTED,
  'cat ki images banao',
  'images banao',
  'meri photos banao',
  'pictures banao',
  'logos banao',
  'ek cat ka images bana do',
  'cat ka images banado',
  'ek cat ka image banado',
  'sunset over bihar ki image banao',
  'ek achha sa cat picture banao',
  'youtube thumbnail banao',
  'logo banao',
  'cat ki drawing banao',
  'ek wallpaper banao',
  'meme banao',
  'please ek cat ka photo bana do',
  'ek cartoon banao',
  'taasveer banao',
];

const NO_MATCH = [
  // Product decision: an image noun is REQUIRED. Bare subject+"banao" stays LLM.
  'cat banao',
  'ek cute cat banao',
  'cat banado',
  'ek cat banake dikhao',
  // Explicit code asks must never auto-render.
  'image ka python code do',
  'pillow se image banane ka code likho',
  // Explanations, not render requests.
  'image generate karna kaise hai',
  'how to generate images',
  // Non-static pipelines.
  '3d cat animation banao',
  'three.js animation banao',
  // Other intents.
  'pdf banao',
  'ppt banao',
  'todo app banao',
  'react component banao',
  'meri images dikhao',
  'image gallery kholo',
  // The complaint message itself must not loop into another render.
  'maine tumse image banane ko kaha to tum copilot ki tarah behave kyo karne lage?',
  '',
];

describe('isImageCreateRequest — Hinglish/plural intent battery', () => {
  it.each(MATCH)('matches: %s', (phrase) => {
    expect(isImageCreateRequest(phrase)).toBe(true);
  });

  it.each(NO_MATCH)('does not match: %s', (phrase) => {
    expect(isImageCreateRequest(phrase)).toBe(false);
  });

  it('covers the exact reported failure (plural "images")', () => {
    // The old regex used \bimage\b which CANNOT match "images" (no word
    // boundary before the "s"), so this request fell through to the LLM and
    // came back as a Python/Pillow plan instead of a picture.
    expect(/\bimage\b/.test('images')).toBe(false);
    expect(isImageCreateRequest(REPORTED)).toBe(true);
  });

  it('is consistent between the frontend (ESM) and backend (CJS) twins', () => {
    const pick = (file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => /^\s*const (IMAGE_NOUN|MAKE_VERB|CODE_ASK|NON_STATIC|HOW_TO|SUBJECT_STOP) =/.test(l))
        .map((l) => l.trim());
    const front = pick(path.resolve(__dirname, '../lib/imageIntent.js'));
    const back = pick(path.resolve(__dirname, '../../backend/services/imageIntent.js'));
    expect(front.length).toBe(6);
    expect(back).toEqual(front);
  });
});

describe('extractImageSubject — prompt handed to the image model', () => {
  it.each([
    ['ek cat ka images banao', 'cat'],
    ['sunset over bihar ki image banao', 'sunset over bihar'],
    ['picture of a cat', 'cat'],
    ['ek achha sa dog cartoon bana do', 'achha sa dog'],
  ])('%s -> %s', (input, expected) => {
    expect(extractImageSubject(input)).toBe(expected);
  });

  it('falls back to the original text when nothing survives stripping', () => {
    expect(extractImageSubject('meri photos banao')).toBe('meri photos banao');
    expect(extractImageSubject('')).toBe('');
  });
});

describe('useChatView — image asks go to /image/turbo, never the LLM', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders via /image/turbo with a cleaned subject', async () => {
    api.post.mockResolvedValue({ data: { imageUrl: 'https://image.pollinations.ai/prompt/cat' } });
    const { result } = renderHook(() => useChatView({ model: 'auto' }));

    await act(async () => {
      await result.current.sendMessage(REPORTED);
    });

    expect(api.post).toHaveBeenCalledWith('/image/turbo', { prompt: 'cat', style: 'general' });
    expect(streamChatResponse).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalledWith('/chat', expect.anything());
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.content).toContain('https://image.pollinations.ai/prompt/cat');
    expect(result.current.thinking).toBe(false);
  });

  // Regression: `catch (_) {}` used to swallow the failure and fall through to
  // the plain LLM, which answered with a Plan/Assumptions Python plan.
  it('shows an explicit failure bubble instead of falling through to the LLM', async () => {
    api.post.mockRejectedValue(new Error('render service down'));
    const { result } = renderHook(() => useChatView({ model: 'auto' }));

    await act(async () => {
      await result.current.sendMessage(REPORTED);
    });

    expect(api.post).toHaveBeenCalledTimes(2); // one automatic retry
    expect(streamChatResponse).not.toHaveBeenCalled();
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.content).toContain('Image generate nahi ho payi');
    expect(result.current.thinking).toBe(false);
  });

  it('leaves non-image phrasing on the normal LLM path (image noun required)', async () => {
    api.post.mockResolvedValue({ data: {} });
    streamChatResponse.mockResolvedValue(undefined);
    const { result } = renderHook(() => useChatView({ model: 'auto' }));

    await act(async () => {
      await result.current.sendMessage('cat banao');
    });

    expect(api.post).not.toHaveBeenCalledWith('/image/turbo', expect.anything());
    expect(streamChatResponse).toHaveBeenCalledTimes(1);
  });
});
