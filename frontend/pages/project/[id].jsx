import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FileText, Folder, FolderOpen, Plus, Trash2, X, PanelRightOpen, PanelRightClose, Info, Bot, MessageSquare } from 'lucide-react';
import CodeEditor from '../../components/CodeEditor';
import ProjectDetails from '../../components/ProjectDetails';
import AICompanion from '../../components/AICompanion';
import Header from '../../components/Header';
import { fetchProject, addProjectFile, deleteProjectFile, saveProjectFile } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import FileExplorer from '../../components/FileExplorer';
import { useMode } from '../../context/ModeContext';
import AgentPanel from '../../components/AgentPanel';

const ProjectWorkspace = () => {
  const router = useRouter();
  const { id } = router.query;
  const { mode } = useMode();
  const [project, setProject] = useState(null);
  const [currentFile, setCurrentFile] = useState('main.py');
  const [code, setCode] = useState('');
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [leftTab, setLeftTab] = useState('chat'); // 'chat' | 'agent'
  const [mobileSheet, setMobileSheet] = useState(null); // 'chat' | 'agent' | 'files' | null
  const [loading, setLoading] = useState(true);
  
  const { setProjectId } = useSocket();
  const { showToast } = useToast();
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    setProjectId(id);
    
    const loadProject = async () => {
      try {
        const data = await fetchProject(id);
        setProject(data);
        
        // Load initial file content
        if (data.files && data.files.length > 0) {
          setCurrentFile(data.files[0].path);
          setCode(data.files[0].content);
        } else {
          // Default initial files
          setCode('# Write your code here...\n\nprint("Hello from AI-Dost sandbox!")\n');
        }
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadProject();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = (file) => {
    // If there is a pending auto-save, flush it immediately before switching
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveProjectFile(id, currentFile, code).catch(err => console.error(err));
    }
    setCurrentFile(file.path);
    setCode(file.content);
  };

  const handleEditorChange = (updatedContent) => {
    setCode(updatedContent);
    
    // Auto-save debounce (1.5 seconds)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProjectFile(id, currentFile, updatedContent);
        // Silently sync local state context
        setProject(prev => {
          if (!prev) return prev;
          const files = prev.files || [];
          const exists = files.some(f => f.path === currentFile);
          const updatedFiles = exists
            ? files.map(f => f.path === currentFile ? { ...f, content: updatedContent } : f)
            : [...files, { path: currentFile, content: updatedContent }];
          return { ...prev, files: updatedFiles };
        });
      } catch (err) {
        console.error('Failed auto-saving file content:', err);
      }
    }, 1500);
  };

  // Apply agent-generated file changes directly into the editor
  const handleAgentApply = ({ file, content }) => {
    if (!file || !content) return;
    // Flash Monaco diff highlight BEFORE content update (so we can compare old vs new)
    if (editorComponentRef.current?.flashDiffHighlight && file === currentFile) {
      editorComponentRef.current.flashDiffHighlight(content);
    }
    // Switch to that file in editor and inject new content
    setCurrentFile(file);
    setCode(content);
    // Update in-memory project state (adds file to FileExplorer if new)
    setProject(prev => {
      if (!prev) return prev;
      const files = prev.files || [];
      const exists = files.some(f => f.path === file);
      const updatedFiles = exists
        ? files.map(f => f.path === file ? { ...f, content } : f)
        : [...files, { path: file, content }];
      return { ...prev, files: updatedFiles };
    });
    showToast({ type: 'success', message: `✅ Agent changes applied to ${file}` });
    // Auto-save to backend
    saveProjectFile(id, file, content).catch(err => console.error('Agent apply save failed:', err));
  };

  // Called by AgentPanel when agent creates/modifies a file
  const handleAgentFileSync = ({ file, content }) => {
    if (!file) return;
    if (file === currentFile && content !== undefined) {
      setCode(content);
    }
    setProject(prev => {
      if (!prev) return prev;
      const files = prev.files || [];
      const exists = files.some(f => f.path === file);
      const updatedFiles = exists
        ? files.map(f => f.path === file ? { ...f, content } : f)
        : [...files, { path: file, content }];
      return { ...prev, files: updatedFiles };
    });
  };


  const handleCreateFile = async (fileName) => {
    if (!fileName.trim()) return;
    
    try {
      const res = await addProjectFile(id, fileName.trim(), '');
      if (res.success) {
        const data = await fetchProject(id);
        setProject(data);
        
        // Select the newly added file
        const createdFile = data.files.find(f => f.path === fileName.trim());
        if (createdFile) {
          handleFileChange(createdFile);
        }
        
        showToast({ type: 'success', message: `Created file: ${fileName}` });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to create file';
      showToast({ type: 'error', message: errorMsg });
    }
  };

  const handleDeleteFile = async (filePath, e) => {
    e.stopPropagation(); // Avoid switching to deleted file
    if (!confirm(`Are you sure you want to delete file "${filePath}"?`)) return;
    
    try {
      const res = await deleteProjectFile(id, filePath);
      if (res.success) {
        const data = await fetchProject(id);
        setProject(data);
        
        // If currently open file was deleted, load first remaining or clean editor
        if (currentFile === filePath) {
          if (data.files && data.files.length > 0) {
            handleFileChange(data.files[0]);
          } else {
            setCurrentFile('');
            setCode('');
          }
        }
        showToast({ type: 'success', message: 'File deleted successfully' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to delete file' });
    }
  };

  const editorComponentRef = useRef(null);

  const handleWriteCode = async (newCode, targetFilename = null) => {
    if (!newCode) return;
    
    // Check if AI response specifies a target file (e.g. "// File: app.js" or "filename: index.html")
    let activeFileToUse = targetFilename || currentFile || 'main.py';
    const fileHeaderMatch = newCode.match(/^(?:#|\/\/|\/\*|<!--)\s*(?:File|filename|Path):\s*([a-zA-Z0-9_\-\.\/]+)/i);
    if (fileHeaderMatch && fileHeaderMatch[1]) {
      activeFileToUse = fileHeaderMatch[1].trim();
    }

    // If target file doesn't exist in project tree, create it automatically
    const existingFile = project?.files?.find(f => f.path === activeFileToUse);
    if (!existingFile && id) {
      try {
        await addProjectFile(id, activeFileToUse, newCode);
        const data = await fetchProject(id);
        setProject(data);
        setCurrentFile(activeFileToUse);
      } catch (err) {
        console.error('Failed creating file:', err);
      }
    } else {
      setCurrentFile(activeFileToUse);
    }

    setCode(newCode);
    handleEditorChange(newCode);

    // Save immediately to backend DB
    if (id) {
      try {
        await saveProjectFile(id, activeFileToUse, newCode);
      } catch (e) {
        console.error('Immediate save failed:', e);
      }
    }

    showToast({ type: 'success', message: `⚡ Agent updated ${activeFileToUse}!` });

    // Auto-run sandbox code & auto-trigger visual preview for HTML/CSS files ("Aakh & Pair")
    setTimeout(() => {
      if (editorComponentRef.current) {
        const ext = activeFileToUse.split('.').pop()?.toLowerCase();
        if (['html', 'css', 'htm'].includes(ext) && editorComponentRef.current.togglePreview) {
          editorComponentRef.current.togglePreview(true);
        }
        if (editorComponentRef.current.runSandboxCode) {
          editorComponentRef.current.runSandboxCode();
        }
      }
    }, 600);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-default text-text-primary flex items-center justify-center">
        <div className="text-primary font-bold text-lg animate-pulse">Loading Workspace...</div>
      </div>
    );
  }

  const rawFiles = project?.files || [
    { path: 'main.py', content: '# Write your code here...\n\nprint("Hello from AI-Dost sandbox!")\n' }
  ];
  const projectFiles = rawFiles.map(f => f.path === currentFile ? { ...f, content: code } : f);

  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col h-screen overflow-hidden">
      <Head>
        <title>{project?.title ? `${project.title} - AI-Dost Sandbox` : 'Project Workspace - AI-Dost'}</title>
        <meta name="description" content="AI-Dost Autonomous AI Agent & Sandbox Workspace" />
      </Head>
      <Header />
      
      {mode === 'chat' ? (
        <main className="flex-1 flex pt-20 px-6 pb-6 max-w-6xl mx-auto w-full justify-center h-[calc(100vh-16px)] overflow-hidden">
          <div className="w-full max-w-5xl h-full overflow-hidden pb-2">
            <AICompanion onWriteCode={handleWriteCode} currentCode={code} currentFile={currentFile} />
          </div>
        </main>
      ) : (
        <>
          {/* ── Desktop Layout ─────────────────────────────────────────────── */}
          <main className="flex-1 flex pt-24 px-6 gap-6 h-[calc(100vh-24px)] pb-6 overflow-hidden max-w-[1600px] mx-auto w-full">
            {/* Left Drawer: Tabbed — Chat Assistant | Agent Mode (hidden on mobile) */}
            <div className="hidden md:flex flex-col w-[360px] lg:w-[420px] shrink-0 h-full overflow-hidden gap-0">
              {/* Tab Switcher */}
              <div className="flex bg-bg-default/60 backdrop-blur-lg border border-white/[0.08] rounded-2xl mb-2 p-1 gap-1 shrink-0">
                <button
                  onClick={() => setLeftTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    leftTab === 'chat'
                      ? 'bg-primary text-bg-default shadow-[0_0_10px_var(--color-primary-glow)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Copilot Chat
                </button>
                <button
                  onClick={() => setLeftTab('agent')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    leftTab === 'agent'
                      ? 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-[0_0_14px_var(--color-primary-glow)]'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  Agent Mode
                  <span className="text-[9px] bg-yellow-500 text-black px-1 py-0.5 rounded font-bold">NEW</span>
                </button>
              </div>

              {/* Panel */}
              <div className="flex-1 overflow-hidden">
                {leftTab === 'chat' ? (
                  <AICompanion onWriteCode={handleWriteCode} currentCode={code} currentFile={currentFile} />
                ) : (
                  <AgentPanel
                    projectFiles={project?.files || []}
                    projectId={id}
                    onApplyToEditor={handleAgentApply}
                    onFileSync={handleAgentFileSync}
                  />
                )}
              </div>
            </div>
            
            {/* Center: Workspace Explorer & Monaco Editor */}
            <div className="flex-1 flex gap-6 h-full overflow-hidden min-w-0">
              {/* Internal Project Explorer Panel (hidden on mobile) */}
              <div className="hidden sm:flex w-60 bg-bg-default/45 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shrink-0 flex-col h-full overflow-hidden shadow-2xl">
                <FileExplorer 
                  files={projectFiles}
                  currentFile={currentFile}
                  onSelectFile={handleFileChange}
                  onDeleteFile={handleDeleteFile}
                  onCreateFile={handleCreateFile}
                />
              </div>
              
              {/* Main Code Editor */}
              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <CodeEditor 
                  ref={editorComponentRef}
                  initialCode={code} 
                  currentFile={currentFile}
                  projectFiles={project?.files || []}
                  language={project?.primaryLanguage || 'python'} 
                  onExecutionStart={() => console.log('Execution started')}
                  onExecutionEnd={() => console.log('Execution ended')}
                  onChange={handleEditorChange}
                />
              </div>
            </div>
            
            {/* Right Drawer: Stats & Details */}
            {showRightSidebar ? (
              <div className="hidden lg:block w-72 shrink-0 h-full overflow-y-auto relative animate-fadeIn">
                <button 
                  onClick={() => setShowRightSidebar(false)}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-bg-hover hover:bg-white/10 text-text-muted hover:text-text-primary transition cursor-pointer"
                  title="Hide Details Sidebar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {project ? (
                  <ProjectDetails project={project} />
                ) : (
                  <ProjectDetails project={{
                    status: 'mvp',
                    total_commits: 0,
                    tech_stack: [],
                    collaborators: []
                  }} />
                )}
              </div>
            ) : (
              <div className="hidden lg:block shrink-0">
                <button
                  onClick={() => setShowRightSidebar(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-bg-default/45 border border-white/[0.08] hover:border-primary/40 text-text-muted hover:text-primary text-xs font-medium transition cursor-pointer shadow-lg"
                  title="Show Project Details & Reminders"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Details</span>
                </button>
              </div>
            )}
          </main>

          {/* ── Mobile Bottom Nav Bar (visible only on mobile) ──────────────── */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-default/90 backdrop-blur-xl border-t border-white/[0.08] px-4 py-2 flex gap-2">
            <button
              onClick={() => setMobileSheet(mobileSheet === 'chat' ? null : 'chat')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
                mobileSheet === 'chat' ? 'bg-primary/10 text-primary' : 'text-text-muted'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              Chat
            </button>
            <button
              onClick={() => setMobileSheet(mobileSheet === 'agent' ? null : 'agent')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
                mobileSheet === 'agent' ? 'bg-purple-500/10 text-purple-400' : 'text-text-muted'
              }`}
            >
              <Bot className="w-5 h-5" />
              Agent
            </button>
            <button
              onClick={() => setMobileSheet(mobileSheet === 'files' ? null : 'files')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition cursor-pointer ${
                mobileSheet === 'files' ? 'bg-blue-500/10 text-blue-400' : 'text-text-muted'
              }`}
            >
              <FolderOpen className="w-5 h-5" />
              Files
            </button>
          </div>

          {/* ── Mobile Slide-Up Sheet ────────────────────────────────────────── */}
          {mobileSheet && (
            <div
              className="md:hidden fixed inset-0 z-40 flex flex-col justify-end"
              onClick={(e) => { if (e.target === e.currentTarget) setMobileSheet(null); }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              {/* Sheet */}
              <div className="relative bg-bg-default rounded-t-3xl border-t border-white/[0.08] shadow-2xl h-[75vh] flex flex-col animate-slideUp overflow-hidden">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 overflow-hidden px-2 pb-20">
                  {mobileSheet === 'chat' && (
                    <AICompanion onWriteCode={handleWriteCode} currentCode={code} currentFile={currentFile} />
                  )}
                  {mobileSheet === 'agent' && (
                    <AgentPanel
                      projectFiles={project?.files || []}
                      projectId={id}
                      onApplyToEditor={handleAgentApply}
                      onFileSync={handleAgentFileSync}
                    />
                  )}
                  {mobileSheet === 'files' && (
                    <div className="h-full overflow-y-auto">
                      <FileExplorer
                        files={projectFiles}
                        currentFile={currentFile}
                        onSelectFile={(f) => { handleFileChange(f); setMobileSheet(null); }}
                        onDeleteFile={handleDeleteFile}
                        onCreateFile={handleCreateFile}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectWorkspace;
