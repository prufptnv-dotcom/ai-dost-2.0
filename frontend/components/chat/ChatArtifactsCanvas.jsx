import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, Code2, Download, ExternalLink, RefreshCw, X,
  Smartphone, Tablet, Monitor, Sparkles, Copy, Check, ArrowUpRight
} from 'lucide-react';

export default function ChatArtifactsCanvas({
  artifact,
  onClose,
  onOpenInCopilot
}) {
  const [tab, setTab] = useState('preview'); // 'preview' | 'code'
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);

  const { title = 'Interactive Artifact', code = '', language = 'html' } = artifact || {};

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadFile = () => {
    const ext = language === 'html' ? 'html' : language === 'javascript' ? 'js' : language === 'svg' ? 'svg' : 'txt';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'artifact'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compile standalone HTML for iframe rendering
  const getCompiledHtml = () => {
    if (language === 'html') {
      if (code.includes('<html') || code.includes('<!DOCTYPE')) return code;
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 16px; min-height: 100vh; box-sizing: border-box; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
    }

    if (language === 'svg') {
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;">${code}</body></html>`;
    }

    return `<!DOCTYPE html><html><body style="background:#0f172a;color:#f8fafc;padding:20px;font-family:monospace;"><pre>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
  };

  const deviceWidth = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  }[device];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-full lg:w-[48%] h-full flex flex-col bg-[#0b0f19] border-l border-white/10 shadow-2xl z-30 overflow-hidden"
    >
      {/* Canvas Top Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#0e1422] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200 truncate max-w-[180px]">
            {title}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-400/30 text-blue-300 font-mono">
            {language.toUpperCase()}
          </span>
        </div>

        {/* View / Code Tabs */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'preview' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => setTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'code' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" /> Code
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {onOpenInCopilot && (
            <button
              onClick={() => onOpenInCopilot(artifact)}
              title="Open in full Copilot IDE"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all cursor-pointer shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Copilot IDE</span>
            </button>
          )}

          <button
            onClick={onClose}
            title="Close Canvas"
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-toolbar (Devices + Reload + Download) */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-[#090d16] border-b border-white/5 text-xs text-slate-400">
        {tab === 'preview' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDevice('desktop')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${device === 'desktop' ? 'bg-white/10 text-blue-400' : 'hover:bg-white/5'}`}
              title="Desktop view"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${device === 'tablet' ? 'bg-white/10 text-blue-400' : 'hover:bg-white/5'}`}
              title="Tablet view"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${device === 'mobile' ? 'bg-white/10 text-blue-400' : 'hover:bg-white/5'}`}
              title="Mobile view"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIframeKey(k => k + 1)}
              title="Reload preview"
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 font-mono">
            {code.split('\n').length} lines • {code.length} chars
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={downloadFile}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Body */}
      <div className="flex-1 bg-[#06080e] overflow-hidden flex items-center justify-center p-2 relative">
        {tab === 'preview' ? (
          <div
            className="h-full transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-white"
            style={{ width: deviceWidth }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              srcDoc={getCompiledHtml()}
              title={title}
              sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed bg-[#0b0e14] rounded-xl border border-white/10 select-text">
            <pre className="m-0 whitespace-pre-wrap">{code}</pre>
          </div>
        )}
      </div>
    </motion.div>
  );
}
