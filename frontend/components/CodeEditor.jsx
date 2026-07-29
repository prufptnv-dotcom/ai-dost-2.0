import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { FaTerminal, FaPlay, FaUndo, FaLightbulb, FaEye } from 'react-icons/fa';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import api, { executeCode } from '../services/api';
import { calculateOperations, applyOperations } from '../lib/ot';
import AISuggestionPanel from './AISuggestionPanel';

const languageOptions = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'java', label: 'Java' }
];

function detectLanguage(filename) {
  if (!filename) return 'javascript';
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'js': return 'javascript';
    case 'jsx': return 'javascript';
    case 'json': return 'json';
    case 'py': return 'python';
    case 'java': return 'java';
    default: return 'javascript';
  }
}

const CodeEditor = ({ initialCode = '', currentFile = '', projectFiles = [], language = 'python', onExecutionStart, onExecutionEnd, onChange }) => {
  const [code, setCode] = useState(initialCode);
  const [executionResult, setExecutionResult] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [showPreview, setShowPreview] = useState(false);
  
  // Interactive terminal states
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([
    'Welcome to AI-Dost Sandbox Terminal!',
    'Type a command (e.g. "python main.py", "node main.js") or type "help" to start.',
    ''
  ]);
  const terminalEndRef = useRef(null);
  
  // AI Suggestions states
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionPos, setSuggestionPos] = useState(null);
  
  // AI Selection Edit states
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  const [originalCodeSelection, setOriginalCodeSelection] = useState('');
  const [proposedCodeSelection, setProposedCodeSelection] = useState('');
  const [aiEditModel, setAiEditModel] = useState('groq');

  const { showToast } = useToast();
  const { socket, sendMessage } = useSocket();
  
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const suggestionTimeoutRef = useRef(null);

  const handleOpenAiEdit = () => {
    if (!editorRef.current) {
      showToast({ type: 'warning', message: 'Editor mount hone ka wait karein!' });
      return;
    }
    const selection = editorRef.current.getSelection();
    if (!selection || selection.isEmpty()) {
      showToast({ type: 'warning', message: 'Kripya editor me code select karein jise AI se edit karwana hai!' });
      return;
    }
    const model = editorRef.current.getModel();
    const selectedText = model.getValueInRange(selection);
    
    setOriginalCodeSelection(selectedText);
    setProposedCodeSelection('');
    setAiEditPrompt('');
    setShowAiEdit(true);
  };

  const handleGenerateAiEdit = async () => {
    if (!aiEditPrompt.trim()) return;
    setIsGeneratingEdit(true);
    try {
      const customKeys = {
        gemini: localStorage.getItem('customGeminiKey') || '',
        groq: localStorage.getItem('customGroqKey') || '',
        deepseek: localStorage.getItem('customDeepSeekKey') || '',
        nvidia: localStorage.getItem('customNvidiaKey') || '',
        openrouter: localStorage.getItem('customOpenRouterKey') || ''
      };

      const systemInstruction = `You are a precise code refactoring assistant. Modify the following code based on the instructions. Return ONLY the modified code. DO NOT include markdown code blocks (\`\`\`), explanation, or other text.`;
      
      const payload = {
        message: `${systemInstruction}\n\nInstructions: ${aiEditPrompt}\n\nCode to modify:\n${originalCodeSelection}`,
        model: aiEditModel,
        mode: 'chat',
        customKeys: customKeys
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.reply) {
        let cleanCode = data.reply;
        if (cleanCode.startsWith('```')) {
          const firstNewline = cleanCode.indexOf('\n');
          if (firstNewline !== -1) {
            cleanCode = cleanCode.substring(firstNewline + 1);
          }
          if (cleanCode.endsWith('```')) {
            cleanCode = cleanCode.substring(0, cleanCode.length - 3);
          }
        }
        setProposedCodeSelection(cleanCode.trim());
      } else {
        showToast({ type: 'error', message: data.error || 'Failed to edit code.' });
      }
    } catch (error) {
      console.error('AI Edit failed:', error);
      showToast({ type: 'error', message: 'Network error occurred while calling AI.' });
    } finally {
      setIsGeneratingEdit(false);
    }
  };

  const handleApplyAiEdit = () => {
    if (!editorRef.current || !monacoRef.current) return;
    const selection = editorRef.current.getSelection();
    if (!selection) return;

    const range = new monacoRef.current.Range(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.endColumn
    );

    const id = { major: 1, minor: 1 };
    const text = proposedCodeSelection || originalCodeSelection;
    const op = { identifier: id, range: range, text: text, forceMoveMarkers: true };

    editorRef.current.executeEdits("ai-edit", [op]);
    setShowAiEdit(false);
    showToast({ type: 'success', message: 'AI Code Refactor successfully applied!' });
  };

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (currentFile) {
      const detected = detectLanguage(currentFile);
      setSelectedLanguage(detected);
    } else {
      setSelectedLanguage(language);
    }
  }, [currentFile, language]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll terminal output to bottom on updates
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalHistory]);
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'document_update' && data.changes) {
          const updatedText = applyOperations(code, data.changes);
          if (updatedText !== code) {
            setCode(updatedText);
          }
        }
      } catch (e) {
        console.error('Failed processing inbound socket message:', e);
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, code]);

  const triggerSuggestions = (content) => {
    if (!editorRef.current) return;
    
    // Clear previous suggestion timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    suggestionTimeoutRef.current = setTimeout(async () => {
      try {
        const editor = editorRef.current;
        const position = editor.getPosition();
        if (!position) return;

        const model = editor.getModel();
        if (!model) return;
        
        // Fetch last 5 lines around the cursor for context
        const startLine = Math.max(1, position.lineNumber - 5);
        const endLine = position.lineNumber;
        const codeContext = model.getValueInRange({
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: position.column
        });

        // Skip suggestions request if context is empty
        if (!codeContext.trim()) {
          setSuggestions([]);
          setSuggestionPos(null);
          return;
        }

        const res = await api.post('/ai/code-suggestions', {
          code_context: codeContext,
          language: selectedLanguage,
          project_id: 'current-project-id'
        });

        if (res.data && res.data.suggestions && res.data.suggestions.length > 0) {
          const validSuggestions = res.data.suggestions.filter(s => s.code);
          setSuggestions(validSuggestions);
          
          // Get screen coordinates to display floating box
          const coords = editor.getScrolledVisiblePosition(position);
          if (coords) {
            setSuggestionPos({
              top: coords.top + 45,
              left: coords.left + 60
            });
          }
        } else {
          setSuggestions([]);
          setSuggestionPos(null);
        }
      } catch (error) {
        console.error('AI code suggestions failed:', error);
        setSuggestions([]);
        setSuggestionPos(null);
      }
    }, 1200); // 1.2s debounce to let user finish typing line
  };

  const handleEditorChange = (newContent) => {
    const content = newContent || '';
    if (content !== code) {
      setCode(content);
      
      // Send changes over WebSocket
      const changes = calculateOperations(code, content);
      sendMessage({
        type: 'document_update',
        doc_id: 'main.py',
        changes
      });

      // Trigger AI autocomplete check
      triggerSuggestions(content);

      // Trigger parent onChange callback
      onChange && onChange(content);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor changes and emit positions to other collaborators
    editor.onDidChangeCursorPosition((e) => {
      sendMessage({
        type: 'cursor_move',
        position: {
          lineNumber: e.position.lineNumber,
          column: e.position.column
        }
      });
      // Clear panel when cursor moves manually
      setSuggestions([]);
      setSuggestionPos(null);
    });
  };

  const handleAcceptSuggestion = (suggestion) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const selection = editor.getSelection();
    if (!selection) return;

    const range = new monaco.Range(
      selection.startLineNumber,
      selection.startColumn,
      selection.endLineNumber,
      selection.endColumn
    );
    
    editor.executeEdits('ai-suggestions', [
      {
        range: range,
        text: suggestion.code,
        forceMoveMarkers: true
      }
    ]);
    
    setCode(editor.getValue());
    setSuggestions([]);
    setSuggestionPos(null);
    showToast({ type: 'success', message: 'Applied suggestion' });
  };

  const runSandboxCode = async (lang) => {
    if (isExecuting) return;
    setIsExecuting(true);
    onExecutionStart && onExecutionStart();
    setTerminalHistory(prev => [...prev, 'Running code in secure sandbox...']);
    
    try {
      const executionData = {
        language: lang || selectedLanguage,
        code,
        dependencies: []
      };
      
      const response = await executeCode(executionData);
      const out = (response.stdout || '') + (response.stderr || '');
      setTerminalHistory(prev => [...prev, out || '(No output returned)']);
      setExecutionResult(out);
      showToast({ type: 'success', message: 'Execution complete' });
    } catch (error) {
      setTerminalHistory(prev => [...prev, `Error: ${error.message}`]);
      setExecutionResult(`Error: ${error.message}`);
      showToast({ type: 'error', message: 'Code execution failed' });
    } finally {
      setIsExecuting(false);
      onExecutionEnd && onExecutionEnd();
    }
  };

  const handleRun = () => {
    runSandboxCode(selectedLanguage);
  };

  const handleTerminalSubmit = async (e) => {
    if (e.key !== 'Enter') return;
    const cmd = terminalInput.trim();
    if (!cmd) return;

    setTerminalHistory(prev => [...prev, `visitor@ai-dost:~ $ ${cmd}`]);
    setTerminalInput('');

    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (command === 'clear') {
      setTerminalHistory([]);
      return;
    }

    if (command === 'help') {
      setTerminalHistory(prev => [
        ...prev,
        'AI-Dost Interactive Sandbox Shell. Available commands:',
        '  ls                 - List files in current project directory',
        '  cat <filename>     - Display file contents',
        '  python <filename>  - Execute Python program',
        '  node <filename>    - Execute Node.js program',
        '  pwd                - Print current working directory',
        '  whoami             - Show active terminal user',
        '  date               - Print system date',
        '  clear              - Clear terminal history',
        '  help               - Display commands helper log'
      ]);
      return;
    }

    if (command === 'pwd') {
      setTerminalHistory(prev => [...prev, '/home/visitor/workspace']);
      return;
    }

    if (command === 'whoami') {
      setTerminalHistory(prev => [...prev, 'visitor']);
      return;
    }

    if (command === 'date') {
      setTerminalHistory(prev => [...prev, new Date().toString()]);
      return;
    }

    if (command === 'ls') {
      if (!projectFiles || projectFiles.length === 0) {
        setTerminalHistory(prev => [...prev, '(empty directory)']);
      } else {
        const fileList = projectFiles.map(f => {
          const size = f.content ? f.content.length : 0;
          return `${f.path.padEnd(20)} ${size} bytes`;
        });
        setTerminalHistory(prev => [...prev, ...fileList]);
      }
      return;
    }

    if (command === 'cat') {
      const filename = args[0];
      if (!filename) {
        setTerminalHistory(prev => [...prev, 'Usage: cat <filename>']);
        return;
      }
      const file = projectFiles.find(f => f.path.toLowerCase() === filename.toLowerCase());
      if (file) {
        setTerminalHistory(prev => [...prev, file.content || '(empty file)']);
      } else {
        setTerminalHistory(prev => [...prev, `cat: ${filename}: No such file or directory`]);
      }
      return;
    }

    if (command === 'python') {
      const filename = args[0];
      if (!filename) {
        await runSandboxCode('python');
        return;
      }
      const file = projectFiles.find(f => f.path.toLowerCase() === filename.toLowerCase());
      if (file) {
        setIsExecuting(true);
        onExecutionStart && onExecutionStart();
        setTerminalHistory(prev => [...prev, `Running ${filename} with Python 3...`]);
        try {
          const response = await executeCode({ language: 'python', code: file.content || '' });
          const out = (response.stdout || '') + (response.stderr || '');
          setTerminalHistory(prev => [...prev, out || '(No output returned)']);
        } catch (err) {
          setTerminalHistory(prev => [...prev, `Error: ${err.message}`]);
        } finally {
          setIsExecuting(false);
          onExecutionEnd && onExecutionEnd();
        }
      } else {
        setTerminalHistory(prev => [...prev, `python: can't open file '${filename}': [Errno 2] No such file or directory`]);
      }
      return;
    }

    if (command === 'node') {
      const filename = args[0];
      if (!filename) {
        await runSandboxCode('javascript');
        return;
      }
      const file = projectFiles.find(f => f.path.toLowerCase() === filename.toLowerCase());
      if (file) {
        setIsExecuting(true);
        onExecutionStart && onExecutionStart();
        setTerminalHistory(prev => [...prev, `Running ${filename} with Node.js...`]);
        try {
          const response = await executeCode({ language: 'javascript', code: file.content || '' });
          const out = (response.stdout || '') + (response.stderr || '');
          setTerminalHistory(prev => [...prev, out || '(No output returned)']);
        } catch (err) {
          setTerminalHistory(prev => [...prev, `Error: ${err.message}`]);
        } finally {
          setIsExecuting(false);
          onExecutionEnd && onExecutionEnd();
        }
      } else {
        setTerminalHistory(prev => [...prev, `node: internal/modules/cjs/loader.js: Cannot find module '${filename}'`]);
      }
      return;
    }

    // Mock npm install and git status/commits
    if (command === 'npm') {
      setTerminalHistory(prev => [...prev, 'npm notice ', 'npm notice Beginning fake dependency analysis...', 'npm WARN sandbox No package.json found. System auto-injected global mock node modules successfully!']);
      return;
    }

    if (command === 'git') {
      setTerminalHistory(prev => [...prev, 'On branch main', 'Your branch is up to date with \'origin/main\'.', 'nothing to commit, working tree clean']);
      return;
    }

    setTerminalHistory(prev => [
      ...prev,
      `bash: ${command}: command not found`,
      `Type "help" to view list of active sandbox terminal commands.`
    ]);
  };

  const getPreviewDoc = () => {
    if (selectedLanguage === 'html') {
      return code;
    }
    if (selectedLanguage === 'css') {
      return `<html><head><style>${code}</style></head><body style="background: #121212; color: #fff; font-family: sans-serif; padding: 20px;"><h2>CSS Style Preview</h2><p>This is a style simulation.</p></body></html>`;
    }
    if (selectedLanguage === 'javascript') {
      return `
        <html>
          <head>
            <script>
              const logs = [];
              console.log = (...args) => {
                logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
                const outEl = document.getElementById('console-out');
                if (outEl) outEl.innerText = logs.join('\\n');
              };
              window.onerror = (err) => {
                console.log('Error:', err);
              };
            </script>
          </head>
          <body style="background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 12px; margin: 0;">
            <h4 style="color: #00bcd4; margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 4px;">JS Console Output</h4>
            <pre id="console-out" style="white-space: pre-wrap; font-size: 13px;">Running code...</pre>
            <script>
              try {
                ${code}
              } catch(e) {
                console.log('Exception:', e.message);
              }
            </script>
          </body>
        </html>
      `;
    }
    return `
      <html>
        <body style="background: #1e1e1e; color: #888; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <p>Preview not supported for ${selectedLanguage}. Please run it using the sandbox terminal.</p>
        </body>
      </html>
    `;
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg-default border border-secondary/10 rounded-xl overflow-hidden relative">
      <div className="flex items-center p-3 border-b border-secondary/10 bg-bg-hover">
        <div className="text-xs text-text-secondary font-semibold bg-bg-default border border-secondary/20 px-3 py-2 rounded-lg flex items-center gap-1.5 select-text">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Language: <span className="capitalize font-bold text-primary">{selectedLanguage}</span>
        </div>
        
        {/* Collaborative Active Presence Row */}
        <div className="flex items-center -space-x-1.5 overflow-hidden ml-3 select-none">
          <div className="w-5 h-5 rounded-full border border-bg-default bg-primary text-bg-default text-[9px] font-bold flex items-center justify-center shadow" title="Vikash (You)">V</div>
          <div className="w-5 h-5 rounded-full border border-bg-default bg-secondary text-text-primary text-[9px] font-bold flex items-center justify-center shadow" title="AI-Dost Companion">AD</div>
          <div className="w-5 h-5 rounded-full border border-bg-default bg-emerald-500 text-bg-default text-[9px] font-bold flex items-center justify-center shadow animate-pulse" title="Active Collaboration Socket Session">●</div>
        </div>
        <div className="flex items-center ml-auto space-x-2">
          <button 
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold border border-secondary/30 text-text-secondary hover:bg-secondary/10 hover:border-primary/50 transition cursor-pointer"
            onClick={handleOpenAiEdit}
            title="🪄 AI Refactor Selection"
          >
            <span>🪄 AI Edit</span>
          </button>
          <button 
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold border transition cursor-pointer ${
              showPreview
                ? 'bg-primary/20 border-primary text-primary' 
                : 'border-secondary/30 text-text-secondary hover:bg-secondary/10'
            }`}
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle Live Code Preview"
          >
            <FaEye className="text-xs" />
            <span>{showPreview ? 'Hide Preview' : 'Preview'}</span>
          </button>
          <button 
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              isExecuting 
                ? 'bg-warning/20 border border-warning text-warning animate-pulse' 
                : 'bg-primary border border-primary text-bg-default hover:bg-transparent hover:text-primary'
            }`}
            onClick={handleRun}
            disabled={isExecuting}
          >
            <FaPlay className="text-xs" /> 
            <span>{isExecuting ? 'Running...' : 'Run'}</span>
          </button>
          <button 
            className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold border border-secondary/30 text-text-secondary hover:bg-secondary/10 transition cursor-pointer"
            onClick={() => setCode('')}
          >
            <FaUndo className="text-xs" /> 
            <span>Clear</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 min-h-[300px] relative flex">
        <div className={`flex-1 h-full relative ${showPreview ? 'w-1/2 border-r border-secondary/10' : 'w-full'}`}>
          <Editor
            height="100%"
            language={selectedLanguage}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
              automaticLayout: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderWhitespace: 'all',
              wordWrap: 'on',
              fontSize: 14,
            }}
          />

          <AISuggestionPanel 
            suggestions={suggestions}
            position={suggestionPos}
            onAccept={handleAcceptSuggestion}
            onClose={() => {
              setSuggestions([]);
              setSuggestionPos(null);
            }}
          />

          {showAiEdit && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-45 flex flex-col p-6 overflow-y-auto select-text text-text-primary">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <span>🪄 AI Code Refactor & Edit</span>
                </div>
                <button 
                  onClick={() => setShowAiEdit(false)}
                  className="text-text-secondary hover:text-text-primary text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary">Model:</span>
                  <select 
                    value={aiEditModel}
                    onChange={(e) => setAiEditModel(e.target.value)}
                    className="bg-bg-default text-text-primary border border-secondary/30 rounded p-1 text-[11px] outline-none font-semibold cursor-pointer"
                  >
                    <option value="groq">🦙 Groq (Llama 3)</option>
                    <option value="gemini">♊ Gemini 2.0 Flash</option>
                    <option value="deepseek">🐳 DeepSeek V3</option>
                    <option value="nvidia">💚 NVIDIA NIM</option>
                    <option value="openrouter">🪐 OpenRouter</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-text-secondary font-semibold">Instructions:</label>
                  <textarea
                    rows="3"
                    value={aiEditPrompt}
                    onChange={(e) => setAiEditPrompt(e.target.value)}
                    placeholder="Enter instructions (e.g., 'optimize this loop', 'convert this to JavaScript', 'add try-catch block'...)"
                    className="bg-bg-hover border border-secondary/30 text-text-primary rounded-lg p-2.5 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none font-sans"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateAiEdit}
                    disabled={isGeneratingEdit || !aiEditPrompt.trim()}
                    className="px-4 py-2 bg-primary text-bg-default hover:bg-primary/80 disabled:opacity-50 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    {isGeneratingEdit ? 'Analyzing & Coding...' : '🪄 Generate Code'}
                  </button>
                </div>

                {proposedCodeSelection && (
                  <div className="flex-1 flex flex-col gap-2 min-h-[250px] mt-2">
                    <div className="text-xs text-success font-semibold">✨ Proposed Replacement Code:</div>
                    <div className="flex-1 grid grid-cols-2 gap-4 border border-secondary/15 rounded-lg overflow-hidden h-[250px] bg-bg-default">
                      <div className="flex flex-col h-full overflow-hidden">
                        <div className="bg-red-500/10 border-b border-red-500/20 px-3 py-1.5 text-[10px] text-red-400 font-bold select-none shrink-0">Original Code</div>
                        <pre className="flex-1 p-3 bg-red-950/5 text-red-200 text-xs overflow-auto font-mono whitespace-pre text-left">{originalCodeSelection}</pre>
                      </div>
                      <div className="flex flex-col h-full border-l border-secondary/15 overflow-hidden">
                        <div className="bg-success/10 border-b border-success/20 px-3 py-1.5 text-[10px] text-success font-bold select-none shrink-0">Proposed Code</div>
                        <pre className="flex-1 p-3 bg-success-950/5 text-success-200 text-xs overflow-auto font-mono whitespace-pre text-left">{proposedCodeSelection}</pre>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 mt-3">
                      <button
                        onClick={() => setProposedCodeSelection('')}
                        className="px-4 py-2 border border-secondary/20 hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleApplyAiEdit}
                        className="px-4 py-2 bg-success text-bg-default hover:bg-success/80 rounded-lg text-xs font-bold transition cursor-pointer shadow-md shadow-success/20"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showPreview && (
          <div className="w-1/2 h-full bg-[#1e1e1e] flex flex-col relative select-text">
            <div className="absolute top-2 right-2 z-10 bg-black/60 px-2 py-1 rounded text-[10px] text-text-secondary pointer-events-none">
              Live Sandbox Preview
            </div>
            <iframe 
              srcDoc={getPreviewDoc()} 
              title="Live Code Preview Frame"
              className="w-full h-full border-none bg-white"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </div>
      
      <div className="p-4 bg-bg-hover border-t border-secondary/10 flex flex-col h-[200px]">
        <div className="flex items-center mb-1.5 shrink-0 justify-between select-none">
          <div className="flex items-center">
            <FaTerminal className="mr-2 text-primary" />
            <span className="text-sm font-semibold text-primary">Terminal Execution Console</span>
            {isExecuting && (
              <span className="ml-2 w-2 h-2 rounded-full bg-warning animate-ping" />
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(terminalHistory.join('\n'));
                showToast({ type: 'success', message: 'Terminal output logs copied!' });
              }}
              className="px-2 py-0.5 border border-secondary/20 hover:bg-secondary/10 text-[10px] text-text-secondary hover:text-text-primary rounded transition-colors cursor-pointer"
              title="Copy all logs"
            >
              Copy Logs
            </button>
            <button
              onClick={() => setTerminalHistory(['Console cleared.', ''])}
              className="px-2 py-0.5 border border-secondary/20 hover:bg-secondary/10 text-[10px] text-text-secondary hover:text-text-primary rounded transition-colors cursor-pointer"
              title="Clear output logs"
            >
              Clear Console
            </button>
          </div>
        </div>
        <div className="flex-1 text-xs text-text-secondary font-mono bg-bg-default border border-secondary/10 p-3 rounded-lg overflow-y-auto flex flex-col justify-between select-text">
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {terminalHistory.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap">{line}</div>
            ))}
            <div ref={terminalEndRef} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-2 border-t border-secondary/5 mt-1">
            <span className="text-primary font-bold">visitor@ai-dost:~ $</span>
            <input 
              type="text"
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyDown={handleTerminalSubmit}
              className="flex-1 bg-transparent text-text-primary focus:outline-none border-none text-xs font-mono p-0"
              placeholder="Type command here (e.g. 'python main.py' or 'help')..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
