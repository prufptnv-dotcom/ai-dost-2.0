import React, { useState } from 'react';
import { FaFolder, FaFolderOpen, FaFileCode } from 'react-icons/fa';
import { AiOutlineDelete, AiOutlinePlus, AiOutlineClose } from 'react-icons/ai';

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
                <FaFolderOpen className="mr-2 text-primary shrink-0 text-sm" />
              ) : (
                <FaFolder className="mr-2 text-primary shrink-0 text-sm" />
              )
            ) : (
              <FaFileCode className="mr-2 text-text-secondary shrink-0 text-sm" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          {/* Delete action icon for files */}
          {!isFolder && (
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-secondary/20 text-warning transition cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile && onDeleteFile(node.path, e);
              }}
              title="Delete File"
            >
              <AiOutlineDelete className="text-xs" />
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
        <h3 className="text-sm font-bold text-primary flex items-center">
          <FaFolderOpen className="mr-2 text-base text-primary" /> Workspace Tree
        </h3>
        <button 
          className="p-1 rounded hover:bg-secondary/10 text-primary transition cursor-pointer"
          onClick={() => setShowNewFileInput(!showNewFileInput)}
          title="Create New File"
        >
          <AiOutlinePlus className="text-base" />
        </button>
      </div>

      {showNewFileInput && (
        <form onSubmit={handleCreateSubmit} className="mb-3 flex items-center space-x-1 shrink-0">
          <input 
            type="text" 
            placeholder="src/index.js"
            className="flex-1 bg-bg-default/40 border border-white/[0.08] p-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text-primary"
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
            className="p-1.5 rounded hover:bg-secondary/10 text-text-secondary cursor-pointer"
            onClick={() => {
              setShowNewFileInput(false);
              setNewFileName('');
            }}
          >
            <AiOutlineClose className="text-xs" />
          </button>
        </form>
      )}

      {/* Hierarchical tree wrapper */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 select-none">
        {treeData.length > 0 ? (
          treeData.map(node => renderNode(node, 0))
        ) : (
          <div className="text-center text-text-secondary text-xs italic py-4">
            Workspace is empty. Create a file to begin!
          </div>
        )}
      </div>
    </div>
  );
};

export default FileExplorer;
