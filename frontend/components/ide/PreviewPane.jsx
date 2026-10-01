import React from 'react';
import {
  Eye, Loader2, Play, RotateCcw, Square, Monitor, Tablet, Smartphone,
  Crosshair, RefreshCw, ExternalLink, Zap, Wrench, Check, X, AlertTriangle, Sparkles
} from 'lucide-react';
import VisualDebugger from '../views/VisualDebugger';
import VisualHealer from '../VisualHealer';
import { generateLiveAppHtml } from './PreviewEngine';

export function PreviewPane({
  devServerStatus = {},
  devServerLoading = false,
  handleStartDevServer,
  handleRestartDevServer,
  handleStopDevServer,
  previewDevice = 'desktop',
  setPreviewDevice,
  previewZoom = 100,
  setPreviewZoom,
  inspectorActive = false,
  setInspectorActive,
  setSelectedInspectorElement,
  visualDebuggerOpen = false,
  setVisualDebuggerOpen,
  previewSourceMode = 'auto',
  setPreviewSourceMode,
  iframeRef,
  projectId,
  files = [],
  contents = {},
  showToast,
  setDeployModalOpen,
  handleSend,
  running = false,
  autoFixBanner = null,
  handleApplyBannerFix,
  handleDismissBannerFix,
  runtimeError = null,
  setRuntimeError,
  handleAutoFixRuntimeError,
  healingInProgress = false,
  qaStatus = 'idle',
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-canvas-base w-full h-full">
      {/* Browser Address Bar & Device Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-canvas-surface border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-bold text-accent uppercase tracking-wider font-mono">
            <Eye size={13} /> Preview
          </span>

          {/* Dev Server Live Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-canvas-base border border-border text-[10px] font-mono">
            {devServerStatus.state === 'READY' ? (
              <span className="flex items-center gap-1 text-signal-success font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-success animate-pulse" />
                Live (:{devServerStatus.hostPort || '5173'})
              </span>
            ) : devServerStatus.state === 'STARTING' || devServerStatus.state === 'CREATING' ? (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <Loader2 size={11} className="animate-spin" />
                Booting...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-paper-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                In-Browser
              </span>
            )}
          </div>

          {/* Visual QA Badge (from director verification gate) */}
          {qaStatus && qaStatus !== 'idle' && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-canvas-base border border-border text-[10px] font-mono"
              data-testid="qa-badge"
            >
              {qaStatus === 'passed' ? (
                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                  <Check size={11} /> QA passed
                </span>
              ) : qaStatus === 'failed' ? (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  <AlertTriangle size={11} /> QA failed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <Loader2 size={11} className="animate-spin" /> QA running
                </span>
              )}
            </div>
          )}

          {/* Dev Server Actions */}
          <div className="flex items-center gap-1">
            {devServerStatus.state !== 'READY' && (
              <button
                type="button"
                onClick={handleStartDevServer}
                disabled={devServerLoading}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer flex items-center gap-1"
                title="Start Real Dev Server"
              >
                <Play size={10} className="fill-emerald-500" /> Start
              </button>
            )}
            {devServerStatus.state === 'READY' && (
              <>
                <button
                  type="button"
                  onClick={handleRestartDevServer}
                  disabled={devServerLoading}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-all cursor-pointer flex items-center gap-1"
                  title="Restart Dev Server"
                >
                  <RotateCcw size={10} />
                </button>
                <button
                  type="button"
                  onClick={handleStopDevServer}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-600 dark:text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-all cursor-pointer flex items-center gap-1"
                  title="Stop Dev Server"
                >
                  <Square size={10} className="fill-red-500" />
                </button>
              </>
            )}
          </div>

          {/* Responsive Device Switcher */}
          <div className="flex items-center bg-canvas-base rounded-md p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
              }`}
              title="Desktop View"
            >
              <Monitor size={11} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('tablet')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === 'tablet' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
              }`}
              title="Tablet View"
            >
              <Tablet size={11} />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-accent text-white font-semibold' : 'text-ink-muted hover:text-paper-100'
              }`}
              title="Mobile View"
            >
              <Smartphone size={11} />
            </button>
          </div>

          {/* Zoom Selector */}
          <div className="hidden sm:flex items-center bg-canvas-base rounded-md p-0.5 border border-border text-[9px] font-mono">
            {[100, 90, 80].map(zoom => (
              <button
                type="button"
                key={zoom}
                onClick={() => setPreviewZoom(zoom)}
                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  previewZoom === zoom 
                    ? 'bg-accent text-white font-bold shadow-xs' 
                    : 'text-ink-muted hover:text-paper-100'
                }`}
                title={`Scale preview canvas to ${zoom}%`}
              >
                {zoom}%
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !inspectorActive;
              setInspectorActive(next);
              if (iframeRef?.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({ type: 'SET_INSPECTOR_ACTIVE', active: next }, '*');
              }
              if (next) {
                showToast?.('🔍 Inspector ON — click any element in the preview to edit it with AI', 'info');
              } else {
                setSelectedInspectorElement?.(null);
              }
            }}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 border transition-all cursor-pointer ${
              inspectorActive
                ? 'bg-amber-500/20 text-amber-500 dark:text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'bg-canvas-subtle text-ink-muted border-border hover:text-paper-100 hover:border-border-strong'
            }`}
            title={inspectorActive ? 'Inspector Active — click any element to edit' : 'Enable Visual Inspector'}
          >
            <Crosshair size={11} /> {inspectorActive ? 'Inspecting...' : 'Inspect'}
          </button>

          <button
            type="button"
            onClick={() => setVisualDebuggerOpen?.(open => !open)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 border transition-all cursor-pointer ${
              visualDebuggerOpen
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-canvas-subtle text-ink-muted border-border hover:text-paper-100 hover:border-border-strong'
            }`}
            title="Run zero-token DOM layout diagnostics"
          >
            <Eye size={11} /> {visualDebuggerOpen ? 'QA Open' : 'Zero-Token QA'}
          </button>
        </div>

        {/* Actions: Source Mode, Refresh, Popout & Deploy */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setPreviewSourceMode?.(m => {
                if (m === 'auto') return 'live';
                if (m === 'live') return 'mock';
                return 'auto';
              });
            }}
            className="px-2 py-0.5 rounded text-[9px] font-medium bg-canvas-subtle hover:bg-canvas-elevated text-paper-100 border border-border transition-colors cursor-pointer"
            title="Toggle: Auto -> Live Proxy -> In-Browser"
          >
            {previewSourceMode === 'auto' ? 'Mode: Auto' : previewSourceMode === 'live' ? 'Mode: Proxy' : 'Mode: In-Browser'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (iframeRef?.current) {
                if (previewSourceMode === 'live' || (previewSourceMode === 'auto' && devServerStatus.state === 'READY')) {
                  iframeRef.current.src = `/api/preview/${projectId}?t=${Date.now()}`;
                } else {
                  iframeRef.current.srcdoc = generateLiveAppHtml(files, contents, inspectorActive);
                }
              }
              showToast?.('Preview refreshed', 'info');
            }}
            className="p-1 rounded-md bg-canvas-subtle hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 border border-border transition-colors cursor-pointer"
            title="Reload Preview"
          >
            <RefreshCw size={12} />
          </button>

          <button
            type="button"
            onClick={() => window.open(`/api/preview/${projectId}`, '_blank')}
            className="p-1 rounded-md bg-canvas-subtle hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 border border-border transition-colors cursor-pointer"
            title="Open preview in new tab"
          >
            <ExternalLink size={12} />
          </button>

          <button
            type="button"
            onClick={() => setDeployModalOpen?.(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 shadow-xs transition-all cursor-pointer"
            title="Deploy live to Vercel/Netlify"
          >
            <Zap size={11} className="fill-white" /> Deploy
          </button>
        </div>
      </div>

      {/* Visual QA Inspector Drawer */}
      {visualDebuggerOpen && (
        <div className="px-4 py-2 bg-canvas-base border-b border-border animate-in fade-in">
          <VisualDebugger
            iframeRef={iframeRef}
            onTriggerFix={(p) => handleSend?.(p)}
            isRepairing={running}
          />
        </div>
      )}

      {/* Preview Viewport Canvas */}
      <div className="flex-1 min-h-0 w-full h-full p-2 bg-canvas-base overflow-auto flex justify-center items-stretch">
        <div
          className="h-full bg-canvas-surface rounded-xl overflow-hidden shadow-surface-card border border-border transition-all duration-300 relative flex flex-col"
          style={{
            width: previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : '100%',
            maxWidth: '100%',
            margin: '0 auto',
          }}
        >
          <div
            className="w-full h-full relative"
            style={
              previewZoom !== 100
                ? {
                    width: `${100 / (previewZoom / 100)}%`,
                    height: `${100 / (previewZoom / 100)}%`,
                    transform: `scale(${previewZoom / 100})`,
                    transformOrigin: previewDevice === 'desktop' ? 'top left' : 'top center',
                  }
                : { width: '100%', height: '100%' }
            }
          >
            {/* Visual Healer — analyzes the preview iframe for UI issues */}
            <VisualHealer iframeRef={iframeRef} />
            <iframe
              ref={iframeRef}
              src={
                (previewSourceMode === 'live' || (previewSourceMode === 'auto' && devServerStatus.state === 'READY'))
                  ? `/api/preview/${projectId}`
                  : undefined
              }
              srcDoc={
                (previewSourceMode === 'mock' || (previewSourceMode === 'auto' && devServerStatus.state !== 'READY'))
                  ? generateLiveAppHtml(files, contents, inspectorActive)
                  : undefined
              }
              className="w-full h-full border-0 bg-canvas-surface"
              title="Live App"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
            {/* Auto-Fix Banner (Low Confidence Heal Suggestion) */}
            {autoFixBanner && (
              <div className="absolute top-2 left-4 right-4 z-30 bg-[#12172a]/95 border border-amber-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Wrench size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-300">Self-Healing Suggestion</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {Math.round((autoFixBanner.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/80 mt-1">{autoFixBanner.explanation}</p>
                      <p className="text-[10px] text-zinc-400 font-mono mt-0.5 line-clamp-1">
                        Error: {String(autoFixBanner.error).slice(0, 100)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleApplyBannerFix}
                      className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check size={12} /> Apply Fix
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissBannerFix}
                      className="p-1.5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Dismiss suggestion"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Runtime Error Overlay */}
            {runtimeError && (
              <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#1e1014]/95 border border-red-500/40 rounded-xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-red-300">Preview Runtime Error</span>
                        <span className="text-[10px] text-red-400/70 font-mono">Live Crash</span>
                        {healingInProgress && (
                          <span className="text-[9px] text-amber-400 font-medium flex items-center gap-1 animate-pulse">
                            <Loader2 size={10} className="animate-spin" /> Auto-healing...
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-red-200/90 font-mono mt-0.5 line-clamp-2 break-all">
                        {runtimeError.error}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAutoFixRuntimeError?.(runtimeError.error)}
                      disabled={running || healingInProgress}
                      className="px-2.5 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles size={12} />
                      {healingInProgress ? 'Healing...' : 'Auto-Fix with Copilot'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuntimeError?.(null)}
                      className="p-1 hover:bg-white/10 text-zinc-400 hover:text-white rounded-md transition-colors"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
