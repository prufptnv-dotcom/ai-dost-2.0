import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Folder, Settings, CheckCircle, Loader2, X, Plus, RefreshCw, Mic, Trash2, GitBranch, File, Terminal, FileJson } from 'lucide-react';
import MonacoEditor from '@monaco-editor/react';

const EditorTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '#6b7280', fontStyle: 'italic' },
    { token: 'string', foreground: '#f97316' },
    { token: 'keyword', foreground: '#f472b6' },
    { token: 'number', foreground: '#fbbf24' },
    { token: 'boolean', foreground: '#f472b6' },
  ],
  colors: {
    'editor.background': '#0a0a0f',
    'editor.foreground': '#f8fafc',
    'editor.lineHighlightBackground': 'rgba(6,182,212,0.08)',
    'editor.selectionBackground': 'rgba(6,182,212,0.2)',
  },
};

export default function CopilotWorkspace({
  isOpen,
  onClose,
  initialFiles = [],
  onFileChange = () => {},
  onGenerateProject = () => {},
  userProjects = [],
  onNewProject = () => {},
}) {
  const [files, setFiles] = useState(
    initialFiles.map(f => ({ ...f, content: f.content || '' }))
  );
  const [activeFile, setActiveFile] = useState(
    initialFiles.find(f => f.path === 'main.js')?.path || 
    initialFiles[0]?.path || 
    'main.js'
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('My Project');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState(['Welcome to Waaw Copilot Workspace']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Add a new file
  const addFile = useCallback((filePath, content = '', language = 'javascript') => {
    const exists = files.some(f => f.path === filePath);
    if (!exists) {
      const newFile = { path: filePath, content, language };
      setFiles(prev => [...prev, newFile]);
      setActiveFile(filePath);
      return true;
    }
    return false;
  }, [files]);

  // Remove a file
  const removeFile = useCallback((filePath) => {
    setFiles(prev => prev.filter(f => f.path !== filePath));
    if (activeFile === filePath) {
      const remaining = files.find(f => f.path !== filePath);
      setActiveFile(remaining ? remaining.path : '');
    }
  }, [files, activeFile]);

  // Change active file
  const setActive = useCallback((filePath) => {
    setActiveFile(filePath);
  }, []);

  // Terminal command execution
  const executeTerminal = useCallback(async (command) => {
    setTerminalOutput('');
    setHistory(prev => [...prev, `> ${command}`]);
    setHistoryIndex(prev => prev + 1);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: `Run command: ${command}`,
          forceLocal: true,
        }),
      });

      const data = await res.json();
      setTerminalOutput(data.message || data.error || 'Command executed');
      setHistory(prev => [...prev, data.message || 'Command completed']);

      // If there are file changes, update
      if (data.changedFiles && Array.isArray(data.changedFiles)) {
        data.changedFiles.forEach(f => {
          addFile(f.path, f.content || '');
        });
      }

    } catch (err) {
      setTerminalOutput(`Error: ${err.message}`);
      setHistory(prev => [...prev, `Error: ${err.message}`]);
    }
  }, [addFile]);

  // Generate project from prompt
  const handleGenerateProject = useCallback(async (prompt) => {
    if (!prompt?.trim() || isGenerating) return;
    setIsGenerating(true);
    setHistory(prev => [...prev, `▶ Generating: "${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}"`]);

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          forceLocal: false,
        }),
      });

      const data = await res.json();
      setHistory(prev => [...prev, data.message || 'Generation complete']);

      if (data.newFiles && Array.isArray(data.newFiles)) {
        data.newFiles.forEach(f => addFile(f.path, f.content || ''));
        setHistory(prev => [...prev, `✅ Created ${data.newFiles.length} files`]);
      }

      if (data.terminalOutput) {
        setTerminalOutput(data.terminalOutput);
        setHistory(prev => [...prev, `📤 ${data.terminalOutput}`]);
      }

      if (data.activeFile) {
        setActiveFile(data.activeFile);
      }

      setIsGenerating(false);
    } catch (err) {
      console.error('Project generation error:', err);
      setHistory(prev => [...prev, `❌ Generation failed: ${err.message}`]);
      setIsGenerating(false);
    }
  }, [isGenerating, addFile]);

  // Save project
  const saveProject = useCallback(() => {
    // Update all file contents in state
    const projectData = files.map(f => ({
      path: f.path,
      content: f.content,
    }));
    onFileChange(projectData);
    setHistory(prev => [...prev, '💾 Project saved']);
  }, [files, onFileChange]);

  // New project modal handling
  const handleNewProject = () => {
    setShowSettings(true);
    setWorkspaceName('My Project');
  };

  const confirmNewProject = () => {
    onNewProject(workspaceName);
    setShowSettings(false);
  };

  // Render file icon based on language
  const getFileIcon = useCallback((path) => {
    const ext = path.split('.').pop().toLowerCase();
    const icons = {
      '.js': 'File',
      '.jsx': 'File',
      '.ts': 'File',
      '.tsx': 'File',
      '.py': 'File',
      '.html': 'File',
      '.css': 'File',
      '.json': 'FileJson',
      '.md': 'FileText',
      '.sh': 'Terminal',
      '.yml': 'File',
      '.yaml': 'File',
      '.gitignore': 'GitBranch',
    };
    const iconName = icons[`.${ext}`] || 'FileText';
    const iconMap = {
      'File': File,
      'FileJson': FileJson,
      'FileText': FileText,
      'Terminal': Terminal,
      'GitBranch': GitBranch,
    };
    const Icon = iconMap[iconName] || File;
    return <Icon className="w-4 h-4" />;
  }, []);

  const terminalCommand = useRef('');

  // Render
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, x: -20 }}
        animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.95, x: isOpen ? 0 : -20 }}
        exit={{ opacity: 0, scale: 0.95, x: -20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-workspace-title"
      >
        <div className="flex min-h-screen w-full max-w-5xl mx-auto"
          style={{
            background: 'rgba(10,11,18,0.9)',
            border: '1px solid rgba(6,182,212,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex border-b border-white/5 items-center justify-between px-6 py-4"
            style={{ background: 'rgba(10,11,18,0.8)' }}
          >
            <div className="flex items-center gap-3">
              <motion.h1
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xl font-bold text-white"
              >
                Copilot Workspace
              </motion.h1>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                aria-label="Close workspace"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Project button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                border: '1px solid rgba(6,182,212,0.3)',
                color: '#06b6d4',
              }}
              onClick={handleNewProject}
            >
              <Plus className="w-4 h-4" /> New Project
            </motion.button>

            {showSettings && (
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
              >
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 rounded-2xl p-6"
                  style={{ background: 'rgba(10,11,18,0.97)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <h2 className="text-xl font-bold text-white mb-4">New Project</h2>
                  <p className="text-[11px] text-[#64748b] mb-4">Enter a prompt to create your project:</p>
                  <textarea
                    placeholder="e.g. 'Create a task tracker app with React frontend and Node backend'"
                    rows={3}
                    className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-[#334155] mb-4"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={confirmNewProject}
                      className="flex-1 py-2 rounded-xl font-semibold text-white transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                        border: 'none',
                      }}
                    >
                      Create Project
                    </button>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 py-2 rounded-xl font-semibold text-white transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: '#64748b',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Main Layout: Explorer | Editor | Terminal */}
          <div className="flex h-screen w-full">
            {/* Left: File Explorer */}
            <div className="w-64 flex flex-col border-r border-white/5 overflow-y-auto"
              style={{
                background: 'rgba(10,11,18,0.8)',
                borderRight: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div className="px-3 py-3 border-b border-white/5">
                <h3 className="text-xs font-bold uppercase text-[#64748b] tracking-wider">Files</h3>
              </div>

              <div className="flex-1 space-y-1" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {/* Project name display */}
                <div className="px-3 py-2 text-sm text-[#475569] mb-3">
                  <strong>{workspaceName}</strong>
                </div>

                <div className="space-y-0.5">
                  {files.map((file, index) => (
                    <div
                      key={file.path}
                      onClick={() => setActive(file.path)}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150
                        ${activeFile === file.path
                          ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500'
                          : 'text-[#94a3b8] hover:text-white hover:bg-white/5'}
                      `}
                      style={{
                        cursor: activeFile === file.path ? 'default' : 'pointer',
                      }}
                      aria-selected={activeFile === file.path}
                    >
                      <span className="w-5 h-5 flex-shrink-0">
                        {getFileIcon(file.path)}
                      </span>
                      <span className="truncate w-max">{file.path}</span>
                    </div>
                  ))}

                  {files.length === 0 && (
                    <div className="px-3 py-2 text-center text-[10px] text-[#64748b]">
                      No files yet. Click + to create new.
                    </div>
                  )}
                </div>
              </div>

              {/* File actions bar */}
              <div className="p-3 border-t border-white/5 flex flex-col space-y-1">
                <button
                  onClick={() => addFile('main.html', '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <title>' + workspaceName + '</title>\n</head>\n<body>\n  <h1>Welcome to ' + workspaceName + '</h1>\n</body>\n</html>', 'html')}
                  className="w-full py-2 rounded-xl font-sm text-xs text-[#64748b] hover:text-white hover:bg-white/5 transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  aria-label="Create HTML file"
                >
                  <FileText className="w-3 h-3 mr-2" /> HTML File
                </button>
                <button
                  onClick={() => addFile('main.py', 'print("Hello from Waaw!")\n', 'python')}
                  className="w-full py-2 rounded-xl font-sm text-xs text-[#64748b] hover:text-white hover:bg-white/5 transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  aria-label="Create Python file"
                >
                  <File className="w-3 h-3 mr-2" /> Python File
                </button>
                <button
                  onClick={() => addFile('package.json', '{"name": "' + workspaceName + '"}', 'json')}
                  className="w-full py-2 rounded-xl font-sm text-xs text-[#64748b] hover:text-white hover:bg-white/5 transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  aria-label="Create package.json"
                >
                  <FileJson className="w-3 h-3 mr-2" /> package.json
                </button>
              </div>
            </div>

            {/* Center: Editor */}
            <div className="flex-1 flex flex-col">
              <div className="flex border-b border-white/5"
                style={{ background: 'rgba(10,11,18,0.8)' }}
              >
                <button
                  onClick={() => addFile('README.md', '# ' + workspaceName + '\n\nGenerated with Waaw AI Copilot', 'markdown')}
                  className="flex items-center gap-2 px-3 py-2 rounded-l-xl font-sm text-xs text-[#64748b] hover:text-white hover:bg-white/5 transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  aria-label="Create README"
                >
                  <FileText className="w-3 h-3 mr-2" /> README.md
                </button>
                <button
                  onClick={() => addFile('.gitignore', 'node_modules/\n.env/', 'markdown')}
                  className="flex items-center gap-2 px-3 py-2 rounded-r-xl font-sm text-xs text-[#64748b] hover:text-white hover:bg-white/5 transition-all duration-150"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  aria-label="Create .gitignore"
                >
                  <GitBranch className="w-3 h-3 mr-2" /> .gitignore
                </button>
              </div>

              {/* Monaco Editor Area */}
              <div className="flex-1 p-4 overflow-auto"
                style={{ overflow: 'auto' }}
              >
                <MonacoEditor
                  onMount={(editor, monaco) => {
                    if (editor) {
                      monaco.editor.setTheme('vs-dark');

                      const active = files.find(f => f.path === activeFile);
                      if (active) {
                        monaco.editor.setModelLanguage(editor.getModel(), active.language || 'javascript');
                      }

                      editor.onDidChangeModelContent(() => {
                        const model = editor.getModel();
                        if (model) {
                          const content = model.getValue();
                          setFiles(prev => {
                            const idx = prev.findIndex(f => f.path === activeFile);
                            if (idx !== -1) {
                              prev[idx].content = content;
                            }
                            return prev;
                          });
                        }
                      });

                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        saveProject();
                      });
                    }
                  }}
                  value={files.find(f => f.path === activeFile)?.content || ''}
                  language={files.find(f => f.path === activeFile)?.language || 'javascript'}
                  theme="vs-dark"
                  automaticLayout
                  width="100%"
                  height="100%"
                />
              </div>
            </div>

            {/* Right: Terminal & Actions */}
            <div className="w-80 flex flex-col border-l border-white/5 overflow-y-auto"
              style={{
                background: 'rgba(10,11,18,0.8)',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {/* Terminal */}
              <div className="flex-1 p-4 h-64 overflow-auto space-y-1"
                style={{ background: 'rgba(10,11,18,0.5)' }}
              >
                <div className="text-xs text-[#64748b] capitalize">Terminal</div>
                <div className="h-full overflow-y-auto space-y-0.5" role="log" aria-live="polite">
                  {history.map((item, i) => (
                    <div
                      key={i}
                      className={`text-sm ${i === history.length - 1 ? 'font-medium' : ''} transition-colors` +
                        (item.startsWith('>') ? ' text-cyan-400' : item.startsWith('❌') ? ' text-red-400' : item.startsWith('✅') ? ' text-green-400' : item.startsWith('▶') ? ' text-amber-400' : 'text-white')}
                    >
                      {item}
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={terminalCommand.current}
                      onChange={(e) => terminalCommand.current = e.target.value}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && terminalCommand.current.trim()) {
                          executeTerminal(terminalCommand.current.trim());
                          terminalCommand.current = '';
                        }
                      }}
                      className="flex-1 rounded-xl px-3 py-2 text-sm text-white placeholder-[#334155] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      placeholder="Type a command..."
                    />
                    <button
                      onClick={() => {
                        if (terminalCommand.current.trim()) {
                          executeTerminal(terminalCommand.current.trim());
                          terminalCommand.current = '';
                        }
                      }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                        border: 'none',
                        color: 'white',
                        flexShrink: 0,
                      }}
                      aria-label="Execute command"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-4 border-t border-white/5"
                style={{ background: 'rgba(10,11,18,0.5)' }}
              >
                <div className="text-xs text-[#64748b] capitalize">Quick Actions</div>
                <div className="flex flex-col space-y-1">
                  {['Create HTML', 'Create Python', 'Create JS', 'Run Tests', 'Preview Project'].map((action, i) => (
                    <button
                      key={action}
                      onClick={() => {
                        switch (action) {
                          case 'Create HTML':
                            addFile('index.html', '<!DOCTYPE html>\n<html><body><h1>Hello</h1></body></html>', 'html');
                            break;
                          case 'Create Python':
                            addFile('app.py', 'print("Hello")\n', 'python');
                            break;
                          case 'Create JS':
                            addFile('app.js', 'console.log("Hello")\n', 'javascript');
                            break;
                          case 'Run Tests':
                            executeTerminal('npm test');
                            break;
                          case 'Preview Project':
                            // Simple preview - show alert with file count
                            alert(`Preview: ${files.length} files in workspace`);
                            break;
                        }
                      }}
                      className="w-full py-2 rounded-xl font-sm text-xs transition-all duration-150"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: '#94a3b8',
                        textAlign: 'left',
                      }}
                      aria-label={action}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Project Prompt */}
              <div className="p-4 border-t border-white/5"
                style={{ background: 'rgba(10,11,18,0.5)' }}
              >
                <div className="text-xs text-[#64748b] capitalize">Generate Project</div>
                <textarea
                  placeholder="e.g. 'Create a task tracker with React, Node, and SQLite'"
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-[#334155] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.trim() && isGenerating === false) {
                      handleGenerateProject(val);
                    }
                  }}
                />
                <button
                  onClick={() => handleGenerateProject(textareaRef?.current?.value || '')}
                  className="mt-2 w-full py-2 rounded-xl font-sm text-white transition-all duration-150"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                    border: 'none',
                    marginTop: '0.5rem',
                  }}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate Full-Stack Project'}
                </button>
              </div>
            </div>
          </div>

          {/* Floating save button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
              boxShadow: '0 12px 32px rgba(6,182,212,0.4)',
            }}
            onClick={saveProject}
            aria-label="Save project"
          >
            <RefreshCw className="w-6 h-6 text-white" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}