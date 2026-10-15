import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CollaboratorCursors - Figma & Cursor-Grade Real-Time Multiplayer Cursors
 * Renders floating pointer arrows, user name tags, and live typing indicators.
 */
export default function CollaboratorCursors({ participants = [], containerRef }) {
  if (!participants || participants.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      <AnimatePresence>
        {participants.map((user) => {
          if (!user.cursor || typeof user.cursor.x !== 'number' || typeof user.cursor.y !== 'number') {
            return null;
          }

          const { x, y } = user.cursor;
          const color = user.color || '#06b6d4';
          const isAi = Boolean(user.isAi);

          return (
            <motion.div
              key={user.socketId || user.userId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 1,
                scale: 1,
                x,
                y,
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                type: 'spring',
                damping: 28,
                stiffness: 400,
                mass: 0.3,
              }}
              className="absolute top-0 left-0 flex flex-col items-start"
              style={{ pointerEvents: 'none' }}
            >
              {/* Figma-style SVG cursor arrow */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow-md"
                style={{ transform: 'translate(-2px, -2px)' }}
              >
                <path
                  d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>

              {/* Floating Name Badge & Typing Indicator */}
              <div
                className="px-2 py-0.5 mt-0.5 rounded-full text-[11px] font-medium text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap select-none"
                style={{
                  backgroundColor: color,
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: `0 4px 12px ${color}40`,
                }}
              >
                <span>{user.name}</span>
                {isAi && (
                  <span className="text-[9px] px-1 py-0.2 bg-white/20 rounded font-mono font-bold">
                    AI
                  </span>
                )}

                {/* Live Typing Indicator */}
                {user.isTyping && (
                  <span className="flex items-center gap-0.5 ml-0.5">
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
