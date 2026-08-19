'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(mod => mod.Editor), { ssr: false });

export default function LivePreview({ 
  sandboxId, 
  projectId, 
  devServerUrl, 
  framework = 'vite',
  onLog,
  onError,
  height = 600 
}) {
  const [previewUrl, setPreviewUrl] = useState(devServerUrl || '');
  const [status, setStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const iframeRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const devServerProcess = useRef(null);

  const log = useCallback((msg, type = 'info') => {
    onLog?.({ sandboxId, message: msg, type, timestamp: Date.now() });
  }, [sandboxId, onLog]);

  const checkServerHealth = useCallback(async (url) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeout);
      setStatus('connected');
      setError(null);
      setShowErrorOverlay(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatus('connecting');
        scheduleReconnect(url);
      }
    }
  }, [scheduleReconnect]);

  const scheduleReconnect = useCallback((url) => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    reconnectTimeout.current = setTimeout(() => checkServerHealth(url), 2000);
  }, [checkServerHealth]);

  useEffect(() => {
    if (devServerUrl) {
      setPreviewUrl(devServerUrl);
      setStatus('connecting');
      checkServerHealth(devServerUrl);
    }
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [devServerUrl, checkServerHealth]);

  const handleIframeLoad = () => {
    setStatus('connected');
    setShowErrorOverlay(false);
    log('Preview loaded successfully', 'success');
  };

  const handleIframeError = () => {
    setStatus('error');
    setError('Failed to load preview');
    setShowErrorOverlay(true);
    log('Preview failed to load', 'error');
  };

  const retry = () => {
    if (previewUrl) {
      setStatus('connecting');
      checkServerHealth(previewUrl);
    }
  };

  return (
    <div className="live-preview" style={{ height, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#0f172a' }}>
      <div className="preview-header" style={{ padding: '8px 12px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`status-dot ${status}`} style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'connected' ? '#22c55e' : status === 'connecting' ? '#f59e0b' : '#ef4444' }} />
          <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>
            {status === 'connected' && 'Live Preview'} 
            {status === 'connecting' && 'Connecting...'} 
            {status === 'error' && 'Connection Error'}
            {status === 'disconnected' && 'Disconnected'}
          </span>
          {devServerUrl && (
            <a href={devServerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '12px', textDecoration: 'none' }}>
              ↗ Open in new tab
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={retry} disabled={status === 'connecting'} style={{ padding: '4px 10px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Refresh
          </button>
          <button onClick={() => setShowErrorOverlay(!showErrorOverlay)} style={{ padding: '4px 10px', fontSize: '12px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {showErrorOverlay ? 'Hide Errors' : 'Show Errors'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <iframe
          ref={iframeRef}
          src={previewUrl || 'about:blank'}
          style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          allow="clipboard-read; clipboard-write"
        />

        {showErrorOverlay && status !== 'connected' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', zIndex: 10, color: '#e2e8f0' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>Preview Unavailable</h3>
              <p style={{ margin: '0 0 24px', color: '#94a3b8', fontSize: '14px' }}>
                {error || 'The dev server is not responding. It may still be starting up or has crashed.'}
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={retry} style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                  Retry Connection
                </button>
                <button onClick={() => window.open(previewUrl, '_blank')} style={{ padding: '10px 20px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showErrorOverlay && error && (
        <div style={{ padding: '12px', background: '#1e293b', borderTop: '1px solid #334155', maxHeight: '200px', overflow: 'auto' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#fca5a5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {error}
          </div>
        </div>
      )}
    </div>
  );
}