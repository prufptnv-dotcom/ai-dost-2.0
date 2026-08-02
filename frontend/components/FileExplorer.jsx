import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, Trash2, Plus, X } from 'lucide-react';

const FileExplorer = ({ files = [], currentFile = '', onSelectFile, onDeleteFile, onCreateFile }) => {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // 1. Convert flat files array to a hierarchical tree
  const buildFileTree = () => {
    const root = { name: 'root', type: 'folder', path: '', children: [] };
    
    files.forEach(file => {
      if (!file || !file.path) return;
      const parts = file.path.split('/');
      let current = root;
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        let existing = current.children.find(child => child.name === part);
        
        if (!existing) {
          existing = {
            name: part,
            type: isLast ? 'file' : 'folder',
            path: currentPath,
            children: isLast ? undefined : [],
            fileData: isLast ? file : undefined
          };
          current.children.push(existing);
        }
        current = existing;
      });
    });
    return root.children;
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    onCreateFile && onCreateFile(newFileName.trim());
    setNewFileName('');
    setShowNewFileInput(false);
  };

  const renderNode = (node, level = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = !!expandedFolders[node.path];
    const isSelected = currentFile === node.path;

    return (
      <div key={node.path || node.name} className="flex flex-col">
        {/* Node label */}
        <div
          className={`flex items-center justify-between text-xs font-semibold py-1.5 px-2 rounded-lg cursor-pointer transition select-none group ${
            isSelected 
              ? 'bg-primary/20 text-primary border border-primary/10' 
              : 'text-text-secondary hover:bg-secondary/10'
          }`}
          style={{ paddingLeft: `${Math.max(8, level * 14)}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else {
              onSelectFile && onSelectFile(node.fileData);
            }
          }}
        >
          <div className="flex items-center min-w-0 pr-2">
            {isFolder ? (
              isExpanded ? (
                <FolderOpen className="mr-2 text-primary shrink-0 w-3.5 h-3.5" />
              ) : (
                <Folder className="mr-2 text-primary shrink-0 w-3.5 h-3.5" />
              )
            ) : (
              <FileCode className="mr-2 text-text-muted shrink-0 w-3.5 h-3.5" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {/* Delete action icon for files */}
          {!isFolder && (
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-warning/10 text-warning transition cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile && onDeleteFile(node.path, e);
              }}
              title="Delete File"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Recursive folder children */}
        {isFolder && isExpanded && node.children && (
          <div className="flex flex-col mt-0.5 space-y-0.5">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const treeData = buildFileTree();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File Explorer Header controls */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5 uppercase tracking-wider">
          <FolderOpen className="w-3.5 h-3.5" /> Workspace
        </h3>
        <button 
          className="p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-secondary transition cursor-pointer"
          onClick={() => setShowNewFileInput(!showNewFileInput)}
          title="New File"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {showNewFileInput && (
        <form onSubmit={handleCreateSubmit} className="mb-3 flex items-center space-x-1 shrink-0">
          <input 
            type="text" 
            placeholder="src/index.js"
            className="flex-1 bg-bg-hover border border-border p-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text-primary"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoFocus
          />
          <button 
            type="submit" 
            className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-bg-default text-xs font-semibold cursor-pointer transition"
          >
            Add
          </button>
          <button 
            type="button" 
            className="p-1.5 rounded-md hover:bg-bg-hover text-text-muted cursor-pointer"
            onClick={() => {
              setShowNewFileInput(false);
              setNewFileName('');
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      )}

      {/* Hierarchical tree wrapper */}
      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 select-none">
        {treeData.length > 0 ? (
          treeData.map(node => renderNode(node, 0))
        ) : (
          <div className="text-center text-text-muted text-[10px] italic py-6">
            Empty. Create a file to begin.
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
