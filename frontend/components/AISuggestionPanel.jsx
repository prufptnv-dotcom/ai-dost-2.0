import React from 'react';
import { FaLightbulb, FaInfoCircle, FaTimes } from 'react-icons/fa';

const AISuggestionPanel = ({ suggestions = [], position = null, onAccept, onClose }) => {
  if (!position || suggestions.length === 0) return null;

  return (
    <div 
      className="absolute z-50 bg-bg-hover border border-primary/35 p-3 rounded-xl shadow-2xl max-w-xs md:max-w-md backdrop-blur-md transition-all duration-200"
      style={{ 
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, 0)'
      }}
    >
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-primary/20">
        <div className="flex items-center">
          <FaLightbulb className="text-primary mr-2 animate-pulse text-sm" />
          <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Suggestions</span>
        </div>
        <button 
          className="text-text-secondary hover:text-primary transition p-1 rounded cursor-pointer"
          onClick={onClose}
          title="Close suggestions"
        >
          <FaTimes className="text-xs" />
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {suggestions.map((sug, i) => (
          <div 
            key={i} 
            className="p-2.5 rounded-lg bg-bg-default border border-secondary/15 hover:border-primary/50 hover:bg-primary/5 transition cursor-pointer text-left group"
            onClick={() => onAccept(sug)}
          >
            <pre className="text-xs text-text-primary font-mono overflow-x-auto whitespace-pre-wrap">{sug.code}</pre>
            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-secondary/5 text-[9px] text-text-secondary">
              <span className="flex items-center italic">
                <FaInfoCircle className="mr-1 text-[10px] text-primary" />
                {sug.explanation || 'Contextual Code Suggestion'}
              </span>
              {sug.confidence && (
                <span className="font-semibold text-primary">
                  {Math.round(sug.confidence * 100)}% Match
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AISuggestionPanel;
