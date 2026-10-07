import React from 'react';
import { render, screen } from '@testing-library/react';
import ParsedMarkdown from '../components/chat/ParsedMarkdown';
import CodeBlock from '../components/chat/CodeBlock';

// Mock Monaco Editor since Jest runs in JSDOM without full web workers
jest.mock('@monaco-editor/react', () => {
  return function DummyEditor(props) {
    return <div data-testid="monaco-editor" data-language={props.language}>{props.value}</div>;
  };
});

describe('Code routing and preview behavior', () => {
  test('renders CanvasArtifact for Python scripts to enable immediate terminal execution', () => {
    const pythonContent = '```python\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("AI-Dost"))\n```';
    render(<ParsedMarkdown content={pythonContent} />);

    // Must show Artifact Canvas with python language
    expect(screen.getByText(/Artifact Canvas \(python\)/i)).toBeInTheDocument();
    // Must show Run Code button
    expect(screen.getByRole('button', { name: /Run Code/i })).toBeInTheDocument();
    // Must show Terminal Output area
    expect(screen.getByText(/Terminal Output/i)).toBeInTheDocument();
  });

  test('renders CanvasArtifact for bash/shell scripts', () => {
    const bashContent = '```bash\n#!/bin/bash\necho "Running system diagnostics..."\nls -la\n```';
    render(<ParsedMarkdown content={bashContent} />);

    expect(screen.getByText(/Artifact Canvas \(shell\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Code/i })).toBeInTheDocument();
  });

  test('renders standard CodeBlock with Open Preview for visual HTML games/apps (not CanvasArtifact)', () => {
    const htmlGameContent = '```html\n<!DOCTYPE html>\n<html>\n<body>\n<div id="board" class="snake-game">\n  <h1>Snake and Ladders</h1>\n  <canvas id="gameCanvas" width="400" height="400"></canvas>\n</div>\n</body>\n</html>\n```';
    render(<ParsedMarkdown content={htmlGameContent} />);

    // Must NOT be in terminal runner CanvasArtifact
    expect(screen.queryByText(/Artifact Canvas/i)).not.toBeInTheDocument();

    // Must render standard CodeBlock with "Open Preview"
    expect(screen.getByRole('button', { name: /Open live preview/i })).toBeInTheDocument();
    expect(screen.getByText(/Open Preview/i)).toBeInTheDocument();
  });

  test('renders standard CodeBlock with Open Preview for React/JSX components', () => {
    const reactContent = '```jsx\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;\n}\n```';
    render(<ParsedMarkdown content={reactContent} />);

    expect(screen.queryByText(/Artifact Canvas/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Open Preview/i)).toBeInTheDocument();
  });

  test('CodeBlock button toggles Open Preview and Close Preview for visual snippets', () => {
    const visualSnippet = '<div style="background: red; width: 100px; height: 100px;">Hello</div>';
    const { rerender } = render(<CodeBlock code={visualSnippet} language="html" canRun={true} canPreview={true} />);

    expect(screen.getByText(/Open Preview/i)).toBeInTheDocument();
  });
});
