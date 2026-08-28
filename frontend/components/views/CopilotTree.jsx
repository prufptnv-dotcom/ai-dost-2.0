import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  FolderTree, 
  File, 
  FileCode2, 
  FileJson, 
  FileText, 
  FilePlus2, 
  FolderPlus, 
  Pencil, 
  Trash2,
  FileCode
} from 'lucide-react';

export const LANG_BY_EXT = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', html: 'html', htm: 'html', css: 'css', json: 'json', md: 'markdown',
  java: 'java', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php', yml: 'yaml', yaml: 'yaml', xml: 'xml',
  sh: 'shell', bash: 'shell', sql: 'sql', dockerfile: 'dockerfile', docker: 'dockerfile',
  svg: 'xml', txt: 'plaintext', conf: 'plaintext', ini: 'ini', toml: 'ini',
};

const EXT_COLORS = {
  js: 'text-amber-400',
  jsx: 'text-sky-400',
  ts: 'text-blue-400',
  tsx: 'text-sky-400',
  json: 'text-amber-300',
  css: 'text-cyan-400',
  html: 'text-orange-400',
  py: 'text-emerald-400',
  md: 'text-neutral-400',
  sql: 'text-indigo-400',
};

export const iconForFile = (path) => {
  const ext = path.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'java'].includes(ext)) return FileCode2;
  if (ext === 'json') return FileJson;
  if (ext === 'md' || ext === 'txt') return FileText;
  if (['html', 'css'].includes(ext)) return FileCode;
  return File;
};

export const colorForFile = (path) => {
  const ext = path.split('.').pop()?.toLowerCase();
  return EXT_COLORS[ext] || 'text-neutral-400';
};

export function fileTreeFromFiles(files) {
  const tree = {};
  for (const f of files || []) {
    const parts = f.path.split('/');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!node[dir]) node[dir] = {};
      node = node[dir];
    }
    node[parts[parts.length - 1]] = { __file: true, path: f.path, content: f.content || '' };
  }
  return tree;
}

export function TreeView({
  tree,
  node,
  depth = 0,
  currentPath = '',
  activePath,
  onSelect,
  onRename,
  onDelete,
  onDeleteFolder,
  onNewFileInFolder,
  onNewFolderInFolder,
  onCtx
}) {
  const rootNode = node || tree || {};
  const [open, setOpen] = useState(true);
  const keys = Object.keys(rootNode).filter(k => !k.startsWith('__'));
  if (keys.length === 0) return null;

  return (
    <div className="space-y-0.5 font-mono text-[11.5px] select-none">
      {keys.map((key) => {
        const child = rootNode[key];
        if (child.__file) {
          const isActive = activePath === child.path;
          const Icon = iconForFile(child.path);
          const iconColor = colorForFile(child.path);

          return (
            <div
              key={child.path}
              className={`group flex items-center justify-between py-1 px-1.5 rounded-md transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#161821] text-white font-medium border-l-2 border-sky-400 shadow-xs'
                  : 'text-neutral-300 hover:text-white hover:bg-white/[0.04]'
              }`}
              style={{ paddingLeft: isActive ? `${6 + depth * 12}px` : `${8 + depth * 12}px` }}
            >
              <button
                onClick={() => onSelect(child)}
                onContextMenu={(e) => { e.preventDefault(); onCtx && onCtx(e, child.path, false); }}
                className="flex-1 flex items-center gap-2 text-left truncate cursor-pointer min-w-0 pr-1"
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 stroke-[1.75] ${isActive ? 'text-sky-400' : iconColor}`} />
                <span className="truncate">{key}</span>
              </button>

              <div className="flex items-center gap-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  title="Rename file"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename && onRename(child.path);
                  }}
                  className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-sky-300 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  title="Delete file"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete && onDelete(child.path);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        }
        const fullFolderPath = currentPath ? `${currentPath}/${key}` : key;
        return (
          <div key={fullFolderPath} className="space-y-0.5">
            <div
              className="group flex items-center justify-between w-full rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer py-1 px-1.5"
              style={{ paddingLeft: `${8 + depth * 12}px` }}
              onContextMenu={(e) => { e.preventDefault(); onCtx && onCtx(e, fullFolderPath, true); }}
            >
              <button
                onClick={() => setOpen(!open)}
                className="flex-1 flex items-center gap-1.5 text-xs text-left text-neutral-300 hover:text-white font-medium transition-colors cursor-pointer min-w-0 pr-1 truncate"
              >
                {open ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                )}
                <FolderTree className="w-3.5 h-3.5 text-sky-400/90 shrink-0" />
                <span className="truncate">{key}</span>
              </button>

              <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  title={`${key} me nayi file`}
                  onClick={(e) => { e.stopPropagation(); onNewFileInFolder && onNewFileInFolder(fullFolderPath); }}
                  className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                </button>
                <button
                  title={`${key} me naya folder`}
                  onClick={(e) => { e.stopPropagation(); onNewFolderInFolder && onNewFolderInFolder(fullFolderPath); }}
                  className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  title={`Delete folder ${key}`}
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder && onDeleteFolder(fullFolderPath); }}
                  className="p-1 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {open && (
              <TreeView
                node={child}
                depth={depth + 1}
                currentPath={fullFolderPath}
                activePath={activePath}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                onDeleteFolder={onDeleteFolder}
                onNewFileInFolder={onNewFileInFolder}
                onNewFolderInFolder={onNewFolderInFolder}
                onCtx={onCtx}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
