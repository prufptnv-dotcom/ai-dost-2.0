import { ChatClassicMessageBubble as MessageBubble } from '../chat/ChatClassicMessageBubble';
// (Add other necessary imports manually if needed)

export function CompanionMessageList({
  messages, playingMessageId, speakText, handleFeedbackSignal, showToast, onWriteCode, setActivePage, isProSearch, proSearchStages, isTyping, isThinking, isGeneratingImage, bottomRef, ThinkingIndicator, ThinkingPulse
}) {
  return (
      
      <div className="flex-1 overflow-y-auto space-y-3 p-4 select-text">
        {messages.map((msg, i) => (
          <MessageBubble 
            key={msg.id || i} 
            msg={{
              ...msg,
              isPlaying: playingMessageId === (msg.id || i),
              onPlayAudio: (txt) => speakText(txt, msg.id || i),
              onFeedback: handleFeedbackSignal,
              onShowToast: showToast
            }} 
            onWriteCode={onWriteCode} 
            onCreatePage={(title, text) => setActivePage({ title, content: text })} 
          />
        ))}

        {/* Pro Search Stages log */}
        {isProSearch && proSearchStages.length > 0 && (
          <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl space-y-1.5 text-xs text-text-secondary max-w-[90%] select-text">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <span className="animate-spin text-[10px] border-2 border-primary border-t-transparent rounded-full w-3.5 h-3.5" />
              Agentic Pro Search Execution
            </div>
            {proSearchStages.map((stage, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-success text-[10px]">✓</span>
                <span className="font-mono text-[10px]">{stage}</span>
              </div>
            ))}
          </div>
        )}

        {isTyping && (!isProSearch || proSearchStages.length === 0) && (
          <div className="flex justify-start">
            <ThinkingIndicator isThinking={isThinking} isGeneratingImage={isGeneratingImage} />
          </div>
        )}
        {isThinking && (!isProSearch || proSearchStages.length === 0) && (
          <div className="flex justify-start mt-2">
            <div className="flex items-center gap-2.5 bg-bg-card border border-border text-text-secondary px-3 py-2.5 rounded-xl text-xs">
              <ThinkingPulse className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium">Deep analysing...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
  );
}
