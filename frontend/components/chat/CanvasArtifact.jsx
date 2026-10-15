import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import AppIcon from '../ui/AppIcon';

/**
 * CanvasArtifact.jsx
 * 
 * Interactive code editor and execution runner for Python & terminal scripts.
 * Displays Monaco editor with code and real terminal output upon execution.
 */

const MONACO_LANG_MAP = {
    py: 'python',
    python3: 'python',
    js: 'javascript',
    node: 'javascript',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    powershell: 'powershell',
    ps1: 'powershell',
    terminal: 'shell',
    shell: 'shell',
};

const CanvasArtifact = ({ initialCode, language = 'javascript', onClose, onOpenIDE }) => {
    const [code, setCode] = useState(initialCode || '');
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState(null); // 'success' | 'error' | null

    useEffect(() => {
        setCode(initialCode || '');
    }, [initialCode]);

    const normalizedLang = (language || '').toLowerCase().trim();
    const monacoLang = MONACO_LANG_MAP[normalizedLang] || normalizedLang || 'python';

    const handleRunCode = async () => {
        if (isRunning) return;
        setIsRunning(true);
        setOutput('Executing script...');
        setStatus(null);

        const targetLang = ['py', 'python', 'python3'].includes(normalizedLang) ? 'python' : (normalizedLang || 'python');

        try {
            const res = await fetch('/api/interpreter/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: targetLang })
            });
            const data = await res.json();

            if (data.success) {
                setOutput(data.output || '(Execution completed with no printed output)');
                setStatus('success');
            } else {
                // If interpreter failed with route error, try fallback to /api/chat/execute
                if (data.error && /unsupported/i.test(data.error)) {
                    const fallbackRes = await fetch('/api/chat/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, language: targetLang })
                    });
                    const fbData = await fallbackRes.json();
                    if (fbData.success || fbData.stdout) {
                        setOutput(fbData.stdout || '(Execution completed with no printed output)');
                        setStatus('success');
                        return;
                    }
                }
                const errDetail = data.error || data.stderr || 'Execution failed';
                setOutput(`Error:\n${errDetail}`);
                setStatus('error');
            }
        } catch (err) {
            // Secondary fallback to /api/chat/execute
            try {
                const fallbackRes = await fetch('/api/chat/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code, language: targetLang })
                });
                const fbData = await fallbackRes.json();
                if (fbData.success || fbData.stdout) {
                    setOutput(fbData.stdout || '(Execution completed with no printed output)');
                    setStatus('success');
                    return;
                }
                setOutput(`Error:\n${fbData.error || fbData.stderr || err.message}`);
                setStatus('error');
            } catch (fbErr) {
                setOutput(`Execution Error:\n${err.message}`);
                setStatus('error');
            }
        } finally {
            setIsRunning(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (_) {}
    };

    const handleClearOutput = () => {
        setOutput('');
        setStatus(null);
    };

    return (
        <div className="canvas-artifact-container flex flex-col h-full w-full rounded-xl border border-[#30363d] bg-[#0d1117] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="canvas-header flex items-center justify-between px-3.5 py-2.5 bg-[#161b22] border-b border-[#30363d] select-none">
                <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-emerald-500/10 text-emerald-400">
                        <AppIcon name="terminal" size={11} />
                    </span>
                    <span className="text-xs font-semibold text-[#f0f6fc] tracking-wide">
                        Artifact Canvas ({monacoLang})
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#c9d1d9] hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors cursor-pointer"
                        title="Copy code to clipboard"
                    >
                        <AppIcon name={copied ? 'check' : 'copy'} size={11} className={copied ? 'text-emerald-400' : ''} />
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {/* Run Code Button */}
                    <button
                        type="button"
                        onClick={handleRunCode}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 border border-emerald-500/30 rounded-md transition-colors cursor-pointer shadow-sm"
                        title="Execute code in interpreter"
                    >
                        <AppIcon name={isRunning ? 'loader' : 'play'} size={10} className={isRunning ? 'animate-spin' : ''} />
                        <span>{isRunning ? 'Running...' : 'Run Code'}</span>
                    </button>

                    {/* Open in IDE */}
                    {onOpenIDE && (
                        <button
                            type="button"
                            onClick={onOpenIDE}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#8b949e] hover:text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors cursor-pointer"
                            title="Open in Copilot IDE"
                        >
                            <AppIcon name="code" size={11} />
                            <span>IDE</span>
                        </button>
                    )}

                    {/* Close Button */}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-[#8b949e] hover:text-white hover:bg-[#30363d] rounded transition-colors cursor-pointer"
                            title="Close"
                        >
                            <AppIcon name="close" size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Monaco Editor Area */}
            <div className="flex-1 min-h-[140px] bg-[#0d1117] overflow-hidden">
                <Editor
                    height="100%"
                    language={monacoLang}
                    theme="vs-dark"
                    value={code}
                    onChange={(val) => setCode(val || '')}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        renderLineHighlight: 'all',
                        overviewRulerLanes: 0,
                    }}
                />
            </div>

            {/* Terminal Output Console */}
            <div className="canvas-terminal flex flex-col border-t border-[#30363d] bg-[#010409]">
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#161b22]/90 border-b border-[#21262d] text-[11px]">
                    <div className="flex items-center gap-2 text-[#8b949e]">
                        <AppIcon name="terminal" size={10} />
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Terminal Output</span>
                        {status === 'success' && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[9px] border border-emerald-500/30">
                                Exit 0
                            </span>
                        )}
                        {status === 'error' && (
                            <span className="px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 font-mono text-[9px] border border-red-500/30">
                                Exit 1
                            </span>
                        )}
                    </div>
                    {output && (
                        <button
                            type="button"
                            onClick={handleClearOutput}
                            className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-[#c9d1d9] transition-colors cursor-pointer"
                            title="Clear terminal output"
                        >
                            <AppIcon name="eraser" size={9} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
                <pre
                    className="p-3 text-xs font-mono whitespace-pre-wrap overflow-y-auto max-h-[160px] min-h-[75px] select-text"
                    style={{
                        color: status === 'error' ? '#f87171' : '#4ade80',
                        margin: 0,
                    }}
                >
                    {output || (
                        <span className="text-[#6e7681] italic">
                            {'// Click "Run Code" above to execute script and view output...'}
                        </span>
                    )}
                </pre>
            </div>
        </div>
    );
};

export default CanvasArtifact;
