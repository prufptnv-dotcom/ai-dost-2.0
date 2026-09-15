import { describe, expect, it } from 'vitest';
import { extractArtifact, extractImages, stripInternalTags } from '../utils/chatContent';

describe('chatContent', () => {
  it('strips internal generation and tool tags', () => {
    expect(stripInternalTags('hello [GENERATE_PDF] world [TOOL_CALL:x]')).toBe('hello  world');
  });

  it('extracts markdown images without mutating content', () => {
    expect(extractImages('A ![cat](https://example.com/cat.png) B')).toEqual([
      { alt: 'cat', url: 'https://example.com/cat.png' },
    ]);
    expect(extractImages('plain text')).toEqual([]);
  });

  it('builds an HTML artifact and inlines CSS/JS', () => {
    const artifact = extractArtifact([
      '```html',
      '<html><head><link rel="stylesheet" href="style.css"></head><body><button id="x">Go</button><script src="app.js"></script></body></html>',
      '```',
      '```css',
      'button{color:red}',
      '```',
      '```javascript',
      'document.getElementById("x").addEventListener("click",()=>console.log("ok"));',
      '```',
    ].join('\n'));

    expect(artifact?.language).toBe('html');
    expect(artifact?.title).toBe('Interactive UI Artifact');
    expect(artifact?.code).toContain('<style>');
    expect(artifact?.code).toContain('button{color:red}');
    expect(artifact?.code).toContain('<script>');
  });

  it('does not promote small non-visual JS into an artifact', () => {
    expect(extractArtifact('```js\nconst x = 1;\n```')).toBeNull();
  });

  it('detects SVG as a vector artifact', () => {
    const artifact = extractArtifact('```svg\n<svg><path d="M0 0" /></svg>\n```');
    expect(artifact).toEqual({
      title: 'SVG Vector Graphic',
      code: '<svg><path d="M0 0" /></svg>',
      language: 'svg',
    });
  });
});
