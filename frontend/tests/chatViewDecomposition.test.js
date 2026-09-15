import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('ChatView decomposition', () => {
  const source = readFileSync(
    path.join(__dirname, '../components/views/ChatView.jsx'),
    'utf8'
  );

  it('uses extracted message and thinking components', () => {
    expect(source).toContain("import ChatMessageBubble from '../chat/ChatMessageBubble';");
    expect(source).toContain("import ThinkingDot from '../chat/ThinkingDot';");
    expect(source).toContain('<ChatMessageBubble');
    expect(source).not.toContain('function MessageBubble(');
    expect(source).not.toContain('function ThinkingDot(');
    expect(source).not.toContain('function ParsedMarkdown(');
  });

  it('uses shared chat content helpers instead of inline parser implementations', () => {
    expect(source).toContain("from '../../utils/chatContent'");
    expect(source).not.toContain('export const stripInternalTags');
    expect(source).not.toContain('function extractArtifact(');
    expect(source).not.toContain('const extractImages =');
    expect(source).not.toContain('const renderMarkdown =');
  });
});
