import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '../ui/AppIcon';
import Image from 'next/image';
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
  const [tab, setTab] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  const [healState, setHealState] = useState('idle');
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

  const { title = 'Interactive Artifact', code = '', language = 'html', type = 'code', id: artifactId, downloadUrl } = artifact || {};
  const [liveCode, setLiveCode] = useState(code);
  const liveCodeRef = useRef(liveCode);
  useEffect(() => { liveCodeRef.current = liveCode; }, [liveCode]);

  const roomId = artifactId || 'collaborative-canvas-default';

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

  useEffect(() => {
    setLiveCode(code);
    setIframeKey((k) => k + 1);
    healAttemptsCountRef.current = 0;
    setHealState('idle');
  }, [code, artifact?.id]);

  const renderArtifactContent = () => {
    if (tab === 'code') {
      return (
        <div className="w-full h-full p-5 font-mono text-xs leading-relaxed text-paper-200 bg-canvas-elevated overflow-auto">
          <pre className="whitespace-pre-wrap">{code || liveCode}</pre>
        </div>
      );
    }

    switch (type) {
      case 'pdf':
        return (
          <iframe
            src={`${downloadUrl}#toolbar=0`}
            className="w-full h-full border-none"
            title="PDF Preview"
          />
        );
      case 'chart':
        return (
          <div className="w-full h-full flex items-center justify-center bg-white p-4 overflow-auto">
            <Image src={code} alt="Chart Visualization" width={400} height={300} className="max-w-full h-auto shadow-lg rounded-lg" />
          </div>
        );
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center bg-canvas-elevated p-4 overflow-auto">
            <Image src={code} alt="Generated Visual" width={400} height={300} className="max-w-full h-auto rounded-lg shadow-2xl" />
          </div>
        );
      case 'document':
        return (
          <div className="w-full h-full p-8 bg-white text-slate-900 overflow-y-auto prose prose-slate max-w-none">
            <div className="max-w-3xl mx-auto">
              <div dangerouslySetInnerHTML={{ __html: code }} />
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full relative bg-white overflow-hidden">
            <iframe
              ref={iframeRef}
              key={iframeKey}
              srcDoc={compileLiveHtml(liveCode, language)}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin"
              title="Live Preview"
            />
          </div>
        );
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(liveCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const typeIcon = () => {
    if (type === 'pdf') return <AppIcon name="file" size={16} />;
    if (type === 'chart') return <AppIcon name="chart" size={16} />;
    if (type === 'image') return <AppIcon name="image" size={16} />;
    if (type === 'document') return <AppIcon name="file" size={16} />;
    if (type === 'code') return <AppIcon name="fileCode" size={16} />;
    return <AppIcon name="zap" size={16} />;
  };

  const typeColor = () => {
    if (type === 'pdf') return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (type === 'chart') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (type === 'image') return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
    if (type === 'document') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (type === 'code') return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed right-0 top-0 h-screen bg-canvas-base border-l border-border-subtle shadow-2xl z-40 flex flex-col transition-all duration-300"
      style={{ width: `${canvasWidth}%` }}
    >
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-canvas-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <div className={`p-2 rounded-xl border shrink-0 shadow-xs ${typeColor()}`}>
            {typeIcon()}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-paper-100 truncate">{title}</h3>
            <p className="text-[10px] font-mono text-ink-muted uppercase tracking-wider">{language || type} · interactive</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {downloadUrl && (
            <button onClick={() => window.open(downloadUrl, '_blank')} className="p-2 hover:bg-canvas-elevated rounded-lg text-ink-muted hover:text-paper-100 transition-colors cursor-pointer" title="Download">
              <AppIcon name="download" size={16} />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-canvas-elevated rounded-lg text-ink-muted hover:text-paper-100 transition-colors cursor-pointer" title="Close">
            <AppIcon name="close" size={16} />
          </button>
        </div>
      </div>

      <div className="flex p-2 gap-1 bg-canvas-base border-b border-border-subtle">
        <button
          onClick={() => setTab('preview')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            tab === 'preview'
              ? 'bg-accent text-white shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)]'
              : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
          }`}
        >
          <AppIcon name="eye" size={14} /> Preview
        </button>
        <button
          onClick={() => setTab('code')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            tab === 'code'
              ? 'bg-accent text-white shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)]'
              : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
          }`}
        >
          <AppIcon name="code" size={14} /> Code
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-canvas-elevated">
        {renderArtifactContent()}
      </div>

      <div className="px-4 py-3 border-t border-border-subtle bg-canvas-surface/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-paper-200 bg-canvas-elevated border border-border hover:border-border-strong hover:text-paper-100 transition-all cursor-pointer">
            {copied ? <AppIcon name="check" size={14} className="text-emerald-400" /> : <AppIcon name="copy" size={14} />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button onClick={onOpenInCopilot} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-accent hover:bg-accent-hover shadow-[0_0_12px_-2px_rgba(99,102,241,0.4)] transition-all cursor-pointer">
            <AppIcon name="external" size={14} /> Open in IDE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">Artifact v1.0</span>
        </div>
      </div>
    </motion.div>
  );
}
