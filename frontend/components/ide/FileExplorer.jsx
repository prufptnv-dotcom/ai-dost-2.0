import React, { useState, useMemo } from 'react';
import {
  ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen,
  FileCode2, FileJson, FileText, FileCode, File, Plus,
  FilePlus2, FolderPlus, Search, Trash2, Pencil, RefreshCw, X
} from 'lucide-react';
import { iconForFile, colorForFile } from '../views/CopilotTree';

export function FileExplorer({
  files = [],
  activePath = '',
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRefresh,
  loading = false,
  className = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDirs, setExpandedDirs] = useState({ root: true, src: true });
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Build tree from files array
  const tree = useMemo(() => {
    const root = {};
    for (const f of files || []) {
      const parts = f.path.split('/');
      let current = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const dir = parts[i];
        if (!current[dir]) current[dir] = { __dir: true, name: dir, children: {} };
        current = current[dir].children;
      }
      const filename = parts[parts.length - 1];
      current[filename] = { __file: true, path: f.path, name: filename, content: f.content || '' };
    }
    return root;
  }, [files]);

  const toggleDir = (dirPath) => {
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      return;
    }
    if (isCreatingFile && onCreateFile) {
      onCreateFile(newItemName.trim());
    } else if (isCreatingFolder && onCreateFolder) {
      onCreateFolder(newItemName.trim());
    }
    setNewItemName('');
    setIsCreatingFile(false);
    setIsCreatingFolder(false);
  };

  // Render tree recursively
  const renderTree = (node, depth = 0, currentPath = '') => {
    const keys = Object.keys(node).sort((a, b) => {
      const isDirA = node[a].__dir ? 0 : 1;
      const isDirB = node[b].__dir ? 0 : 1;
      if (isDirA !== isDirB) return isDirA - isDirB;
      return a.localeCompare(b);
    });

    return keys.map((key) => {
      const item = node[key];
      const itemPath = currentPath ? `${currentPath}/${key}` : key;

      if (item.__dir) {
        const isExpanded = expandedDirs[itemPath] !== false;
        return (
          <div key={itemPath} role="treeitem" aria-expanded={isExpanded} aria-selected={false}>
            <div
              onClick={() => toggleDir(itemPath)}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 transition-fast cursor-pointer select-none text-xs font-mono group"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className="text-ink-muted group-hover:text-paper-100">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <Folder className="w-3.5 h-3.5 text-accent-primary/80 flex-shrink-0" />
              <span className="truncate">{key}</span>
            </div>
            {isExpanded && renderTree(item.children, depth + 1, itemPath)}
          </div>
        );
      }

      // File Row
      const isActive = activePath === item.path;
      const Icon = iconForFile(item.path);

      if (searchQuery && !item.path.toLowerCase().includes(searchQuery.toLowerCase())) {
        return null;
      }

      return (
        <div
          key={item.path}
          role="treeitem"
          aria-selected={isActive}
          onClick={() => onSelectFile && onSelectFile(item.path)}
          className={`flex items-center justify-between gap-1.5 px-2 py-1 transition-fast cursor-pointer select-none text-xs font-mono group ${
            isActive
              ? 'bg-canvas-elevated text-paper-100 border-l-2 border-accent-primary font-medium'
              : 'text-paper-300 hover:text-paper-100 hover:bg-canvas-surface'
          }`}
          style={{ paddingLeft: `${depth * 12 + (isActive ? 6 : 8)}px` }}
        >
          <div className="flex items-center gap-1.5 truncate min-w-0">
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-accent-primary' : 'text-ink-muted'}`} />
            <span className="truncate">{key}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-fast">
            {onDeleteFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFile(item.path);
                }}
                className="p-0.5 text-ink-muted hover:text-signal-error cursor-pointer"
                title="Delete File"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className={`flex flex-col h-full bg-canvas-base border-r border-border select-none ${className}`}>
      {/* Explorer Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2 flex-shrink-0 bg-canvas-subtle">
        <div className="flex items-center gap-1.5">
          <FolderTree className="w-3.5 h-3.5 text-accent-primary" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-paper-200 font-semibold">
            Files
          </span>
          <span className="text-[10px] font-mono text-ink-muted">
            ({files.length})
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setIsCreatingFile(true); setIsCreatingFolder(false); }}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
            title="New File"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setIsCreatingFolder(true); setIsCreatingFile(false); }}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
              title="Refresh Tree"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="px-2.5 py-1.5 border-b border-border-subtle bg-canvas-surface flex items-center gap-1.5">
        <Search className="w-3 h-3 text-ink-muted flex-shrink-0" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter files..."
          className="w-full bg-transparent text-[11px] font-mono text-paper-100 placeholder:text-ink-muted focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-0.5 text-ink-muted hover:text-paper-100 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Inline Create Input */}
      {(isCreatingFile || isCreatingFolder) && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-border bg-canvas-elevated">
          <div className="flex items-center gap-1.5">
            {isCreatingFile ? <FilePlus2 className="w-3.5 h-3.5 text-accent-primary" /> : <FolderPlus className="w-3.5 h-3.5 text-accent-primary" />}
            <input
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder={isCreatingFile ? 'filename.js' : 'folder_name'}
              onKeyDown={(e) => e.key === 'Escape' && (setIsCreatingFile(false), setIsCreatingFolder(false))}
              className="flex-1 bg-canvas-base px-1.5 py-0.5 rounded-xs text-xs font-mono text-paper-100 border border-border focus:outline-none focus:border-accent-primary"
            />
          </div>
        </form>
      )}

      {/* Tree Content */}
      <div role="tree" className="flex-1 overflow-y-auto py-1 font-mono">
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-ink-muted">
            No workspace files
          </div>
        ) : (
          renderTree(tree)
        )}
      </div>
    </div>
  );
}
