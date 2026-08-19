'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Monaco loaded client-side only (SSR-safe)
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(m => m.default), { ssr: false });

/**
 * Collaborative editor using Yjs (CRDT) + y-webrtc (peer sync).
 * Graceful fallback: if yjs/y-webrtc load fails (offline/old browser),
 * renders a plain read/write Monaco editor — collaboration silently disabled.
 *
 * Props:
 *  - value: string       (current file content)
 *  - onChange: fn        (local + remote changes)
 *  - language: string    (monaco language id)
 *  - room: string        (collab room name; unique per file)
 *  - readOnly: bool
 */
export default function CollaborativeEditor({ value, onChange, language = 'javascript', room = 'ai-dost-default', readOnly = false }) {
  const editorRef = useRef(null);
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [peers, setPeers] = useState(0);
  const [collabFailed, setCollabFailed] = useState(false);
  const applyRemoteRef = useRef(false);

  const handleChange = useCallback((code) => {
    if (applyRemoteRef.current) return; // remote-applied change → don't re-echo
    onChange?.(code);
    if (ydoc) {
      try {
        const text = ydoc.getText('code');
        if (text.toString() !== code) {
          text.delete(0, text.length);
          text.insert(0, code);
        }
      } catch { /* yjs unavailable */ }
    }
  }, [onChange, ydoc]);

  // Init Yjs doc + WebRTC provider (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    (async () => {
      try {
        const Y = (await import('yjs')).default || await import('yjs');
        const { WebrtcProvider } = await import('y-webrtc');

        const doc = new Y.Doc();
        const text = doc.getText('code');
        if (value) { text.insert(0, value); }

        const prov = new WebrtcProvider(room, doc, {
          signaling: ['wss://y-webrtc-signaling-eu.herokuapp.com', 'wss://signaling.yjs.dev'],
          maxConns: 20,
        });

        // Remote edits → Monaco (via onChange)
        text.observe(() => {
          if (cancelled) return;
          const remote = text.toString();
          if (remote !== editorRef.current?.getValue?.()) {
            applyRemoteRef.current = true;
            onChange?.(remote);
            requestAnimationFrame(() => { applyRemoteRef.current = false; });
          }
        });

        prov.on('status', ({ connected }) => setPeers(connected ? (prov.awareness?.getStates?.().size ?? 1) - 1 : 0));
        prov.awareness?.setLocalState?.({ user: { name: 'you', color: '#4b8bfc' } });

        if (!cancelled) { setYdoc(doc); setProvider(prov); }
      } catch (err) {
        // Collaboration unavailable → plain editor fallback (no crash)
        console.warn('[Collab] yjs init failed, running standalone:', err?.message);
        if (!cancelled) setCollabFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      provider?.destroy?.();
      ydoc?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 text-[10px] px-2 py-1 rounded-full"
        style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid var(--color-border)', color: collabFailed ? '#f59e0b' : peers > 0 ? '#34d399' : '#94a3b8' }}>
        {collabFailed ? '⚠ Standalone mode' : peers > 0 ? `● ${peers} peer${peers > 1 ? 's' : ''} connected` : '● Offline (collab ready)'}
      </div>
      <MonacoEditor
        value={value}
        onChange={handleChange}
        language={language}
        readOnly={readOnly}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          automaticLayout: true,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          renderLineHighlight: 'all',
          tabSize: 2,
        }}
      />
    </div>
  );
}