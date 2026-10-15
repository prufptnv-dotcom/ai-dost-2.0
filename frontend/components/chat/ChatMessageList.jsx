import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppIcon from '../ui/AppIcon';
import ChatQuickStarts from './ChatQuickStarts';
import ChatMessageBubble from './ChatMessageBubble';
import ThinkingDot from './ThinkingDot';

export default function ChatMessageList({
  scrollRef,
  messagesEndRef,
  onScroll,
  displayMessages = [],
  isEmpty = false,
  thinking = false,
  thinkingLabel = 'Thinking…',
  thinkingElapsed = 0,
  variants = null,
  applyVariant,
  backendHistory = null,
  loadBackendHistory,
  onSelectPrompt,
  handleRegenerate,
  setLightboxUrl,
  loadVariants,
  onNavigate,
  setActiveArtifact,
  handleEditMessage,
  setActiveAssessment,
  showJumpToBottom = false,
  scrollToBottom,
}) {
  return (
    <>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto py-6 px-4 md:px-6 flex flex-col"
      >
        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
          {isEmpty && !thinking && (
            <ChatQuickStarts onSelectPrompt={onSelectPrompt} />
          )}

          <div className="space-y-7">
            {isEmpty && backendHistory && backendHistory.length > 0 && (
              <div className="flex justify-center mb-6">
                <button
                  type="button"
                  onClick={loadBackendHistory}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-canvas-surface border border-border text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated hover:border-border-strong transition-fast cursor-pointer shadow-xs"
                >
                  🕐 Load previous conversation ({backendHistory.length} messages)
                </button>
              </div>
            )}

            {displayMessages.map((msg, index) => (
              <ChatMessageBubble
                key={msg.id || index}
                msg={msg}
                isLast={index === displayMessages.length - 1}
                onRegenerate={handleRegenerate}
                onOpenImage={setLightboxUrl}
                onVariants={loadVariants}
                onNavigate={onNavigate}
                onOpenArtifact={setActiveArtifact}
                onEdit={handleEditMessage}
                onStartAssessment={setActiveAssessment}
              />
            ))}

            {variants && variants.items && variants.items.length > 0 && !thinking && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-ink-muted">3 alternative responses:</p>
                <div className="space-y-1.5">
                  {variants.items.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => applyVariant && applyVariant(v)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-fast cursor-pointer hover:bg-canvas-elevated bg-canvas-surface border border-border text-paper-200"
                    >
                      <span className="font-semibold mr-1.5 text-accent">Option {i + 1}:</span>
                      {v.slice(0, 240)}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {thinking && (
                <ThinkingDot
                  key="thinking"
                  label={thinkingLabel}
                  elapsed={thinkingElapsed}
                />
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-16 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showJumpToBottom && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => scrollToBottom && scrollToBottom('smooth')}
              className="jump-to-bottom-btn"
              aria-label="Jump to latest message"
            >
              <AppIcon name="arrowDown" size={13} className="text-accent" />
              <span>Jump to latest</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
