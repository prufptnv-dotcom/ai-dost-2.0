import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, Code2, Download, ExternalLink, RefreshCw, X,
  Smartphone, Tablet, Monitor, Sparkles, Copy, Check,
  Maximize2, Minimize2, Play, Send, Loader2,
  FileText, BarChart3, Image as ImageIcon, FileCode, Zap
} from 'lucide-react';
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
  const [tab, setTab] = useState('preview'); // 'preview' | 'code'
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(50); 
  const [isDragging, setIsDragging] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');

  // --- Autonomous Self-Healing State ---
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

  // --- Real-Time Multiplayer Collaboration Hook ---
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

  // --- ARTIFACT RENDERER: The Claude-Style Multi-Viewer ---
  const renderArtifactContent = () => {
    if (tab === 'code') {
      return (
        <div className="w-full h-full p-4 font-mono text-xs text-slate-300 bg-slate-950 overflow-auto">
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
          <div className="w-full h-full flex items-center justify-center bg-slate-900 p-4 overflow-auto">
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
      default: // Default to the Live HTML Sandbox
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

  return (
    <motion.div 
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed right-0 top-0 h-screen bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col transition-all duration-300"
      style={{ width: `${canvasWidth}%` }}
    >
      {/* Artifact Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            {type === 'pdf' && <FileText className="w-4 h-4 text-blue-400" />}
            {type === 'chart' && <BarChart3 className="w-4 h-4 text-green-400" />}
            {type === 'image' && <ImageIcon className="w-4 h-4 text-purple-400" />}
            {type === 'document' && <FileText className="w-4 h-4 text-orange-400" />}
            {type === 'code' && <Code2 className="w-4 h-4 text-blue-400" />}
            {type !== 'pdf' && type !== 'chart' && type !== 'image' && type !== 'document' && <Zap className="w-4 h-4 text-yellow-400" />}
          </div>
          <h3 className="text-sm font-bold text-slate-200 truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {downloadUrl && (
            <button onClick={() => window.open(downloadUrl, '_blank')} className="p-2 hover:bg-slate-800 rounded-md text-slate-400 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-md text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex p-2 gap-1 bg-slate-950 border-b border-slate-800">
        <button 
          onClick={() => setTab('preview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === 'preview' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Eye className="w-3 h-3" /> Preview
        </button>
        <button 
          onClick={() => setTab('code')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === 'code' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Code2 className="w-3 h-3" /> Code
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-950">
        {renderArtifactContent()}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={handleCopy} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button onClick={onOpenInCopilot} className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            <ExternalLink className="w-3 h-3" /> Open in IDE
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Artifact v1.0</span>
        </div>
      </div>
    </motion.div>
  );
}
