import { analyzeDocument, formatVisualRepairPrompt } from '../utils/visualHealer';

function rect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe('zero-token visual heuristic engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 });
  });

  it('reports viewport overflow and hidden interactive controls without mutating the DOM', () => {
    document.body.innerHTML = '<main><button id="hidden">Save</button><div id="wide">Wide</div></main>';
    const hidden = document.querySelector('#hidden');
    const wide = document.querySelector('#wide');
    hidden.getBoundingClientRect = () => rect(0, 0, 0, 0);
    wide.getBoundingClientRect = () => rect(0, 0, 400, 20);

    const report = analyzeDocument(document);

    expect(report.source).toBe('client-dom-heuristics');
    expect(report.findings.map((finding) => finding.type)).toEqual(expect.arrayContaining(['invisible-interactive', 'viewport-overflow']));
    expect(wide.style.maxWidth).toBe('');
  });

  it('reports overlapping text and creates a source-file repair prompt', () => {
    document.body.innerHTML = '<h1 id="title">Title</h1><p id="copy">Copy</p>';
    document.querySelector('#title').getBoundingClientRect = () => rect(0, 0, 100, 30);
    document.querySelector('#copy').getBoundingClientRect = () => rect(20, 10, 100, 30);

    const report = analyzeDocument(document);
    const prompt = formatVisualRepairPrompt(report);

    expect(report.findings.some((finding) => finding.type === 'text-overlap')).toBe(true);
    expect(prompt).toContain('zero-token client-side DOM report');
    expect(prompt).toContain('Do not request a screenshot or visual API');
  });
});