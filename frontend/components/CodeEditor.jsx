import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import Editor from '@monaco-editor/react';
import { Terminal, Play, RotateCcw, Eye, EyeOff, Wand2, X, Copy, Trash2, Loader2, GitBranch, ShieldCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import api, { executeCode, API_HOST } from '../services/api';
import { calculateOperations, applyOperations } from '../lib/ot';
import AISuggestionPanel from './AISuggestionPanel';
import GitControlModal from './GitControlModal';
import CodeReviewModal from './CodeReviewModal';

const languageOptions = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'java', label: 'Java' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'bash', label: 'Bash' },
  { value: 'dockerfile', label: 'Dockerfile' }
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

const CodeEditor = React.forwardRef(({ initialCode = '', currentFile = '', projectFiles = [], language = 'python', onExecutionStart, onExecutionEnd, onChange }, ref) => {
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
  
  // Terminal WebSocket reference
  const terminalWs = useRef(null);
  const [terminalConnected, setTerminalConnected] = useState(false);

  // Initialize Terminal WebSocket
  useEffect(() => {
    let ws = null;
    const connectTerminalWs = () => {
      // Use standard WebSocket
      const wsUrl = process.env.NEXT_PUBLIC_GO_WS_URL || 'ws://127.0.0.1:5000';
      const wsEndpoint = wsUrl.replace('ws://', 'ws://').replace('http://', 'ws://') + '/api/terminal/ws';
      
      try {
        ws = new WebSocket(wsEndpoint);
        
        ws.onopen = () => {
          setTerminalConnected(true);
          setTerminalHistory(prev => [...prev, 'Connected to Live Terminal (WebSocket). Try running a server!']);
        };
        
        ws.onmessage = (event) => {
          setTerminalHistory(prev => {
            const lines = event.data.split(/\r?\n/);
            // Replace the last line if it's just appending, or add new lines
            // For simplicity, just append
            return [...prev, ...lines.filter(l => l.trim() !== '')];
          });
        };
        
        ws.onclose = () => {
          setTerminalConnected(false);
          // Optional: reconnect logic here
        };
        
        ws.onerror = (err) => {
          console.error('Terminal WS Error:', err);
        };
        
        terminalWs.current = ws;
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
      }
    };
    
    connectTerminalWs();
    
    return () => {
      if (ws) ws.close();
    };
  }, []);
  
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
  const [diagnostics, setDiagnostics] = useState({});
  const [gitStatus, setGitStatus] = useState('none');
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const { showToast } = useToast();
  const { socket, sendMessage, collaborators, remoteCursors } = useSocket();
  
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

      const res = await fetch(`${API_HOST}/api/chat`, {
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

        // Fetch agentic suggestions from backend
        let validSuggestions = [];
        try {
          const res = await api.post('/ai/code-suggestions', {
            code_context: codeContext,
            language: selectedLanguage,
            project_id: 'current-project-id'
          });
          if (res.data && res.data.suggestions && res.data.suggestions.length > 0) {
            validSuggestions = res.data.suggestions.filter(s => s.code);
          }
        } catch (e) {
          // Fallback ghost suggestion
          validSuggestions = [{ code: "    # Copilot Ghost Suggestion\n    return True", label: "Auto-complete" }];
        }

        if (validSuggestions.length > 0) {
          setSuggestions(validSuggestions);
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
    }, 1000); // 1.0s debounce for ghost typing
  };

const handleEditorChange = (newContent) => {
    const content = newContent || '';
    if (content !== code) {
      setCode(content);
      
      // Send changes over WebSocket
      const changes = calculateOperations(code, content);
      sendMessage({
        type: 'document_update',
        doc_id: currentFile || 'default',
        changes
      });
      
      // Trigger AI autocomplete check
      triggerSuggestions(content);
      
      // Post diagnostics to LSP backend
      if (currentFile) {
        api.post('/ai/lsp-diagnostics', {
          code_context: content,
          language: selectedLanguage,
          project_id: currentFile
        }).catch(() => {/* Silently handle LSP errors */});
      }
      
      // Trigger parent onChange callback
      onChange && onChange(content);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Connect to LSP Proxy via WebSocket for true LSP diagnostics
    try {
      const wsUrl = process.env.NEXT_PUBLIC_BACKEND_URL ? process.env.NEXT_PUBLIC_BACKEND_URL.replace('http', 'ws') : 'ws://localhost:5000';
      const lspSocket = new WebSocket(`${wsUrl}/lsp`);
      
      lspSocket.onopen = () => {
        console.log('🔗 LSP Connected');
        // Send LSP Initialize
        lspSocket.send(JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'initialize',
          params: { rootUri: null, capabilities: {} }
        }));
      };

      lspSocket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.method === 'textDocument/publishDiagnostics') {
            const markers = data.params.diagnostics.map(d => ({
              severity: d.severity === 1 ? monaco.MarkerSeverity.Error : 
                        d.severity === 2 ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
              startLineNumber: d.range.start.line + 1,
              startColumn: d.range.start.character + 1,
              endLineNumber: d.range.end.line + 1,
              endColumn: d.range.end.character + 1,
              message: d.message,
              source: d.source
            }));
            const model = editor.getModel();
            if (model) monaco.editor.setModelMarkers(model, 'lsp', markers);
          }
        } catch (e) {}
      };

      // When code changes, send textDocument/didChange
      editor.onDidChangeModelContent(() => {
        if (lspSocket.readyState === WebSocket.OPEN) {
          const content = editor.getValue();
          lspSocket.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'textDocument/didChange',
            params: {
              textDocument: { uri: `inmemory://model/1`, version: Date.now() },
              contentChanges: [{ text: content }]
            }
          }));
        }
      });
    } catch (e) {
      console.warn('LSP Init Failed:', e);
    }

    if (code) {
      editor.setValue(code);
    }

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

    // Register Native Monaco Ghost Text Autocomplete Provider
    try {
      const supportedLanguages = ['python', 'javascript', 'typescript', 'html', 'css', 'java', 'go', 'rust', 'c', 'cpp', 'json', 'yaml', 'bash', 'dockerfile'];
      const editorModel = editor.getModel();
      if (!editorModel || !supportedLanguages.includes(editorModel.getLanguageId())) {
        return;
      }
      monaco.languages.registerInlineCompletionsProvider(editorModel.getLanguageId(), {
        provideInlineCompletions: async (model, position) => {
          const lineContent = model.getLineContent(position.lineNumber);
          // Trigger ghost completion only if typing at line end or after 2 characters
          if (position.column < 3 && !lineContent.trim()) {
            return { items: [] };
          }

          try {
            const startLine = Math.max(1, position.lineNumber - 5);
            const codeContext = model.getValueInRange({
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: Math.max(position.column, 1)
            });

            const res = await api.post('/ai/code-suggestions', {
              code_context: codeContext,
              language: model.getLanguageId(),
              project_id: 'current-project-id'
            });

            if (res.data && res.data.suggestions && res.data.suggestions.length > 0) {
              const items = res.data.suggestions.map(s => ({
                insertText: s.code,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column + 1
                ),
                // Ghost text label - displayed by Monaco
                label: s.label || s.code.substring(0, 50) || 'Suggestion'
              }));
              return { items };
            }
          } catch (e) {
            console.warn('AI code suggestions failed:', e);
          }

          return { items: [] };
        },
        freeInlineCompletions: () => {},
        disposeInlineCompletions: () => {}
      });
    } catch(err) {
      console.warn("Monaco inline completion registration info:", err);
    }
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

  const [lastErrorLog, setLastErrorLog] = useState('');

  const runSandboxCode = async (lang) => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLastErrorLog('');
    onExecutionStart && onExecutionStart();
    setTerminalHistory(prev => [...prev, 'Running code in Live Terminal...']);
    
    try {
      if (terminalWs.current && terminalWs.current.readyState === WebSocket.OPEN) {
        // Send a command to run the script via terminal
        let runCmd = '';
        const runLang = lang || selectedLanguage;
        const filename = currentFile?.split('/').pop() || 'script';
        
        if (runLang === 'python' || runLang === 'py') {
          runCmd = `python ${filename}`;
        } else if (runLang === 'javascript' || runLang === 'js') {
          runCmd = `node ${filename}`;
        } else {
          runCmd = `echo Cannot execute ${runLang} natively.`;
        }
        
        terminalWs.current.send(runCmd + '\n');
        showToast({ type: 'success', message: 'Execution started in terminal' });
      } else {
        setTerminalHistory(prev => [...prev, 'Error: Terminal is not connected.']);
      }
    } catch (error) {
      setTerminalHistory(prev => [...prev, `Error: ${error.message}`]);
      showToast({ type: 'error', message: 'Execution request failed' });
    } finally {
      setIsExecuting(false);
      onExecutionEnd && onExecutionEnd();
    }
  };

  useImperativeHandle(ref, () => ({
    runSandboxCode: (lang) => runSandboxCode(lang),
    togglePreview: (val) => setShowPreview(val !== undefined ? val : true),
    // Option B: Monaco Live Diff Highlights — called by [id].jsx after agent applies changes
    flashDiffHighlight: (newContent) => {
      if (!editorRef.current || !monacoRef.current) return;
      const monaco = monacoRef.current;
      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model) return;
      const oldContent = model.getValue();
      const oldLines = oldContent.split('\n');
      const newLines = (newContent || '').split('\n');
      // Find changed line numbers
      const changedLines = [];
      const maxLen = Math.max(oldLines.length, newLines.length);
      for (let i = 0; i < maxLen; i++) {
        if (oldLines[i] !== newLines[i]) changedLines.push(i + 1);
      }
      if (changedLines.length === 0) return;
      // Add green glow decorations on changed lines
      const decorations = changedLines.map(lineNum => ({
        range: new monaco.Range(lineNum, 1, lineNum, 1),
        options: {
          isWholeLine: true,
          className: 'agent-diff-highlight',
          glyphMarginClassName: 'agent-diff-glyph'
        }
      }));
      const decorationIds = editor.deltaDecorations([], decorations);
      // Fade out after 3 seconds
      setTimeout(() => {
        try { editor.deltaDecorations(decorationIds, []); } catch (_) {}
      }, 3000);
    }
  }));

  const handleRun = () => {
    runSandboxCode(selectedLanguage);
  };

  const handleTerminalSubmit = async (e) => {
    if (e.key !== 'Enter') return;
    const cmd = terminalInput.trim();
    if (!cmd) return;

    setTerminalHistory(prev => [...prev, `visitor@ai-dost:~ $ ${cmd}`]);
    setTerminalInput('');

    if (cmd === 'clear') {
      setTerminalHistory([]);
      return;
    }
    
    if (terminalWs.current && terminalWs.current.readyState === WebSocket.OPEN) {
      terminalWs.current.send(cmd + '\n');
    } else {
      setTerminalHistory(prev => [...prev, 'WebSocket is disconnected. Please refresh.']);
    }
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
    <div className="flex flex-col h-full w-full bg-bg-default/45 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden relative animate-fadeIn">
      <div className="flex items-center p-3 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="text-xs text-text-secondary font-semibold bg-bg-default/40 border border-white/[0.08] px-3 py-2 rounded-lg flex items-center gap-1.5 select-text">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          Language: <span className="capitalize font-bold text-primary">{selectedLanguage}</span>
        </div>
        
        {/* Collaborative Active Presence Row */}
        <div className="flex items-center gap-1.5 ml-3 select-none">
          <div className="flex items-center -space-x-1.5">
            <div className="w-5 h-5 rounded-full border border-bg-default bg-primary text-bg-default text-[9px] font-bold flex items-center justify-center shadow" title="Vikash (You)">V</div>
            {collaborators.map((c, i) => (
              <div 
                key={c.userId || i} 
                className="w-5 h-5 rounded-full border border-bg-default text-bg-default text-[9px] font-bold flex items-center justify-center shadow transition-transform hover:scale-110"
                style={{ backgroundColor: c.color || '#8b5cf6' }}
                title={`${c.username || 'Collaborator'} (Online)`}
              >
                {(c.username || 'C').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Active Remote Cursor Position Badges */}
          {Object.values(remoteCursors || {}).map((rc) => (
            <span 
              key={rc.userId}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border text-bg-default font-bold animate-fadeIn"
              style={{ backgroundColor: rc.color || '#06b6d4' }}
              title={`Cursor position for ${rc.username}`}
            >
              {rc.username}: L{rc.position?.lineNumber || 1}:C{rc.position?.column || 1}
            </span>
          ))}
        </div>
        <div className="flex items-center ml-auto space-x-2">
          <button 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition cursor-pointer"
            onClick={handleOpenAiEdit}
            title="AI Refactor Selection"
          >
            <Wand2 className="w-3.5 h-3.5" /> AI Edit
          </button>
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              gitStatus === 'modified'
                ? 'bg-primary/15 border-primary/40 text-primary' 
                : 'border-border text-text-secondary hover:bg-bg-hover'
            }`}
            onClick={async () => {
              setIsThinking(true);
              try {
                await new Promise(r => setTimeout(r, 1500));
                setGitModalOpen(true);
                showToast({ type: 'success', message: 'Git panel opened - create commit or browse history' });
              } catch (e) {
                setIsThinking(false);
              }
            }}
            title="Git Control Panel"
          >
            <GitBranch className="w-3.5 h-3.5" /> Git
          </button>
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              reviewModalOpen
                ? 'bg-primary/15 border-primary/40 text-primary' 
                : 'border-border text-text-secondary hover:bg-bg-hover'
            }`}
            onClick={() => setReviewModalOpen(true)}
            title="AI Code Security & Quality Audit"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Audit
          </button>
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              showPreview
                ? 'bg-primary/15 border-primary/40 text-primary' 
                : 'border-border text-text-secondary hover:bg-bg-hover'
            }`}
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle Live Preview"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPreview ? 'Hide' : 'Preview'}</span>
          </button>
          <button 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
              isExecuting 
                ? 'bg-warning/15 border border-warning/40 text-warning animate-pulse' 
                : 'bg-primary border border-primary text-bg-default hover:bg-primary-hover'
            }`}
            onClick={handleRun}
            disabled={isExecuting}
          >
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isExecuting ? 'Running...' : 'Run'}</span>
          </button>
          <button 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover transition cursor-pointer"
            onClick={() => setCode('')}
          >
            <RotateCcw className="w-3.5 h-3.5" /> <span>Clear</span>
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
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <Wand2 className="w-4 h-4" /> AI Code Refactor
                </div>
                <button 
                  onClick={() => setShowAiEdit(false)}
                  className="p-1 rounded-md hover:bg-bg-hover text-text-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
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
      
      <div className="px-4 pt-3 pb-2 bg-bg-hover border-t border-border flex flex-col h-[200px]">
        <div className="flex items-center mb-2 shrink-0 justify-between select-none">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-semibold text-text-secondary">Terminal {terminalConnected ? '(Live)' : '(Disconnected)'}</span>
            {isExecuting && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastErrorLog && (
              <button
                onClick={() => {
                  setAiEditPrompt(`Fix the following runtime execution error:\n\n${lastErrorLog}`);
                  setOriginalCodeSelection(code);
                  setShowAiEdit(true);
                }}
                className="flex items-center gap-1 px-2.5 py-0.5 bg-warning/20 border border-warning/40 hover:bg-warning hover:text-bg-default text-warning text-[10px] font-bold rounded-md transition-all cursor-pointer animate-pulse"
                title="Diagnose & Fix this runtime error with AI Copilot"
              >
                <Wand2 className="w-3 h-3" /> Fix Error with AI
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(terminalHistory.join('\n'));
                showToast({ type: 'success', message: 'Copied!' });
              }}
              className="flex items-center gap-1 px-2 py-0.5 border border-border hover:bg-bg-card text-[10px] text-text-muted hover:text-text-secondary rounded-md transition-colors cursor-pointer"
              title="Copy logs"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              onClick={() => setTerminalHistory(['Console cleared.', ''])}
              className="flex items-center gap-1 px-2 py-0.5 border border-border hover:bg-bg-card text-[10px] text-text-muted hover:text-text-secondary rounded-md transition-colors cursor-pointer"
              title="Clear"
            >
              <Trash2 className="w-3 h-3" /> Clear
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
      {gitModalOpen && (
        <GitControlModal
          isOpen={gitModalOpen}
          onClose={() => setGitModalOpen(false)}
        />
      )}
      <CodeReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        currentCode={code}
        currentFile={currentFile}
        onApplyPatch={(patched) => {
          setCode(patched);
          if (onChange) onChange(patched);
        }}
      />
      {isThinking && (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-xl animate-fadeIn">
          <div className="bg-bg-card border border-primary/40 rounded-xl p-8 text-center max-w-md mx-8">
            <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Deep analysing...</h3>
            <p className="text-sm text-text-muted">AI-Dost is thinking... this may take a moment.</p>
          </div>
        </div>
      )}
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;
