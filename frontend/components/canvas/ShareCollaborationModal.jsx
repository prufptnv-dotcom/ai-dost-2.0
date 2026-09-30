import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Users, Link2, Shield } from 'lucide-react';

/**
 * ShareCollaborationModal - 1-Click invite link generator & permissions manager
 */
export default function ShareCollaborationModal({
  isOpen,
  onClose,
  roomId = 'default-room',
  participants = [],
  currentUser,
}) {
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState('edit'); // 'edit' | 'view'

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard?canvasRoom=${encodeURIComponent(roomId)}`
      : `http://localhost:3000/dashboard?canvasRoom=${roomId}`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const allUsers = currentUser
    ? [{ ...currentUser, isLocal: true }, ...participants]
    : participants;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-md rounded-2xl bg-canvas-base border border-border shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-canvas-surface">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-paper-100">Invite to Live Canvas</h3>
                <p className="text-[11px] text-ink-muted">Collaborate with real-time cursors and edits</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-canvas-elevated text-ink-muted hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Share Link Row */}
            <div>
              <label className="block text-xs font-medium text-paper-200 mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-accent" />
                <span>Shareable Canvas Link</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-canvas-elevated border border-border rounded-xl text-paper-100 outline-none select-all truncate"
                />
                <button
                  onClick={copyShareLink}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                    copied
                      ? 'bg-signal-success text-white'
                      : 'bg-accent text-white hover:bg-accent/90'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Room Code Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-canvas-surface border border-border">
              <div className="text-xs">
                <span className="text-ink-muted block text-[10px] font-mono">Room Session ID</span>
                <span className="font-mono text-accent font-semibold text-xs">{roomId}</span>
              </div>
              <div className="flex items-center gap-1 bg-canvas-elevated p-0.5 rounded-lg border border-border text-xs">
                <button
                  onClick={() => setPermission('edit')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                    permission === 'edit'
                      ? 'bg-accent text-white font-semibold'
                      : 'text-ink-muted hover:text-white'
                  }`}
                >
                  Can Edit
                </button>
                <button
                  onClick={() => setPermission('view')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                    permission === 'view'
                      ? 'bg-accent text-white font-semibold'
                      : 'text-ink-muted hover:text-white'
                  }`}
                >
                  View Only
                </button>
              </div>
            </div>

            {/* Current Collaborators Roster */}
            <div>
              <div className="text-xs font-medium text-paper-200 mb-2 flex items-center justify-between">
                <span>Active in Session</span>
                <span className="text-[11px] font-mono text-ink-muted">{allUsers.length} online</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {allUsers.map((user, idx) => (
                  <div
                    key={user.socketId || idx}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-canvas-surface/60 border border-border-subtle"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: user.color || '#06b6d4' }}
                      >
                        {(user.name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-paper-100 font-medium">
                        {user.name} {user.isLocal && <span className="text-ink-muted font-normal">(You)</span>}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-signal-success/10 text-signal-success border border-signal-success/20">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
