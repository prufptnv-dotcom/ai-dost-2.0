/**
 * Devin-style @file mention helpers for the Copilot IDE composer.
 * Kept pure (no React) so unit tests can cover the exact contracts:
 *  - workspace entries may be plain path strings or { path, content }
 *  - the active query is the "@token" immediately before the caret
 *  - parsed mention paths reject traversal and are capped
 */

// Workspace entries may be plain path strings or { path, content } objects.
export const filePathOf = (f) => (typeof f === 'string' ? f : (f && f.path) || '');

// Active "@query" token right before the caret (start-of-text or after a space).
export const detectMention = (value, caret) => {
  const m = String(value || '').slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
  return m ? m[1] : null;
};

// Extract unique "@path" mentions from a prompt (traversal rejected, cap 20).
export const parseMentionPaths = (text) => [...new Set(
  Array.from(String(text || '').matchAll(/@([\w./-]+)/g), (m) => m[1])
)].filter(p => p && !p.includes('..')).slice(0, 20);
