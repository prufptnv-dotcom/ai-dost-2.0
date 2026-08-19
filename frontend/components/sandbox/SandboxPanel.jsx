'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useWebContainerProject } from '@/hooks/useWebContainer';
import LivePreview from './LivePreview';
import { FolderOpen, File, Terminal, Play, Stop, RefreshCw, Hammer, Download, Upload, Search, X, ChevronRight, ChevronDown, Code, Globe, Wrench } from 'lucide-react';

const FILE_ICONS = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.json': 'json', '.html': 'html', '.css': 'css', '.scss': 'scss', '.sass': 'scss',
  '.md': 'markdown', '.txt': 'text', '.py': 'python', '.rs': 'rust', '.go': 'go',
  '.java': 'java', '.cpp': 'cpp', '.c': 'c', '.php': 'php', '.rb': 'ruby',
  '.vue': 'vue', '.svelte': 'svelte', '.astro': 'astro', '.yml': 'yaml', '.yaml': 'yaml',
  '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini', '.conf': 'ini', '.env': 'env',
  '.gitignore': 'git', '.dockerignore': 'docker', 'Dockerfile': 'docker',
  '.lock': 'lock', '.log': 'log'
};

function getFileIcon(name) {
  const ext = name.substring(name.lastIndexOf('.'));
  return FILE_ICONS[ext] || 'file';
}

