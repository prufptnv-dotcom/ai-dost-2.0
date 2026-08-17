import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderTree, File, FileCode2, FileJson, FileText, FilePlus2, FolderPlus } from 'lucide-react';

export const LANG_BY_EXT = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', html: 'html', htm: 'html', css: 'css', json: 'json', md: 'markdown',
  java: 'java', go: 'go', rs: 'rust', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php', yml: 'yaml', yaml: 'yaml', xml: 'xml',
  sh: 'shell', bash: 'shell', sql: 'sql', dockerfile: 'dockerfile', docker: 'dockerfile',
  svg: 'xml', txt: 'plaintext', conf: 'plaintext', ini: 'ini', toml: 'ini',
};

const FILE_ICONS = {
  js: FileCode2, ts: FileCode2, py: FileCode2, java: FileCode2, go: FileCode2,
  rs: FileCode2, c: FileCode2, cpp: FileCode2, cs: FileCode2, rb: FileCode2,
  json: FileJson, md: FileText, html: FileCode2, css: FileCode2, default: File,
};

export const iconForFile = (path) => {
  const ext = path.split('.').pop();
  return FILE_ICONS[ext] || FILE_ICONS.default;
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

export function TreeView({ node, depth = 0, activePath, onSelect, onCtx, onNewFileInFolder, onNewFolderInFolder }) {
  const [open, setOpen] = useState(depth < 2);
  const keys = Object.keys(node || {}).filter(k => !k.startsWith('__'));
  if (keys.length === 0) return null;

  return (
    <div>
      {keys.map((key) => {
        const child = node[key];
        if (child.__file) {
          const isActive = activePath === child.path;
          const Icon = iconForFile(child.path);
          return (
            <button
              key={child.path}
              onClick={() => onSelect(child)}
              onContextMenu={(e) => { e.preventDefault(); onCtx && onCtx(e, child.path, false); }}
              className="w-full flex items-center gap-1.5 py-[3px] text-[12px] text-left transition-colors cursor-pointer"
              style={{
                paddingLeft: `${8 + depth * 12}px`,
                background: isActive ? 'rgba(75,139,252,0.18)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }} />
              <span className="truncate">{key}</span>
            </button>
          );
        }
        return (
          <div key={key}>
            <div
              className="group flex items-center w-full cursor-pointer"
              onContextMenu={(e) => { e.preventDefault(); onCtx && onCtx(e, key, true); }}
            >
              <button
                onClick={() => setOpen(!open)}
                className="flex-1 flex items-center gap-1.5 py-[3px] text-[12px] text-left transition-colors cursor-pointer"
                style={{ paddingLeft: `${8 + depth * 12}px`, color: 'var(--color-text-secondary)' }}
              >
                {open ? <ChevronDown className="w-3 h-3 shrink-0 stroke-[1.5]" /> : <ChevronRight className="w-3 h-3 shrink-0 stroke-[1.5]" />}
                <FolderTree className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />
                <span className="truncate">{key}</span>
              </button>
              <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  title={`${key} me nayi file`}
                  onClick={(e) => { e.stopPropagation(); onNewFileInFolder && onNewFileInFolder(key); }}
                  className="p-0.5 rounded hover:bg-white/10 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <FilePlus2 className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
                <button
                  title={`${key} me naya folder`}
                  onClick={(e) => { e.stopPropagation(); onNewFolderInFolder && onNewFolderInFolder(key); }}
                  className="p-0.5 rounded hover:bg-white/10 cursor-pointer"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <FolderPlus className="w-3.5 h-3.5 stroke-[1.5]" />
                </button>
              </div>
            </div>
            {open && (
              <TreeView node={child} depth={depth + 1} activePath={activePath} onSelect={onSelect} onCtx={onCtx} onNewFileInFolder={onNewFileInFolder} onNewFolderInFolder={onNewFolderInFolder} />
            )}
          </div>
        );
      })}
    </div>
  );
}