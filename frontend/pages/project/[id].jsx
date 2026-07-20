import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { AiOutlineFile, AiOutlineFolder, AiOutlinePlus, AiOutlineDelete, AiOutlineClose } from 'react-icons/ai';
import CodeEditor from '../../components/CodeEditor';
import ProjectDetails from '../../components/ProjectDetails';
import AICompanion from '../../components/AICompanion';
import Header from '../../components/Header';
import { fetchProject, addProjectFile, deleteProjectFile, saveProjectFile } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import FileExplorer from '../../components/FileExplorer';
import { useMode } from '../../context/ModeContext';

const ProjectWorkspace = () => {
  const router = useRouter();
  const { id } = router.query;
  const { mode } = useMode();
  const [project, setProject] = useState(null);
  const [currentFile, setCurrentFile] = useState('main.py');
  const [code, setCode] = useState('');
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

  const handleWriteCode = (newCode) => {
    setCode(newCode);
    handleEditorChange(newCode);
    showToast({ type: 'success', message: 'Code updated by AI Dost!' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-default text-text-primary flex items-center justify-center">
        <div className="text-primary font-bold text-lg animate-pulse">Loading Workspace...</div>
      </div>
    );
  }

  const projectFiles = project?.files || [
    { path: 'main.py', content: '# Write your code here...\n\nprint("Hello from AI-Dost sandbox!")\n' }
  ];

  return (
    <div className="min-h-screen bg-bg-default text-text-primary flex flex-col h-screen overflow-hidden">
      <Header />
      
      {mode === 'chat' ? (
        <div className="flex-1 flex pt-24 px-6 pb-6 max-w-4xl mx-auto w-full justify-center h-[calc(100vh-24px)] overflow-hidden">
          <div className="w-full max-w-2xl h-full overflow-hidden pb-4">
            <AICompanion onWriteCode={handleWriteCode} currentCode={code} currentFile={currentFile} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex pt-24 px-6 gap-6 h-[calc(100vh-24px)] pb-6 overflow-hidden max-w-[1600px] mx-auto w-full">
          {/* Left Drawer: AI Companion */}
          <div className="hidden md:block w-80 shrink-0 h-full overflow-hidden">
            <AICompanion onWriteCode={handleWriteCode} currentCode={code} currentFile={currentFile} />
          </div>
          
          {/* Center: Workspace Explorer & Monaco Editor */}
          <div className="flex-1 flex gap-6 h-full overflow-hidden min-w-0">
            {/* Internal Project Explorer Panel */}
            <div className="w-60 bg-bg-hover border border-secondary/10 rounded-xl p-4 shrink-0 flex flex-col h-full overflow-hidden">
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
          
          {/* Right Drawer: Stats & Collaborators */}
          <div className="hidden lg:block w-72 shrink-0 h-full overflow-y-auto">
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
        </div>
      )}
    </div>
  );
};

export default ProjectWorkspace;
