import { useState } from "react";

function AIPageView({ page, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [pageContent, setPageContent] = useState(page.content);

  return (
    <div className="fixed inset-0 bg-bg-default z-50 overflow-y-auto flex flex-col select-text">
      {/* Header */}
      <div className="sticky top-0 bg-bg-hover border-b border-secondary/10 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">📄</span>
          <h1 className="text-sm font-bold text-primary">AI-Dost Pages</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 border border-secondary/30 rounded-lg text-xs font-semibold text-text-secondary hover:bg-secondary/10 transition cursor-pointer"
          >
            {isEditing ? 'Save Page' : '✏️ Edit Page'}
          </button>
          <button 
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.href);
                alert('Page share link copied to clipboard!');
              }
            }}
            className="px-3 py-1.5 bg-primary text-bg-default rounded-lg text-xs font-bold hover:bg-primary/80 transition cursor-pointer"
          >
            🔗 Share Page
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text-primary text-sm cursor-pointer ml-3 font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Table of Contents */}
        <div className="hidden md:block col-span-1 border-r border-secondary/10 pr-6 space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Sections</h3>
          <ul className="space-y-2 text-xs text-text-secondary">
            <li className="font-semibold text-primary cursor-pointer">1. Introduction</li>
            <li className="cursor-pointer hover:text-primary transition">2. Key Findings</li>
            <li className="cursor-pointer hover:text-primary transition">3. Logical Summary</li>
          </ul>
        </div>

        {/* Article Body */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          <h2 className="text-2xl font-bold text-primary">{page.title}</h2>
          
          {isEditing ? (
            <textarea
              value={pageContent}
              onChange={(e) => setPageContent(e.target.value)}
              className="w-full h-[500px] p-4 bg-bg-hover text-text-primary border border-secondary/30 rounded-xl focus:outline-none font-mono text-sm resize-none"
            />
          ) : (
            <div className="prose prose-invert max-w-none text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {pageContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default AIPageView;