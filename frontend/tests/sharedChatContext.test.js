import '@testing-library/jest-dom';
import {
  buildUploadedDocsContext,
  clearSharedContext,
  readSharedContext,
  saveSharedAnalysis,
  SHARED_CONTEXT_LIMITS,
} from '../components/chat/sharedChatContext';

describe('sharedChatContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('stores bounded analyzed document context and replaces duplicate names', () => {
    expect(saveSharedAnalysis({ name: 'plan.md', content: 'first result' })).toBe(true);
    expect(saveSharedAnalysis({ name: 'plan.md', content: 'updated result' })).toBe(true);

    const items = readSharedContext();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('plan.md');
    expect(items[0].content).toBe('updated result');
  });

  test('caps items and per-item/total context size', () => {
    for (let i = 0; i < SHARED_CONTEXT_LIMITS.maxItems + 5; i += 1) {
      saveSharedAnalysis({
        name: `file-${i}.txt`,
        content: 'x'.repeat(SHARED_CONTEXT_LIMITS.maxItemChars + 100),
      });
    }

    const items = readSharedContext();
    expect(items.length).toBeLessThanOrEqual(SHARED_CONTEXT_LIMITS.maxItems);
    expect(items.every((item) => item.content.length <= SHARED_CONTEXT_LIMITS.maxItemChars)).toBe(true);
    const total = items.reduce((sum, item) => sum + item.content.length, 0);
    expect(total).toBeLessThanOrEqual(SHARED_CONTEXT_LIMITS.maxTotalChars);
  });

  test('returns backend-ready uploadedDocs and can clear the cache', () => {
    saveSharedAnalysis({ name: 'a.txt', content: 'alpha', mime: 'text/plain' });
    saveSharedAnalysis({ name: 'b.md', content: 'beta', mime: 'text/markdown' });

    expect(buildUploadedDocsContext()).toEqual([
      { name: 'b.md', content: 'beta', mime: 'text/markdown' },
      { name: 'a.txt', content: 'alpha', mime: 'text/plain' },
    ]);

    clearSharedContext();
    expect(readSharedContext()).toEqual([]);
  });
});
