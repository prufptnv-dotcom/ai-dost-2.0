import React from 'react';
import { Users, Sparkles, UserPlus } from 'lucide-react';

/**
 * CollaboratorsBar - Active multiplayer avatar stack and invite trigger
 */
export default function CollaboratorsBar({
  participants = [],
  currentUser,
  connected = false,
  onOpenShare = () => {},
  onAiCoEdit = () => {},
  isAiCoEditing = false,
}) {
  const allUsers = currentUser
    ? [{ ...currentUser, isLocal: true }, ...participants]
    : participants;

  return (
    <div className="flex items-center gap-2 select-none">
      {/* ── Active Avatars Stack ── */}
      <div className="flex items-center -space-x-2 overflow-hidden py-1">
        {allUsers.slice(0, 4).map((user, idx) => {
          const color = user.color || '#06b6d4';
          const initial = (user.name || 'U').charAt(0).toUpperCase();

          return (
            <div
              key={user.socketId || user.userId || idx}
              title={`${user.name}${user.isLocal ? ' (You)' : ''}`}
              className="relative w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-canvas-surface cursor-default transition-transform hover:scale-110 hover:z-10"
              style={{ backgroundColor: color }}
            >
              <span>{initial}</span>
              {user.isLocal && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-signal-success ring-1 ring-canvas-surface" />
              )}
            </div>
          );
        })}

        {allUsers.length > 4 && (
          <div className="w-6 h-6 rounded-full bg-canvas-elevated border border-border flex items-center justify-center text-[10px] font-mono text-ink-muted">
            +{allUsers.length - 4}
          </div>
        )}
      </div>

      {/* ── Live Status Pill ── */}
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-canvas-elevated border border-border text-[11px] font-mono text-ink-muted">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected ? 'bg-signal-success animate-pulse' : 'bg-ink-muted'
          }`}
        />
        <span>{connected ? `Live (${allUsers.length})` : 'Offline'}</span>
      </div>

      {/* ── AI Co-Pilot Co-Edit Action ── */}
      <button
        onClick={onAiCoEdit}
        disabled={isAiCoEditing || !connected}
        title="Summon AI Virtual Collaborator to co-edit live"
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
          isAiCoEditing
            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 animate-pulse'
            : 'bg-canvas-elevated hover:bg-canvas-overlay border-border text-paper-200 hover:text-white'
        }`}
      >
        <Sparkles className="w-3 h-3 text-purple-400" />
        <span className="hidden md:inline">{isAiCoEditing ? 'AI Editing…' : 'AI Co-Edit'}</span>
      </button>

      {/* ── Share / Invite Collaborators Button ── */}
      <button
        onClick={onOpenShare}
        title="Invite collaborators to this canvas"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all cursor-pointer shadow-xs"
      >
        <UserPlus className="w-3 h-3" />
        <span className="hidden sm:inline">Invite</span>
      </button>
    </div>
  );
}
