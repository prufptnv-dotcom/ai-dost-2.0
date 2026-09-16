import {
  PROCESSING_STATES,
  getProcessingAriaProps,
  getProcessingState,
  normalizeProcessingPhase,
} from '../components/chat/ChatProcessingState';

describe('ChatProcessingState', () => {
  test.each([
    ['queued', 'queued'],
    ['running', 'understanding'],
    ['executing', 'generating'],
    ['streaming', 'streaming'],
    ['complete', 'success'],
    ['completed', 'success'],
    ['cancelled', 'canceled'],
    ['failed', 'error'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeProcessingPhase(input)).toBe(expected);
  });

  test('explicit phase wins over legacy content-length heuristics', () => {
    expect(getProcessingState({ phase: 'planning', isStreaming: true, contentLength: 500 })).toBe(PROCESSING_STATES.PLANNING);
    expect(getProcessingState({ phase: 'streaming', isStreaming: true, contentLength: 2 })).toBe(PROCESSING_STATES.STREAMING);
    expect(getProcessingState({ phase: 'success', isStreaming: false })).toBe(PROCESSING_STATES.SUCCESS);
  });

  test('legacy callers still receive a safe fallback state', () => {
    expect(getProcessingState({ isStreaming: true, contentLength: 10 }).key).toBe('understanding');
    expect(getProcessingState({ isStreaming: true, contentLength: 600 }).key).toBe('streaming');
    expect(getProcessingState({ isStreaming: false, hasVerification: true }).key).toBe('verifying');
    expect(getProcessingState({ isStreaming: false }).key).toBe('idle');
  });

  test('error and cancel take precedence over phase', () => {
    expect(getProcessingState({ phase: 'success', hasError: true }).key).toBe('error');
    expect(getProcessingState({ phase: 'success', isCanceled: true }).key).toBe('canceled');
  });

  test('ARIA state exposes busy status only for active phases', () => {
    expect(getProcessingAriaProps(PROCESSING_STATES.GENERATING)).toEqual({
      'aria-busy': true,
      'aria-live': 'polite',
    });
    expect(getProcessingAriaProps(PROCESSING_STATES.SUCCESS)).toEqual({
      'aria-busy': false,
      'aria-live': 'off',
    });
  });
});
