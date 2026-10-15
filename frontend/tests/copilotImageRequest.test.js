import fs from 'fs';
import path from 'path';

import { runCopilotImageRequest } from '../lib/copilotImageRequest';
import { isImageCreateRequest } from '../lib/imageIntent';

const REPORTED = 'ek cat ka images banao';
const COPILOT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

function makeHarness() {
  const messages = [];
  const statuses = [];
  return {
    messages,
    statuses,
    pushMessage: (m) => messages.push(m),
    setStatus: (s) => statuses.push(s),
  };
}

describe('runCopilotImageRequest — image asks never reach the planner', () => {
  it('calls /image/turbo with a cleaned subject and posts an image bubble', async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { imageUrl: 'https://img/cat.png' } }) };
    const h = makeHarness();

    const result = await runCopilotImageRequest({ prompt: REPORTED, api, ...h });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/image/turbo', { prompt: 'cat', style: 'general' });
    expect(result).toEqual({ ok: true, url: 'https://img/cat.png' });
    expect(h.messages[0]).toEqual({ role: 'user', content: REPORTED });
    expect(h.messages[1].role).toBe('assistant');
    expect(h.messages[1].content).toContain('https://img/cat.png');
    expect(h.statuses.at(-1)).toEqual({ label: 'Image rendered', tone: 'success' });
  });

  it('reports an explicit failure instead of falling back to plan/code generation', async () => {
    const api = { post: jest.fn().mockRejectedValue(new Error('render service down')) };
    const h = makeHarness();

    const result = await runCopilotImageRequest({ prompt: REPORTED, api, ...h });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('render service down');
    expect(h.messages.at(-1).content).toContain('Image generate nahi ho payi');
    expect(h.statuses.at(-1)).toEqual({ label: 'Image failed', tone: 'error' });
  });

  it('treats a 200 without imageUrl as a failure (no silent success)', async () => {
    const api = { post: jest.fn().mockResolvedValue({ data: { error: 'quota exhausted' } }) };
    const h = makeHarness();

    const result = await runCopilotImageRequest({ prompt: REPORTED, api, ...h });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('quota exhausted');
    expect(h.messages.at(-1).content).toContain('quota exhausted');
  });
});

describe('CopilotIDE wiring (static)', () => {
  it('gates on isImageCreateRequest so the reported phrase short-circuits', () => {
    expect(isImageCreateRequest(REPORTED)).toBe(true);
    expect(COPILOT_SRC).toMatch(
      /pastedImages\.length === 0 && isImageCreateRequest\(rawPrompt\)/
    );
  });

  // Ordering regression: if the short-circuit ever moves after the planner
  // call, "ek cat ka images banao" turns back into a file-writing plan.
  it('short-circuits BEFORE the /agent/plan planner call', () => {
    const shortCircuitAt = COPILOT_SRC.indexOf('runCopilotImageRequest({');
    const planAt = COPILOT_SRC.indexOf("api.post('/agent/plan'");
    expect(shortCircuitAt).toBeGreaterThan(-1);
    expect(planAt).toBeGreaterThan(-1);
    expect(shortCircuitAt).toBeLessThan(planAt);
  });

  it('never sends an image-only prompt to the agent runner', () => {
    // Inside handleSend, the image branch must `return` before runCopilot.
    const branchAt = COPILOT_SRC.indexOf('isImageCreateRequest(rawPrompt)');
    const segment = COPILOT_SRC.slice(branchAt, branchAt + 700);
    expect(segment).toContain('await runCopilotImageRequest(');
    expect(segment).toMatch(/return;\s*\n\s*\}\s*\n/);
  });
});
