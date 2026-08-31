import React, { useState } from 'react';
import { Copy, Check, Play, ExternalLink } from 'lucide-react';
import api from '../../services/api';

export default function CodeBlock({
  code = '',
  language = 'text',
  canRun = false,
  canPreview = false,
  onOpenIDE,
}) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const runCode = async () => {
    if (!canRun || running) return;
    setRunning(true);
    setOutput(null);
    try {
      const response = await api.post('/chat/execute', { code, language });
      const data = response.data || {};
      setOutput({
        success: !!data.success,
        text: data.stdout || data.stderr || data.error || '(No output)',
        duration: data.duration || 0,
      });
    } catch (error) {
      setOutput({
        success: false,
        text: error?.message || 'Execution failed.',
        duration: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="chat-code-block">
      <div className="chat-code-header">
        <span className="chat-code-language">
          {language.toUpperCase()}
        </span>
        <div className="chat-code-actions">
          {canPreview && onOpenIDE && (
            <button
              type="button"
              onClick={onOpenIDE}
              className="chat-code-action"
              aria-label="Open code in IDE"
              title="Open in IDE"
            >
              <ExternalLink size={14} />
              <span>Open</span>
            </button>
          )}
          {canRun && (
            <button
              type="button"
              onClick={runCode}
              disabled={running}
              className="chat-code-action"
              aria-label="Run code"
              title="Run code"
            >
              <Play size={13} />
              <span>{running ? 'Running…' : 'Run'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={copyCode}
            className="chat-code-action"
            aria-label="Copy code"
            title="Copy code"
          >
            {copied ? (
              <>
                <Check size={13} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="chat-code-pre">
        <code>{code}</code>
      </pre>
      {output && (
        <div className="chat-code-output">
          <div className="chat-code-output-meta">
            {output.success ? 'Output' : 'Error'}
            {output.duration ? ` · ${output.duration}ms` : ''}
          </div>
          <pre>{output.text}</pre>
        </div>
      )}
    </div>
  );
}
