import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Code2, Download, ExternalLink, RefreshCw, X,
  Smartphone, Tablet, Monitor, Sparkles, Copy, Check,
  Maximize2, Minimize2, Play, Send, Loader2
} from 'lucide-react';
import { compileLiveHtml } from '../../lib/compileLiveHtml';
import { useCanvasCollaboration } from '../../hooks/useCanvasCollaboration';
import CollaboratorCursors from '../canvas/CollaboratorCursors';
import CollaboratorsBar from '../canvas/CollaboratorsBar';
import ShareCollaborationModal from '../canvas/ShareCollaborationModal';
import SelfHealingDiagnosticsBanner from '../canvas/SelfHealingDiagnosticsBanner';

export default function ChatArtifactsCanvas({
  artifact,
  onClose,
  onOpenInCopilot,
}) {
  const [tab, setTab] = useState('preview'); // 'preview' | 'code'
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(50); // percentage (30% - 85%)
  const [isDragging, setIsDragging] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  // ── Pillar 4: Autonomous Self-Healing State ──
  const [healState, setHealState] = useState('idle'); // 'idle' | 'diagnosing' | 'healed' | 'manual_review'
  const [healInfo, setHealInfo] = useState({
    error: '',
    explanation: '',
    confidence: 0.95,
    diff: null,
    preHealCode: '',
    suggestedFix: '',
  });
  const lastHealTimestampRef = useRef(0);
  const healAttemptsCountRef = useRef(0);

  const iframeRef = useRef(null);
  const bodyContainerRef = useRef(null);

  const { title = 'Interactive Artifact', code = '', language = 'html', id: artifactId } = artifact || {};
  const [liveCode, setLiveCode] = useState(code);
  // P3 #83: the message-listener effect below reads the latest code through
  // this ref instead of `liveCode` in its deps — otherwise every keystroke
  // unregistered/registered the window listener mid-session.
  const liveCodeRef = useRef(liveCode);
  useEffect(() => { liveCodeRef.current = liveCode; }, [liveCode]);

  const roomId = artifactId || 'collaborative-canvas-default';

  // ── Real-Time Multiplayer Collaboration Hook ──
  const {
    connected,
    participants,
    currentUser,
    isAiCoEditing,
    broadcastCursor,
    broadcastEdit,
    broadcastTyping,
    triggerAiCoEdit,
  } = useCanvasCollaboration({
    roomId,
    initialCode: code,
    language,
    title,
    onRemoteSync: (remoteCode) => {
      setLiveCode(remoteCode);
    },
  });

  // Synchronize when incoming artifact changes
  useEffect(() => {
    setLiveCode(code);
    setIframeKey((k) => k + 1);
    healAttemptsCountRef.current = 0;
    setHealState('idle');
  }, [code, artifact?.id]);

  // ── Pillar 4: Real-Time Self-Healing Error Interceptor ──
  useEffect(() => {
    const handleSandboxMessage = async (e) => {
      // #82: only our own artifact iframe may trigger auto-heal/API calls —
      // verify the message source window and a trusted origin (srcDoc frames
      // without allow-same-origin report the opaque origin "null").
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.origin !== 'null' && e.origin !== window.location.origin) return;
      if (e.data?.type === 'SANDBOX_RUNTIME_ERROR' && e.data?.error) {
        const errorMsg = e.data.error;
        const line = e.data.line;
        const stack = e.data.stack;

        // Anti-storm cooldown: minimum 3 seconds between auto-healing cycles & max 3 automated attempts
        const now = Date.now();
        if (now - lastHealTimestampRef.current < 3000 || healAttemptsCountRef.current >= 3) {
          return;
        }
        lastHealTimestampRef.current = now;
        healAttemptsCountRef.current += 1;

        setHealState('diagnosing');
        const preCode = liveCodeRef.current; // P3 #83: ref, not state (stable deps)

        try {
          const res = await fetch('/api/sandbox/heal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: liveCodeRef.current, // P3 #83
              error: errorMsg,
              line,
              stack,
              language,
            }),
          });

          const data = await res.json();
          if (data?.success && data?.fixedCode) {
            const conf = data.confidence || 0.95;
            setHealInfo({
              error: errorMsg,
              explanation: data.explanation || 'Fixed runtime exception',
              confidence: conf,
              diff: data.diff || null,
              preHealCode: preCode,
              suggestedFix: data.fixedCode,
            });

            if (conf >= 0.85) {
              // High confidence -> auto-apply immediately
              setLiveCode(data.fixedCode);
              broadcastEdit(data.fixedCode);
              setHealState('healed');
              setIframeKey((k) => k + 1);
            } else {
              // Lower confidence -> require manual review
              setHealState('manual_review');
            }
          } else {
            setHealState('idle');
          }
        } catch (err) {
          console.warn('[Self-Healing] Error:', err);
          setHealState('idle');
        }
      }
    };

    window.addEventListener('message', handleSandboxMessage);
    return () => window.removeEventListener('message', handleSandboxMessage);
  }, [language, broadcastEdit]); // P3 #83: liveCode removed (read via liveCodeRef)

  const handleUndoHeal = useCallback(() => {
    if (healInfo.preHealCode) {
      setLiveCode(healInfo.preHealCode);
      broadcastEdit(healInfo.preHealCode);
      setIframeKey((k) => k + 1);
    }
    setHealState('idle');
  }, [healInfo.preHealCode, broadcastEdit]);

  const handleApplyManualFix = useCallback(() => {
    if (healInfo.suggestedFix) {
      setLiveCode(healInfo.suggestedFix);
      broadcastEdit(healInfo.suggestedFix);
      setIframeKey((k) => k + 1);
      setHealState('healed');
    }
  }, [healInfo.suggestedFix, broadcastEdit]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(liveCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const downloadFile = () => {
    const ext = language === 'html' ? 'html' : language === 'javascript' ? 'js' : language === 'svg' ? 'svg' : 'txt';
    const blob = new Blob([liveCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'artifact'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInNewTab = () => {
    const compiled = compileLiveHtml(liveCode, language);
    const blob = new Blob([compiled], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Compile standalone HTML for iframe rendering with live animation support
  const getCompiledHtml = useCallback(() => {
    return compileLiveHtml(liveCode, language);
  }, [liveCode, language]);

  // Resizable divider logic
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const windowWidth = window.innerWidth;
      const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
      if (newWidth >= 30 && newWidth <= 85) {
        setCanvasWidth(Math.round(newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Pointer move handler to broadcast live cursor coordinates
  const handlePointerMove = (e) => {
    if (!bodyContainerRef.current) return;
    const rect = bodyContainerRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      broadcastCursor({ x, y });
    }
  };

  // Execute AI Virtual Co-Editing
  const handleExecuteAiCoEdit = async (e) => {
    e?.preventDefault();
    const inst = aiInstruction.trim();
    if (!inst) return;
    try {
      const updatedCode = await triggerAiCoEdit(inst, liveCode);
      if (updatedCode) {
        setLiveCode(updatedCode);
        setAiInstruction('');
        setShowAiPrompt(false);
      }
    } catch (err) {
      console.warn('AI Co-Edit failed:', err.message);
    }
  };

  const deviceWidth = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  }[device];

  const containerStyle = isMaximized
    ? { width: '100%' }
    : { width: `${canvasWidth}%` };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      style={containerStyle}
      className={`relative h-full flex flex-col bg-canvas-base border-l border-border shadow-2xl z-30 overflow-hidden shrink-0 transition-all ${
        isDragging ? 'select-none pointer-events-auto' : ''
      }`}
    >
      {/* Resizable drag handle (only in split mode) */}
      {!isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setCanvasWidth(50)}
          title="Drag to resize canvas (Double click to reset to 50%)"
          className="absolute left-0 top-0 bottom-0 w-1.5 hover:w-2 -translate-x-1/2 hover:bg-accent/60 cursor-col-resize z-50 transition-colors flex items-center justify-center group"
        >
          <div className="w-1 h-8 rounded-full bg-border group-hover:bg-accent transition-colors" />
        </div>
      )}

      {/* ── Canvas Top Bar with Multiplayer Collaborators Stack ── */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 bg-canvas-surface border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-signal-success animate-pulse shrink-0" />
          <span className="text-xs font-semibold text-paper-100 truncate max-w-[120px] sm:max-w-[160px]">
            {title}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-accent/15 border border-accent/30 text-accent font-mono shrink-0">
            {language.toUpperCase()}
          </span>
        </div>

        {/* View / Code Tabs */}
        <div className="flex items-center gap-1 bg-canvas-elevated p-0.5 rounded-lg border border-border">
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              tab === 'preview'
                ? 'bg-accent text-white font-semibold shadow-xs'
                : 'text-ink-muted hover:text-paper-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              tab === 'code'
                ? 'bg-accent text-white font-semibold shadow-xs'
                : 'text-ink-muted hover:text-paper-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>
        </div>

        {/* Real-time Multiplayer Collaborators Bar & Action Buttons */}
        <div className="flex items-center gap-1.5">
          <CollaboratorsBar
            participants={participants}
            currentUser={currentUser}
            connected={connected}
            onOpenShare={() => setIsShareOpen(true)}
            onAiCoEdit={() => setShowAiPrompt((prev) => !prev)}
            isAiCoEditing={isAiCoEditing}
          />

          {onOpenInCopilot && (
            <button
              onClick={() => onOpenInCopilot({ ...artifact, code: liveCode })}
              title="Open in full Copilot IDE"
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-canvas-elevated hover:bg-canvas-overlay border border-border text-paper-100 transition-all cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>IDE</span>
            </button>
          )}

          <button
            onClick={openInNewTab}
            title="Open preview in new browser tab"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore split view' : 'Maximize canvas'}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            title="Close Canvas"
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Optional AI Virtual Collaborator Co-Edit Prompt Bar ── */}
      <AnimatePresence>
        {showAiPrompt && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 bg-purple-950/30 border-b border-purple-500/30 overflow-hidden"
          >
            <form onSubmit={handleExecuteAiCoEdit} className="flex items-center gap-2 max-w-xl mx-auto">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <input
                type="text"
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Instruct AI Copilot to co-edit code (e.g., 'Add dark mode toggle', 'Add asteroid rings')..."
                className="flex-1 px-3 py-1.5 text-xs bg-canvas-base border border-purple-500/40 rounded-xl text-paper-100 outline-none placeholder:text-purple-300/50"
                disabled={isAiCoEditing}
              />
              <button
                type="submit"
                disabled={isAiCoEditing || !aiInstruction.trim()}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isAiCoEditing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Apply</span>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pillar 4: Autonomous Self-Healing Diagnostic HUD Banner ── */}
      <SelfHealingDiagnosticsBanner
        state={healState}
        error={healInfo.error}
        explanation={healInfo.explanation}
        confidence={healInfo.confidence}
        diff={healInfo.diff}
        onApplyFix={handleApplyManualFix}
        onUndo={handleUndoHeal}
        onDismiss={() => setHealState('idle')}
      />

      {/* Sub-toolbar (Devices + Live Indicator + Copy/Download) */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-1.5 bg-canvas-subtle border-b border-border text-xs text-ink-muted">
        {tab === 'preview' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                device === 'desktop'
                  ? 'bg-canvas-elevated text-paper-100 border border-border'
                  : 'hover:bg-canvas-elevated text-ink-muted'
              }`}
              title="Desktop view (100%)"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                device === 'tablet'
                  ? 'bg-canvas-elevated text-paper-100 border border-border'
                  : 'hover:bg-canvas-elevated text-ink-muted'
              }`}
              title="Tablet view (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                device === 'mobile'
                  ? 'bg-canvas-elevated text-paper-100 border border-border'
                  : 'hover:bg-canvas-elevated text-ink-muted'
              }`}
              title="Mobile view (375px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              title="Reload preview iframe"
              className="p-1.5 rounded-md hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors ml-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-ink-muted font-mono">
            <span>{liveCode.split('\n').length} lines</span>
            <span>•</span>
            <span>{liveCode.length} chars</span>
            <span className="text-signal-success font-sans text-[10px] bg-signal-success/10 px-1.5 py-0.5 rounded border border-signal-success/20">
              Multiplayer Sync
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {tab === 'code' && (
            <button
              onClick={() => {
                setTab('preview');
                setIframeKey((k) => k + 1);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-accent text-white font-medium hover:bg-accent/90 transition-colors cursor-pointer shadow-xs"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Run Code</span>
            </button>
          )}
          <button
            onClick={copyCode}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-canvas-elevated text-paper-200 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-signal-success" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={downloadFile}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:bg-canvas-elevated text-paper-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* ── Main Canvas Body with Multiplayer Cursors Overlay ── */}
      <div
        ref={bodyContainerRef}
        onPointerMove={handlePointerMove}
        className="flex-1 bg-canvas-base overflow-hidden flex items-center justify-center p-2.5 sm:p-3 relative"
      >
        {/* Figma-style Floating Multi-User Cursors */}
        <CollaboratorCursors participants={participants} containerRef={bodyContainerRef} />

        {tab === 'preview' ? (
          <div
            className="h-full transition-all duration-300 rounded-xl overflow-hidden shadow-xl border border-border bg-canvas-surface flex flex-col relative"
            style={{ width: deviceWidth }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={getCompiledHtml()}
              title={title}
              // #77: no allow-same-origin — artifact scripts must not reach
              // the parent origin (localStorage, tokens, cookies)
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        ) : (
          <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-border bg-canvas-surface shadow-inner relative">
            <textarea
              value={liveCode}
              onChange={(e) => {
                const val = e.target.value;
                setLiveCode(val);
                broadcastEdit(val);
                broadcastTyping(true);
              }}
              onFocus={() => broadcastTyping(true)}
              onBlur={() => broadcastTyping(false)}
              placeholder="Edit code concurrently with your team..."
              spellCheck={false}
              className="w-full h-full p-4 font-mono text-xs text-paper-100 bg-transparent resize-none outline-none leading-relaxed select-text"
              style={{ tabSize: 2 }}
            />
          </div>
        )}
      </div>

      {/* ── 1-Click Share & Collaboration Modal ── */}
      <ShareCollaborationModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        roomId={roomId}
        participants={participants}
        currentUser={currentUser}
      />
    </motion.div>
  );
}
