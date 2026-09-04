import React, { useState } from 'react';
import {
  Copy, Check, Play, ExternalLink, RefreshCw, X,
  Smartphone, Monitor, Sparkles, Eye, Square,
  ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../../services/api';
import { compileLiveHtml, isVisualCode } from '../../lib/compileLiveHtml';

export default function CodeBlock({
  code = '',
  language = 'text',
  canRun = true,
  canPreview = false,
  onOpenIDE,
  onPreviewArtifact,
}) {
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [iframeKey, setIframeKey] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const isVisual = isVisualCode(code, language);
  const lineCount = (code.match(/\n/g) || []).length + 1;
  const isCollapsible = lineCount > 12;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const handleRun = async () => {
    if (running) return;

    // 1. If visual / animation code, open live interactive runner
    if (isVisual) {
      setShowPreview((prev) => !prev);
      if (onPreviewArtifact && !showPreview) {
        onPreviewArtifact({
          title: `${language.toUpperCase()} Live Animation`,
          code,
          language,
        });
      }
      return;
    }

    // 2. Otherwise execute via backend Node/Python runner
    setRunning(true);
    setOutput(null);
    try {
      const response = await api.post('/chat/execute', { code, language });
      const data = response.data || {};
      const errorText = data.stderr || data.error;
      const isDomError = errorText && /document|window|HTML|canvas/i.test(errorText);

      setOutput({
        success: !!data.success,
        text: data.stdout || errorText || '(No output)',
        duration: data.duration || 0,
        isDomError,
      });

      // If backend reported DOM error, allow 1-click browser preview
      if (isDomError) {
        setShowPreview(true);
      }
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

  const handleOpenArtifact = () => {
    if (onPreviewArtifact) {
      onPreviewArtifact({
        title: `${language.toUpperCase()} Interactive Artifact`,
        code,
        language,
      });
    }
  };

  return (
    <div className="chat-code-block" role="region" aria-label={`${language} code block`}>
      <div className="chat-code-header">
        <span className="chat-code-language">
          {language.toLowerCase() || 'code'}
          {isVisual && (
            <span className="ml-1.5 px-1.5 py-0.2 text-[9px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded uppercase tracking-wider">
              Interactive
            </span>
          )}
        </span>

        <div className="chat-code-actions">
          {/* Live Preview / Run Animation Button */}
          {canRun && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className={`chat-code-action ${
                showPreview ? 'text-accent font-semibold bg-accent/15 border border-accent/30' : ''
              }`}
              aria-label={isVisual ? (showPreview ? 'Close animation preview' : 'Run live animation') : 'Run code'}
              title={isVisual ? (showPreview ? 'Close preview' : 'Run animation live') : 'Run code'}
            >
              {showPreview ? <Square size={12} className="text-accent" /> : <Play size={12} className="text-emerald-400 fill-emerald-400/20" />}
              <span>
                {running ? 'Running…' : isVisual ? (showPreview ? 'Close Preview' : 'Run Animation') : 'Run'}
              </span>
            </button>
          )}

          {/* Split Screen Canvas Popout */}
          {onPreviewArtifact && isVisual && (
            <button
              type="button"
              onClick={handleOpenArtifact}
              className="chat-code-action"
              aria-label="Open split canvas preview"
              title="Open in Split Canvas"
            >
              <ExternalLink size={12} />
              <span>Canvas</span>
            </button>
          )}

          {/* Open in full Copilot IDE */}
          {canPreview && onOpenIDE && (
            <button
              type="button"
              onClick={onOpenIDE}
              className="chat-code-action"
              aria-label="Open code in IDE"
              title="Open in IDE"
            >
              <Sparkles size={12} />
              <span>IDE</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={copyCode}
            className={`chat-code-action ${copied ? 'text-accent font-medium' : ''}`}
            aria-label={copied ? 'Copied code' : 'Copy code to clipboard'}
            title={copied ? 'Copied' : 'Copy'}
          >
            {copied ? (
              <>
                <Check size={13} className="text-accent" />
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

      <div className={`relative ${isCollapsible && !expanded ? 'max-h-72 overflow-hidden' : ''}`}>
        <pre className="chat-code-pre">
          <code>{code}</code>
        </pre>
        {isCollapsible && !expanded && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas-base via-canvas-base/80 to-transparent pointer-events-none" />
        )}
      </div>

      {isCollapsible && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-canvas-surface/70 border-t border-border/50 text-[11px] font-mono text-ink-muted">
          <span>{lineCount} lines · {language}</span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-accent-primary hover:underline cursor-pointer font-sans text-xs py-0.5 font-medium"
            aria-label={expanded ? 'Collapse code block' : `Expand full code (${lineCount} lines)`}
          >
            {expanded ? (
              <>
                <ChevronUp size={13} />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown size={13} />
                <span>Expand full code ({lineCount} lines)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Inline Live Interactive Animation & Preview Drawer */}
      {showPreview && (
        <div className="border-t border-border bg-canvas-base flex flex-col overflow-hidden animate-in fade-in">
          {/* Preview Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-canvas-surface border-b border-border text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-signal-success animate-pulse" />
              <span className="font-mono text-[11px] font-semibold text-paper-100 flex items-center gap-1">
                <Eye size={12} className="text-accent" /> Live Animation Preview
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Device Mode */}
              <div className="flex items-center bg-canvas-base rounded p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1 rounded text-[10px] cursor-pointer transition-colors ${
                    previewDevice === 'desktop' ? 'bg-accent text-white font-medium' : 'text-ink-muted hover:text-paper-100'
                  }`}
                  title="Desktop viewport"
                >
                  <Monitor size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1 rounded text-[10px] cursor-pointer transition-colors ${
                    previewDevice === 'mobile' ? 'bg-accent text-white font-medium' : 'text-ink-muted hover:text-paper-100'
                  }`}
                  title="Mobile viewport"
                >
                  <Smartphone size={11} />
                </button>
              </div>

              {/* Reload */}
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1 rounded hover:bg-canvas-subtle text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                title="Restart Animation"
              >
                <RefreshCw size={11} />
              </button>

              {/* Popout to split canvas */}
              {onPreviewArtifact && (
                <button
                  type="button"
                  onClick={handleOpenArtifact}
                  className="p-1 rounded hover:bg-canvas-subtle text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                  title="Open Split Canvas"
                >
                  <ExternalLink size={11} />
                </button>
              )}

              {/* Close */}
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-1 rounded hover:bg-canvas-subtle text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                title="Close Preview"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="p-3 bg-canvas-base flex items-center justify-center overflow-auto min-h-[260px] max-h-[420px]">
            <div
              className="bg-black rounded-lg overflow-hidden border border-border shadow-md transition-all duration-200"
              style={{
                width: previewDevice === 'mobile' ? '360px' : '100%',
                height: '320px',
              }}
            >
              <iframe
                key={iframeKey}
                srcDoc={compileLiveHtml(code, language)}
                title="Live Code Animation"
                sandbox="allow-scripts allow-modals allow-forms"
                className="w-full h-full border-0 bg-[#090d16]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Backend Console Execution Output */}
      {output && !showPreview && (
        <div className="chat-code-output">
          <div className="chat-code-output-meta flex items-center justify-between">
            <span>
              {output.success ? 'Console Output' : 'Execution Error'}
              {output.duration ? ` · ${output.duration}ms` : ''}
            </span>
            {output.isDomError && (
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="text-[10px] text-accent hover:underline cursor-pointer flex items-center gap-1 font-semibold"
              >
                <Play size={10} /> Open as Live Browser Animation
              </button>
            )}
          </div>
          <pre>{output.text}</pre>
        </div>
      )}
    </div>
  );
}