function FileTree({ files, onSelect, onCreateFile, onCreateFolder, onDelete, onRename, expanded, setExpanded, selectedPath }) {
  const renderNode = (node, depth = 0) => {
    const isExpanded = expanded.has(node.path);
    const isDir = node.type === 'directory';
    const hasChildren = isDir && node.children && node.children.length > 0;
    const isSelected = selectedPath === node.path;

    return (
      <div key={node.path} style={{ marginLeft: `${depth * 16}px` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '4px',
            background: isSelected ? '#3b82f6' : 'transparent',
            color: isSelected ? 'white' : '#e2e8f0',
            cursor: 'pointer',
            transition: 'background 0.1s',
            width: '100%',
            boxSizing: 'border-box'
          }}
          onClick={() => {
            if (isDir) {
              setExpanded(prev => {
                const next = new Set(prev);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              });
            } else {
              onSelect(node.path);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, node);
          }}
        >
          {isDir && hasChildren && (
            <ChevronRight style={{ width: 14, height: 14, marginRight: 4, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s', flexShrink: 0 }} />
          )}
          {isDir && !hasChildren && <span style={{ width: 18 }} />}
          {!isDir && <span style={{ width: 18 }} />}
          <File className={`file-icon ${getFileIcon(node.name)}`} style={{ width: 14, height: 14, marginRight: 6, flexShrink: 0 }} />
          <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        </div>
        {isDir && isExpanded && node.children && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const [contextMenu, setContextMenu] = useState(null);

  const showContextMenu = (x, y, node) => {
    setContextMenu({ x, y, node });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (contextMenu) {
    return (
      <>
        <div style={{ flex: 1, overflow: 'auto', padding: 8, fontFamily: 'monospace', fontSize: 13 }}>
          {files.map(node => renderNode(node))}
        </div>
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)', zIndex: 100, minWidth: 160 }}>
          <div onClick={() => { onCreateFile(contextMenu.node.path); setContextMenu(null); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <File style={{ width: 14, height: 14 }} /> New File
          </div>
          <div onClick={() => { onCreateFolder(contextMenu.node.path); setContextMenu(null); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderTop: '1px solid #334155' }}>
            <FolderOpen style={{ width: 14, height: 14 }} /> New Folder
          </div>
          {contextMenu.node.type === 'file' && (
            <>
              <div onClick={() => { onRename(contextMenu.node.path); setContextMenu(null); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderTop: '1px solid #334155' }}>
                <Wrench style={{ width: 14, height: 14 }} /> Rename
              </div>
              <div onClick={() => { onDelete(contextMenu.node.path); setContextMenu(null); }} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderTop: '1px solid #334155', color: '#f87171' }}>
                <X style={{ width: 14, height: 14 }} /> Delete
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 8, fontFamily: 'monospace', fontSize: 13 }}>
      {files.map(node => renderNode(node))}
    </div>
  );
}

FileTree.propTypes = {};

export default function SandboxPanel({ projectId, sandboxId, onLog, onAgentAction }) {
  const [activeTab, setActiveTab] = useState('explorer');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileModified, setFileModified] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [devServerUrl, setDevServerUrl] = useState('');
  const [devServerStatus, setDevServerStatus] = useState('stopped');
  const [framework, setFramework] = useState('vite');
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [fileTree, setFileTree] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const terminalRef = useRef(null);

  const wc = useWebContainerProject(projectId, true);
  const listFiles = wc.listFiles;

  const refreshFileTree = useCallback(async () => {
    try {
      const files = await listFiles('/workspace');
      const tree = buildTree(files);
      setFileTree(tree);
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.add('/workspace');
        return next;
      });
    } catch (err) {
      onLog?.({ projectId, message: `Failed to load file tree: ${err.message}`, type: 'error' });
    }
  }, [listFiles, onLog, projectId]);

  useEffect(() => {
    if (wc.status === 'ready') {
      refreshFileTree();
    }
  }, [wc.status, refreshFileTree]);

  const handleFileSelect = async (filePath) => {
    if (selectedFile && fileModified) {
      if (!confirm('Save changes to current file?')) {
        setFileModified(false);
      } else {
        await saveFile();
      }
    }

    try {
      const content = await wc.readFile(filePath);
      setSelectedFile(filePath);
      setFileContent(content);
      setFileModified(false);
    } catch (err) {
      onLog?.({ projectId, message: `Failed to read file: ${err.message}`, type: 'error' });
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await wc.writeFile(selectedFile, fileContent);
      setFileModified(false);
      onLog?.({ projectId, message: `Saved: ${selectedFile}`, type: 'success' });
    } catch (err) {
      onLog?.({ projectId, message: `Save failed: ${err.message}`, type: 'error' });
    }
  };

  const createFile = async (parentPath) => {
    const name = prompt('File name:');
    if (!name) return;
    const fullPath = path.join(parentPath, name);
    try {
      await wc.writeFile(fullPath, '');
      onLog?.({ projectId, message: `Created: ${fullPath}`, type: 'success' });
      refreshFileTree();
    } catch (err) {
      onLog?.({ projectId, message: `Create failed: ${err.message}`, type: 'error' });
    }
  };

  const createFolder = async (parentPath) => {
    const name = prompt('Folder name:');
    if (!name) return;
    const fullPath = path.join(parentPath, name);
    try {
      await wc.writeFile(path.join(fullPath, '.gitkeep'), '');
      onLog?.({ projectId, message: `Created folder: ${fullPath}`, type: 'success' });
      refreshFileTree();
    } catch (err) {
      onLog?.({ projectId, message: `Create failed: ${err.message}`, type: 'error' });
    }
  };

  const deleteFile = async (filePath) => {
    if (!confirm(`Delete ${filePath}?`)) return;
    try {
      await wc.removeFile(filePath);
      onLog?.({ projectId, message: `Deleted: ${filePath}`, type: 'success' });
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setFileContent('');
      }
      refreshFileTree();
    } catch (err) {
      onLog?.({ projectId, message: `Delete failed: ${err.message}`, type: 'error' });
    }
  };

  const renameFile = async (filePath) => {
    const newName = prompt('New name:', path.basename(filePath));
    if (!newName || newName === path.basename(filePath)) return;
    const newPath = path.join(path.dirname(filePath), newName);
    try {
      const content = await wc.readFile(filePath);
      await wc.writeFile(newPath, content);
      await wc.removeFile(filePath);
      onLog?.({ projectId, message: `Renamed: ${filePath} -> ${newPath}`, type: 'success' });
      if (selectedFile === filePath) setSelectedFile(newPath);
      refreshFileTree();
    } catch (err) {
      onLog?.({ projectId, message: `Rename failed: ${err.message}`, type: 'error' });
    }
  };

  const runTerminalCommand = async (cmd) => {
    if (!cmd.trim()) return;
    
    setTerminalOutput(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setTerminalHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setTerminalInput('');

    try {
      const result = await wc.runCommand(cmd, { cwd: '/workspace' });
      if (result.stdout) setTerminalOutput(prev => [...prev, { type: 'stdout', text: result.stdout }]);
      if (result.stderr) setTerminalOutput(prev => [...prev, { type: 'stderr', text: result.stderr }]);
      setTerminalOutput(prev => [...prev, { type: 'exit', text: `Exit code: ${result.exitCode}` }]);
    } catch (err) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }]);
    }
    
    terminalRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runTerminalCommand(terminalInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < terminalHistory.length - 1) {
        setHistoryIndex(prev => prev + 1);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - historyIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        setHistoryIndex(prev => prev - 1);
        setTerminalInput(terminalHistory[terminalHistory.length - 1 - historyIndex] || '');
      } else {
        setHistoryIndex(-1);
        setTerminalInput('');
      }
    }
  };

  const startDevServer = async () => {
    setDevServerStatus('starting');
    onLog?.({ projectId, message: `Starting ${framework} dev server...`, type: 'info' });
    try {
      const server = await wc.startDev(framework);
      setDevServerUrl(server.url);
      setDevServerStatus('running');
      onLog?.({ projectId, message: `Dev server running at ${server.url}`, type: 'success' });
    } catch (err) {
      setDevServerStatus('error');
      onLog?.({ projectId, message: `Dev server failed: ${err.message}`, type: 'error' });
    }
  };

  const stopDevServer = () => {
    wc.stopDev();
    setDevServerUrl('');
    setDevServerStatus('stopped');
    onLog?.({ projectId, message: 'Dev server stopped', type: 'info' });
  };

  const buildProject = async () => {
    onLog?.({ projectId, message: 'Building project...', type: 'info' });
    try {
      const result = await wc.buildProject(framework);
      onLog?.({ projectId, message: result.success ? 'Build successful' : `Build failed: ${result.stderr}`, type: result.success ? 'success' : 'error' });
    } catch (err) {
      onLog?.({ projectId, message: `Build error: ${err.message}`, type: 'error' });
    }
  };

  const installDeps = async () => {
    onLog?.({ projectId, message: 'Installing dependencies...', type: 'info' });
    try {
      const result = await wc.installDeps();
      onLog?.({ projectId, message: result.success ? 'Dependencies installed' : `Install failed: ${result.stderr}`, type: result.success ? 'success' : 'error' });
    } catch (err) {
      onLog?.({ projectId, message: `Install error: ${err.message}`, type: 'error' });
    }
  };

  const handleAgentAction = useCallback((action) => {
    onAgentAction?.({ projectId, sandboxId, action });
  }, [projectId, sandboxId, onAgentAction]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: '#1e293b', borderBottom: '1px solid #334155', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['explorer', 'search', 'terminal', 'preview'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: activeTab === tab ? '#3b82f6' : 'transparent',
                color: activeTab === tab ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.1s'
              }}
            >
              {tab === 'explorer' && <FolderOpen style={{ width: 14, height: 14 }} />}
              {tab === 'search' && <Search style={{ width: 14, height: 14 }} />}
              {tab === 'terminal' && <Terminal style={{ width: 14, height: 14 }} />}
              {tab === 'preview' && <Globe style={{ width: 14, height: 14 }} />}
              {tab}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {activeTab === 'preview' && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <select value={framework} onChange={e => setFramework(e.target.value)} style={{ padding: '4px 8px', fontSize: 12, background: '#334155', color: '#e2e8f0', border: '1px solid #475569', borderRadius: '4px' }}>
              <option value="vite">Vite</option>
              <option value="nextjs">Next.js</option>
              <option value="astro">Astro</option>
              <option value="sveltekit">SvelteKit</option>
              <option value="nuxt">Nuxt</option>
              <option value="remix">Remix</option>
              <option value="expo">Expo</option>
            </select>
            {devServerStatus === 'running' ? (
              <button onClick={stopDevServer} style={{ padding: '4px 10px', fontSize: 12, background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <Stop style={{ width: 14, height: 14, marginRight: 4 }} /> Stop
              </button>
            ) : (
              <button onClick={startDevServer} disabled={devServerStatus === 'starting'} style={{ padding: '4px 10px', fontSize: 12, background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <Play style={{ width: 14, height: 14, marginRight: 4 }} /> Start
              </button>
            )}
            <button onClick={buildProject} style={{ padding: '4px 10px', fontSize: 12, background: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <Hammer style={{ width: 14, height: 14, marginRight: 4 }} /> Build
            </button>
          </div>
        )}
        {activeTab === 'terminal' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={installDeps} style={{ padding: '4px 10px', fontSize: 12, background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <Download style={{ width: 14, height: 14, marginRight: 4 }} /> npm install
            </button>
            <button onClick={() => setTerminalOutput([])} style={{ padding: '4px 10px', fontSize: 12, background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <RefreshCw style={{ width: 14, height: 14, marginRight: 4 }} /> Clear
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 280, borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>Explorer</span>
            <button onClick={refreshFileTree} style={{ padding: '2px 6px', fontSize: 11, background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: '3px', cursor: 'pointer' }}>
              <RefreshCw style={{ width: 12, height: 12, marginRight: 4 }} /> Refresh
            </button>
          </div>
          <FileTree
            files={fileTree}
            onSelect={handleFileSelect}
            onCreateFile={createFile}
            onCreateFolder={createFolder}
            onDelete={deleteFile}
            onRename={renameFile}
            expanded={expandedPaths}
            setExpanded={setExpandedPaths}
            selectedPath={selectedFile}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {activeTab === 'explorer' && selectedFile && (
            <div style={{ borderBottom: '1px solid #334155', padding: '8px 12px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <File className={`file-icon ${getFileIcon(selectedFile)}`} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedFile}</span>
                {fileModified && <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '3px' }}>● Modified</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={saveFile} disabled={!fileModified} style={{ padding: '4px 10px', fontSize: 12, background: fileModified ? '#22c55e' : '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: fileModified ? 'pointer' : 'not-allowed' }}>
                  <Download style={{ width: 14, height: 14, marginRight: 4 }} /> Save
                </button>
              </div>
            </div>
          )}

          {activeTab === 'explorer' && selectedFile ? (
            <Editor
              height="100%"
              defaultLanguage={path.extname(selectedFile).substring(1) || 'plaintext'}
              value={fileContent}
              onChange={(val) => { setFileContent(val); setFileModified(true); }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                tabSize: 2,
                scrollBeyondLastLine: false,
                automaticLayout: true
              }}
            />
          ) : activeTab === 'terminal' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
              <div style={{ flex: 1, overflow: 'auto', padding: 12, fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}>
                {terminalOutput.map((line, i) => (
                  <div key={i} style={{ color: line.type === 'stdout' ? '#e2e8f0' : line.type === 'stderr' ? '#f87171' : line.type === 'exit' ? '#f59e0b' : line.type === 'error' ? '#f87171' : '#60a5fa', marginBottom: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {line.text}
                  </div>
                ))}
                <div ref={terminalRef} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderTop: '1px solid #334155', background: '#1e293b' }}>
                <span style={{ color: '#22c55e', marginRight: 8, fontFamily: 'monospace' }}>$</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={e => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace', outline: 'none', padding: '4px' }}
                  placeholder="Enter command..."
                  autoFocus
                />
              </div>
            </div>
          ) : activeTab === 'preview' ? (
            <LivePreview
              sandboxId={sandboxId}
              projectId={projectId}
              devServerUrl={devServerUrl}
              framework={framework}
              onLog={onLog}
              onError={onError}
              height="100%"
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select a file to edit or switch tabs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Minimal browser-safe path helpers (path-browserify is NOT installed)
const path = {
  join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
  dirname: (p) => p.includes('/') ? p.substring(0, p.lastIndexOf('/')) || '/' : '.',
  basename: (p) => p.split('/').pop(),
  extname: (p) => { const b = p.split('/').pop(); const i = b.lastIndexOf('.'); return i > 0 ? b.substring(i) : ''; }
};

function buildTree(files, basePath = '/workspace') {
  const map = {};
  const roots = [];

  for (const file of files) {
    const fullPath = path.join(basePath, file.path);
    map[fullPath] = { ...file, fullPath, children: [] };
  }

  for (const file of files) {
    const fullPath = path.join(basePath, file.path);
    const dir = path.dirname(fullPath);
    if (map[dir]) {
      map[dir].children.push(map[fullPath]);
    } else {
      roots.push(map[fullPath]);
    }
  }

  return roots;
}