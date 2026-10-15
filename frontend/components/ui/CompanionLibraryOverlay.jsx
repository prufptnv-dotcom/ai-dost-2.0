export function CompanionLibraryOverlay({
  showLibrary, setShowLibrary, uploadedDocs, setUploadedDocs, showToast, viewingDoc, setViewingDoc
}) {
  return (
    <>
      {showLibrary && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col p-6 overflow-y-auto select-text text-text-primary">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <span>🗂️ RAG Document Library</span>
            </div>
            <button 
              onClick={() => setShowLibrary(false)}
              className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {uploadedDocs.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-xs">
                No documents uploaded yet. Use the paperclip icon in chat to attach books or text files!
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {uploadedDocs.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:border-primary/30 transition text-left">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-xs font-bold text-text-primary flex items-center gap-1.5 truncate">
                        <span>📄 {doc.name}</span>
                        <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-normal capitalize shrink-0">
                          {doc.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-secondary flex items-center gap-2">
                        <span>Size: {doc.size}</span>
                        <span>•</span>
                        <span>Added: {doc.timestamp}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary hover:text-bg-default text-primary text-[10px] font-bold rounded-lg transition cursor-pointer"
                      >
                        📖 View Doc
                      </button>
                      <button
                        onClick={() => {
                          setUploadedDocs(prev => prev.filter(d => d.name !== doc.name));
                          showToast({ type: 'info', message: `${doc.name} removed from library.` });
                        }}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded transition cursor-pointer"
                        title="Remove Document"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {viewingDoc && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col p-6 overflow-hidden select-text text-text-primary">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-sm truncate font-sans">
              <span>📖 Reading: {viewingDoc.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-success/15 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold select-none">RAG Indexed</span>
              <button 
                onClick={() => setViewingDoc(null)}
                className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
              >
                ✕ Back to Library
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-white/[0.02] border border-white/[0.08] rounded-xl p-5 font-sans text-xs leading-relaxed text-left w-full select-text whitespace-pre-wrap">
            {viewingDoc.content}
          </div>
        </div>
      )}
    </>
  );
}