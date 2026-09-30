import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';

/**
 * CanvasArtifact.jsx
 * 
 * An interactive side-by-side code editor for large code snippets.
 * Mirrors the experience of ChatGPT Canvas or Claude Artifacts.
 */

const CanvasArtifact = ({ initialCode, language = 'javascript', onClose }) => {
    const [code, setCode] = useState(initialCode);
    const [output, setOutput] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        setCode(initialCode);
    }, [initialCode]);

    const handleRunCode = async () => {
        setIsRunning(true);
        setOutput('Running...');
        
        try {
            const res = await fetch('/api/interpreter/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language })
            });
            const data = await res.json();
            
            if (data.success) {
                setOutput(data.output || '(No Output)');
            } else {
                setOutput(`Error:\n${data.error}`);
            }
        } catch (err) {
            setOutput(`Failed to execute: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="canvas-artifact-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', border: '1px solid #444', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1e1e1e' }}>
            {/* Header */}
            <div className="canvas-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', backgroundColor: '#2d2d2d', borderBottom: '1px solid #444' }}>
                <div style={{ color: '#fff', fontWeight: 'bold' }}>Artifact Canvas ({language})</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={handleRunCode} 
                        disabled={isRunning}
                        style={{ padding: '5px 15px', backgroundColor: '#007acc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        {isRunning ? 'Running...' : 'Run Code'}
                    </button>
                    {onClose && (
                        <button onClick={onClose} style={{ padding: '5px 10px', backgroundColor: 'transparent', color: '#ccc', border: 'none', cursor: 'pointer' }}>
                            ✖
                        </button>
                    )}
                </div>
            </div>

            {/* Editor */}
            <div style={{ flex: 1 }}>
                <Editor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value)}
                    options={{ minimap: { enabled: false }, fontSize: 14 }}
                />
            </div>

            {/* Terminal Output */}
            <div className="canvas-terminal" style={{ height: '150px', backgroundColor: '#000', color: '#0f0', padding: '10px', fontFamily: 'monospace', overflowY: 'auto', borderTop: '1px solid #444' }}>
                <div style={{ color: '#888', marginBottom: '5px', fontSize: '12px' }}>Terminal Output</div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{output}</pre>
            </div>
        </div>
    );
};

export default CanvasArtifact;
