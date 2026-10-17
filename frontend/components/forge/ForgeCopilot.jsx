import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  LuActivity, LuArrowDown, LuArrowLeft, LuArrowRight, LuArrowUp, LuArrowUpRight,
  LuBell, LuCheck, LuCheckCheck, LuChevronDown, LuChevronRight, LuCircleCheck,
  LuCircleDot, LuCloud, LuCode, LuCommand, LuCopy, LuEllipsis, LuExternalLink,
  LuFile, LuFileCode2, LuFileImage, LuFileJson, LuFileText, LuFolder, LuFolderOpen,
  LuGitBranch, LuGlobe, LuHistory, LuImage, LuLayoutDashboard, LuLightbulb,
  LuLoaderCircle, LuLockKeyhole, LuMenu, LuMessageCircle, LuMonitor,
  LuPanelLeft, LuPanelRight, LuPaperclip, LuPlay, LuPlus, LuRefreshCw, LuRocket,
  LuPalette, LuSearch, LuSend, LuSettings2, LuShieldCheck, LuSmartphone, LuSparkles,
  LuSquareTerminal, LuTerminal, LuThumbsUp, LuWandSparkles, LuX, LuZap, LuSliders,
  LuPlug, LuBookOpen, LuCheckCircle2, LuTrash2, LuSquare, LuRotateCcw,
  LuUpload, LuFolderPlus, LuPen, LuSave, LuShieldAlert
} from 'react-icons/lu';
import { fetchProject, fetchProjects, saveProjectFile, addProjectFile, deleteProjectFile, createProject, deleteProject } from '../../services/api';
import { generateLiveAppHtml } from '../ide/PreviewEngine';
import { cancelAgentRun } from '../../lib/copilotStop';
import { diffLines, diffStats } from '../../lib/lineDiff';
import CopilotMarkdown from '../ide/CopilotMarkdown';
import { MCP_REGISTRY, SKILLS_MANIFEST, PROVIDERS_SUPPORT } from './forgePlatformData';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

function displayProjectName(name, projectId) {
  const label = String(name || '').trim();
  const reservedWorkspace = ['default', 'copilot-workspace'].includes(String(projectId || '').toLowerCase());
  if (reservedWorkspace && /^copilot workspace$/i.test(label)) return 'Forge Studio Workspace';
  return label || (reservedWorkspace ? 'Forge Studio Workspace' : 'Untitled');
}

// Workspace paths are case-sensitive on Linux. Normalize separators and leading
// relative/root markers, but never fold case when verifying persisted files.
export function normalizeWorkspacePath(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

const themePresets = [
  { id: 'violet', name: 'Violet', color: '#a78bfa' },
  { id: 'ocean', name: 'Ocean', color: '#62b5ff' },
  { id: 'emerald', name: 'Emerald', color: '#63d19a' },
  { id: 'rose', name: 'Rose', color: '#ef86ad' },
  { id: 'amber', name: 'Amber', color: '#edb85f' },
  { id: 'rgb', name: 'RGB Flow', color: 'rainbow' },
];

function getFileIconAndType(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'jsx' || ext === 'tsx') return { icon: LuFileCode2, type: 'jsx' };
  if (ext === 'js' || ext === 'ts') return { icon: LuFileCode2, type: 'jsx' };
  if (ext === 'html') return { icon: LuFileCode2, type: 'html' };
  if (ext === 'css') return { icon: LuFileText, type: 'css' };
  if (ext === 'json') return { icon: LuFileJson, type: 'json' };
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico'].includes(ext)) return { icon: LuFileImage, type: 'image' };
  return { icon: LuFileText, type: 'text' };
}

function getMonacoLanguage(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jsx', 'tsx', 'js', 'ts', 'mjs'].includes(ext)) return 'javascript';
  if (ext === 'html') return 'html';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (['py', 'python'].includes(ext)) return 'python';
  if (['sh', 'bash'].includes(ext)) return 'shell';
  if (ext === 'sql') return 'sql';
  return 'plaintext';
}

function getLoggedInUser() {
  if (typeof window === 'undefined') return { name: 'Developer', initials: 'AI', role: 'Local Workspace' };
  try {
    const raw = localStorage.getItem('ai_dost_user') || localStorage.getItem('user');
    if (raw) {
      const u = typeof raw === 'string' && raw.startsWith('{') ? JSON.parse(raw) : { name: raw };
      const name = u.name || u.username || (u.email ? u.email.split('@')[0] : 'Developer');
      const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'AI';
      return { name, initials, role: u.email || 'Local Workspace' };
    }
  } catch (_) {}
  return { name: 'Developer', initials: 'AI', role: 'Local Workspace' };
}

function IconButton({ title, children, className = '', onClick, active = false, ...props }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

function ThemePicker({ theme, setTheme, customColor, setCustomColor }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const current = themePresets.find((option) => option.id === theme);

  return (
    <div className="theme-picker" ref={pickerRef}>
      <button
        className="theme-trigger"
        type="button"
        aria-label="Change workspace theme"
        aria-expanded={open}
        title="Change workspace theme"
        onClick={() => setOpen((value) => !value)}
      >
        <LuPalette size={15} />
        <span className="theme-label">Theme</span>
        <span
          className={`theme-trigger-swatch ${theme === 'rgb' ? 'rgb-swatch' : ''}`}
          style={
            theme === 'custom'
              ? { background: customColor }
              : current?.color !== 'rainbow'
              ? { background: current?.color }
              : undefined
          }
        />
      </button>
      {open && (
        <div className="theme-popover" role="dialog" aria-label="Workspace theme picker">
          <div className="theme-popover-heading">
            <b>Color theme</b>
            <small>Make the workspace yours</small>
          </div>
          <div className="theme-grid">
            {themePresets.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`theme-option ${theme === option.id ? 'selected' : ''}`}
                aria-pressed={theme === option.id}
                onClick={() => {
                  setTheme(option.id);
                  setOpen(false);
                }}
              >
                <span
                  className={`theme-option-swatch ${option.id === 'rgb' ? 'rgb-swatch' : ''}`}
                  style={option.color !== 'rainbow' ? { background: option.color } : undefined}
                />
                <span>{option.name}</span>
                {theme === option.id && <LuCheck size={12} className="theme-option-check" />}
              </button>
            ))}
          </div>
          <label className={`theme-custom-option ${theme === 'custom' ? 'selected' : ''}`}>
            <span className="custom-color-preview" style={{ background: customColor }}>
              <LuPalette size={12} />
            </span>
            <span className="custom-theme-label">Custom color</span>
            <code>{customColor.toUpperCase()}</code>
            <input
              type="color"
              aria-label="Choose custom workspace accent color"
              value={customColor}
              onChange={(event) => {
                setCustomColor(event.target.value);
                setTheme('custom');
              }}
            />
          </label>
          <div className="theme-save-note">
            <LuCheck size={11} /> Saved automatically on this device
          </div>
        </div>
      )}
    </div>
  );
}

function Rail({ activeTab, onSelectTab, user }) {
  return (
    <aside className="icon-rail" aria-label="Workspace navigation">
      <div className="rail-logo">
        <span className="forge-mark">
          <LuSparkles size={17} strokeWidth={2.4} />
        </span>
      </div>
      <div className="rail-actions">
        <button
          className={`rail-item ${activeTab === 'builder' ? 'selected' : ''}`}
          title="Forge Studio"
          onClick={() => onSelectTab('builder')}
        >
          <LuLayoutDashboard size={18} />
          {activeTab === 'builder' && <span className="rail-active-dot" />}
        </button>
        <button
          className={`rail-item ${activeTab === 'integrations' ? 'selected' : ''}`}
          title="MCP Integrations"
          onClick={() => onSelectTab('integrations')}
        >
          <LuPlug size={18} />
          {activeTab === 'integrations' && <span className="rail-active-dot" />}
        </button>
        <button
          className={`rail-item ${activeTab === 'skills' ? 'selected' : ''}`}
          title="Skills Library"
          onClick={() => onSelectTab('skills')}
        >
          <LuBookOpen size={18} />
          {activeTab === 'skills' && <span className="rail-active-dot" />}
        </button>
        <button
          className={`rail-item ${activeTab === 'overview' ? 'selected' : ''}`}
          title="Project Overview"
          onClick={() => onSelectTab('overview')}
        >
          <LuActivity size={18} />
          {activeTab === 'overview' && <span className="rail-active-dot" />}
        </button>
      </div>
      <div className="rail-bottom">
        <button
          className={`rail-item ${activeTab === 'settings' ? 'selected' : ''}`}
          title="Settings"
          onClick={() => onSelectTab('settings')}
        >
          <LuSettings2 size={18} />
          {activeTab === 'settings' && <span className="rail-active-dot" />}
        </button>
        <button className="avatar rail-avatar" title={user.name}>
          {user.initials}
        </button>
      </div>
    </aside>
  );
}

function FileSidebar({
  open,
  files = [],
  activeFile,
  setActiveFile,
  activeTab,
  onSelectTab,
  onNewProject,
  onNewFile,
  onNewFolder,
  onUploadFile,
  onRenameFile,
  onDeleteFile,
  onClose,
  projectName = 'Workspace',
  user,
  projects = [],
  onSelectProject,
  onDeleteProject,
  currentProjectId,
}) {
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState({ src: true, components: true });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const fileUploadInputRef = useRef(null);
  const projectMenuRef = useRef(null);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const handleOutside = (e) => {
      if (!projectMenuRef.current?.contains(e.target)) setProjectMenuOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [projectMenuOpen]);

  const toggleFolder = (folderName) => {
    setOpenFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
  };

  // Convert flat file list to tree view items
  const treeItems = useMemo(() => {
    if (!files || files.length === 0) return [];
    const items = [];
    const seenFolders = new Set();

    files.forEach((file) => {
      const cleanPath = (file.path || file.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      if (parts.length > 1) {
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          const folder = parts[i];
          currentPath = currentPath ? `${currentPath}/${folder}` : folder;
          if (!seenFolders.has(currentPath)) {
            seenFolders.add(currentPath);
            items.push({
              name: folder,
              path: currentPath,
              type: 'folder',
              indent: i,
              open: openFolders[folder] !== false,
            });
          }
        }
        items.push({
          name: parts[parts.length - 1],
          path: cleanPath,
          indent: parts.length - 1,
          ...getFileIconAndType(parts[parts.length - 1]),
        });
      } else {
        items.push({
          name: cleanPath,
          path: cleanPath,
          indent: 0,
          ...getFileIconAndType(cleanPath),
        });
      }
    });

    return items;
  }, [files, openFolders]);

  const filteredTree = useMemo(() => {
    if (!query) return treeItems;
    return treeItems.filter((item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.path?.toLowerCase().includes(query.toLowerCase())
    );
  }, [treeItems, query]);

  return (
    <>
      {open && <div className="mobile-scrim" onClick={onClose} />}
      <aside className={`file-sidebar ${open ? 'is-open' : ''}`}>
        <div className="workspace-switcher">
          <span className="workspace-avatar">
            <LuSparkles size={14} />
          </span>
          <span className="workspace-name">Forge Studio</span>
          <LuChevronDown size={14} className="muted-icon" />
        </div>

        <button className="new-project" onClick={onNewProject}>
          <LuPlus size={15} />
          <span>New project</span>
          <span className="shortcut">⌘ K</span>
        </button>

        <div className="nav-links">
          <button
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => onSelectTab('overview')}
          >
            <LuLayoutDashboard size={15} />
            <span>Overview</span>
            {activeTab === 'overview' && <span className="nav-dot" />}
          </button>
          <button
            className={`nav-link ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => onSelectTab('builder')}
          >
            <LuCode size={15} />
            <span>Builder</span>
            {activeTab === 'builder' && <span className="nav-dot" />}
          </button>
          <button
            className={`nav-link ${activeTab === 'deployments' ? 'active' : ''}`}
            onClick={() => onSelectTab('deployments')}
          >
            <LuGlobe size={15} />
            <span>Deployments</span>
            {activeTab === 'deployments' && <span className="nav-dot" />}
          </button>
          <button
            className={`nav-link ${activeTab === 'integrations' ? 'active' : ''}`}
            onClick={() => onSelectTab('integrations')}
          >
            <LuPlug size={15} />
            <span>MCP Connect</span>
            {activeTab === 'integrations' && <span className="nav-dot" />}
          </button>
          <button
            className={`nav-link ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => onSelectTab('skills')}
          >
            <LuBookOpen size={15} />
            <span>Skills Library</span>
            {activeTab === 'skills' && <span className="nav-dot" />}
          </button>
        </div>

        <div className="sidebar-divider" />

        <div className="project-heading relative" ref={projectMenuRef}>
          <div className="project-label">CURRENT PROJECT</div>
          <button
            className="project-switcher"
            aria-label="Current project"
            onClick={() => setProjectMenuOpen((v) => !v)}
          >
            <span className="project-initial">{projectName.charAt(0).toUpperCase()}</span>
            <span className="project-name truncate">{projectName}</span>
            <LuChevronDown size={13} className="muted-icon shrink-0" />
          </button>
          {projectMenuOpen && (
            <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-[#1e1f24] border border-zinc-700/80 rounded-lg shadow-2xl p-1.5 text-xs text-zinc-200">
              <div className="px-2 py-1 text-[10px] text-zinc-500 font-semibold tracking-wider">PROJECT WORKSPACES</div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.length > 0 ? (
                  projects.map((p) => {
                    const pId = p.project_id || p.id;
                    const pName = displayProjectName(p.project_name || p.name || 'Untitled', pId);
                    const isCurrent = pId === currentProjectId;
                    return (
                      <div
                        key={pId}
                        className={`w-full group px-2 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                          isCurrent ? 'bg-purple-950/60 text-purple-300 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProject?.(p);
                            setProjectMenuOpen(false);
                          }}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 grid place-items-center text-[10px] font-bold shrink-0">
                            {pName.charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate flex-1 text-xs">{pName}</span>
                          {isCurrent && <LuCheck size={13} className="text-purple-400 shrink-0" />}
                        </button>
                        <button
                          type="button"
                          title={`Delete project "${pName}"`}
                          aria-label={`Delete ${pName}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject?.(pId, pName);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 rounded transition-all shrink-0 cursor-pointer"
                        >
                          <LuTrash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-1.5 text-xs text-zinc-500">No other projects found</div>
                )}
              </div>
              <div className="border-t border-zinc-800 my-1" />
              <button
                onClick={() => {
                  setProjectMenuOpen(false);
                  onNewProject?.();
                }}
                className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 hover:bg-zinc-800 text-purple-400 font-medium"
              >
                <LuPlus size={14} /> New project
              </button>
            </div>
          )}
        </div>

        <div className="files-label-row">
          <span>FILES ({files.length})</span>
          <div className="file-actions">
            <IconButton title="Search files" onClick={() => searchInputRef.current?.focus()}>
              <LuSearch size={14} />
            </IconButton>
            <IconButton title="New folder" onClick={onNewFolder}>
              <LuFolderPlus size={14} />
            </IconButton>
            <IconButton title="Upload file" onClick={() => fileUploadInputRef.current?.click()}>
              <LuUpload size={14} />
            </IconButton>
            <input
              type="file"
              ref={fileUploadInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  const content = event.target?.result;
                  if (typeof content === 'string') {
                    onUploadFile?.(file.name, content);
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            <IconButton title="Add file" onClick={onNewFile}>
              <LuPlus size={14} />
            </IconButton>
          </div>
        </div>

        <div className="file-search">
          <LuSearch size={13} />
          <input
            ref={searchInputRef}
            aria-label="Find a file"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a file..."
          />
          <kbd>⌘ P</kbd>
        </div>

        <div className="file-tree" role="list" aria-label="Project files">
          {filteredTree.map((item, index) => {
            const isFolder = item.type === 'folder';
            const isActive = !isFolder && activeFile === item.path;
            const ItemIcon = isFolder
              ? item.open
                ? LuFolderOpen
                : LuFolder
              : item.icon || LuFileCode2;

            return (
              <button
                key={`${item.path || item.name}-${index}`}
                role="listitem"
                className={`tree-row group ${isActive ? 'active' : ''} ${isFolder ? 'tree-folder' : ''}`}
                style={{ '--indent': item.indent }}
                onClick={() => {
                  if (isFolder) {
                    toggleFolder(item.name);
                  } else {
                    setActiveFile(item.path);
                    onSelectTab('builder');
                  }
                }}
              >
                {item.indent > 0 && <span className="tree-guide" />}
                {isFolder ? (
                  <LuChevronRight
                    size={12}
                    className={item.open ? 'folder-chevron open' : 'folder-chevron'}
                  />
                ) : (
                  <span className="folder-chevron-spacer" />
                )}
                <ItemIcon size={14} className={`file-type-icon ${item.type || 'text'}`} />
                <span className="truncate">{item.name}</span>
                {!isFolder && (
                  <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <span
                      className="text-zinc-500 hover:text-purple-300 p-0.5 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenameFile?.(item.path);
                      }}
                      title="Rename file"
                    >
                      <LuPen size={11} />
                    </span>
                    <span
                      className="text-zinc-500 hover:text-red-400 p-0.5 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(item.path);
                      }}
                      title="Delete file"
                    >
                      <LuTrash2 size={11} />
                    </span>
                  </div>
                )}
              </button>
            );
          })}
          {filteredTree.length === 0 && (
            <div className="empty-search">
              {files.length === 0 ? 'No files yet. Message Forge AI to scaffold.' : 'No files matching search.'}
            </div>
          )}
        </div>

        <div className="sidebar-spacer" />

        <div className="sidebar-bottom-card">
          <div className="sidebar-bottom-top">
            <span className="plan-icon">
              <LuZap size={14} fill="currentColor" />
            </span>
            <span>Forge Autonomous Engine</span>
            <LuArrowUpRight size={13} />
          </div>
          <p>Multi-provider cascade &amp; real sandbox active.</p>
          <button className="upgrade-link" onClick={() => onSelectTab('settings')}>
            Configure engine <LuArrowRight size={12} />
          </button>
        </div>

        <div className="profile-row">
          <span className="avatar">{user.initials}</span>
          <span className="profile-meta">
            <strong>{user.name}</strong>
            <small>{user.role}</small>
          </span>
          <LuEllipsis size={18} className="muted-icon" />
        </div>
      </aside>
    </>
  );
}

function GitSnapshotsModal({ open, onClose, onToast, projectId, projectName }) {
  const [commits, setCommits] = useState([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND}/api/git/log`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.commits)) {
        setCommits(data.commits);
      }
    } catch (err) {
      console.warn('Failed to fetch git log:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchLogs();
  }, [open, fetchLogs]);

  const handleCreateCommit = async (e) => {
    e?.preventDefault();
    if (!commitMsg.trim()) return;
    try {
      setLoading(true);
      setStatus('Creating local snapshot...');
      const res = await fetch(`${BACKEND}/api/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMsg.trim() }),
      });
      const data = await res.json();
      if (data?.success) {
        onToast?.(data.message || 'Snapshot created successfully');
        setCommitMsg('');
        setStatus('');
        fetchLogs();
      } else {
        setStatus(data?.error || 'Failed to create commit');
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (hash) => {
    if (typeof window !== 'undefined' && !window.confirm(`Roll back workspace to commit ${hash}? Current uncommitted changes will be replaced.`)) return;
    try {
      setLoading(true);
      setStatus(`Rolling back to ${hash}...`);
      const res = await fetch(`${BACKEND}/api/git/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash }),
      });
      const data = await res.json();
      if (data?.success) {
        onToast?.(`Rolled back to ${hash}`);
        fetchLogs();
      } else {
        setStatus(data?.error || 'Failed to rollback');
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#17181c] border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#1c1d22]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <LuGitBranch size={16} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white">Git Snapshots &amp; Local Commits</h2>
              <p className="text-[11px] text-zinc-400">Offline repository version control for {projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <form onSubmit={handleCreateCommit} className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">Create New Snapshot</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message (e.g. Added dark navbar and icons)..."
                className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={loading || !commitMsg.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <LuSave size={13} /> Commit
              </button>
            </div>
            {status && <div className="text-xs text-amber-400">{status}</div>}
          </form>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 mb-2">
              <span>COMMIT HISTORY ({commits.length})</span>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                <LuRefreshCw size={11} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {commits.length > 0 ? (
                commits.map((c) => (
                  <div
                    key={c.hash}
                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                          {c.hash}
                        </span>
                        <span className="text-xs font-medium text-zinc-200 truncate">{c.message}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {c.author} · {c.date}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRollback(c.hash)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs flex items-center gap-1 shrink-0 transition-colors"
                      title="Rollback workspace to this commit"
                    >
                      <LuRotateCcw size={11} /> Rollback
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-500">
                  No local commits yet. Create your first snapshot above.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800 bg-[#1c1d22] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
function FileDiffModal({
  open,
  onClose,
  diffData,
  onRevert,
  onOpenInEditor,
}) {
  const [viewMode, setViewMode] = useState('unified');
  const [copied, setCopied] = useState(false);

  if (!open || !diffData) return null;

  const { filePath = '', oldContent = '', newContent = '', summary = '' } = diffData;
  const ops = diffLines(oldContent, newContent);
  const stats = diffStats(ops);

  const handleCopyNew = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(newContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-[#121318] border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-zinc-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80 bg-[#17181f]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <LuCode size={16} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white truncate font-mono">{filePath}</h2>
                <div className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60">
                  <span className="text-emerald-400 font-semibold">+{stats.added}</span>
                  <span className="text-rose-400 font-semibold">−{stats.removed}</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {summary || 'Reviewing modifications vs previous checkpoint'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg bg-zinc-800/70 p-0.5 border border-zinc-700/60 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Unified
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  viewMode === 'split'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Split
              </button>
            </div>

            {oldContent ? (
              <button
                type="button"
                onClick={() => onRevert?.(filePath)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors"
                title="Roll back this file to previous content"
              >
                <LuRotateCcw size={13} />
                <span>Revert File</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                onOpenInEditor?.(filePath);
                onClose?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors"
            >
              <LuExternalLink size={13} />
              <span>Editor</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <LuX size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#0a0b0e] font-mono text-[12px] leading-relaxed p-0">
          {viewMode === 'unified' ? (
            <div className="divide-y divide-zinc-800/30">
              {ops.map((op, idx) => {
                const isAdd = op.type === 'add';
                const isDel = op.type === 'del';
                return (
                  <div
                    key={idx}
                    className={`flex items-start px-4 py-0.5 select-text ${
                      isAdd
                        ? 'bg-emerald-950/25 text-emerald-200 border-l-2 border-emerald-500'
                        : isDel
                        ? 'bg-rose-950/25 text-rose-300 border-l-2 border-rose-500'
                        : 'text-zinc-400 hover:bg-zinc-900/40'
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center select-none text-[10px] font-bold opacity-60">
                      {isAdd ? '+' : isDel ? '−' : ' '}
                    </span>
                    <span className="w-10 shrink-0 text-right pr-3 select-none text-[10px] opacity-35">
                      {idx + 1}
                    </span>
                    <pre className="flex-1 overflow-x-auto whitespace-pre font-mono m-0 py-0.5">
                      {op.text || ' '}
                    </pre>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-zinc-800 min-h-full">
              <div className="flex flex-col">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-400 bg-zinc-900/80 border-b border-zinc-800 sticky top-0 flex items-center justify-between">
                  <span>PREVIOUS CHECKPOINT</span>
                  <span>{oldContent ? oldContent.split('\n').length + ' lines' : 'Empty'}</span>
                </div>
                <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
                  {oldContent ? (
                    oldContent.split('\n').map((line, idx) => (
                      <div key={idx} className="flex hover:bg-zinc-900/40">
                        <span className="w-8 shrink-0 text-right pr-3 select-none text-zinc-600 text-[10px]">{idx + 1}</span>
                        <pre className="whitespace-pre text-zinc-400 m-0">{line || ' '}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 italic py-8 text-center text-xs">No previous revision recorded (New file)</div>
                  )}
                </div>
              </div>
              <div className="flex flex-col">
                <div className="px-4 py-1.5 text-[10px] font-semibold text-emerald-400 bg-zinc-900/80 border-b border-zinc-800 sticky top-0 flex items-center justify-between">
                  <span>CURRENT AI REVISION</span>
                  <span>{newContent ? newContent.split('\n').length + ' lines' : 'Empty'}</span>
                </div>
                <div className="p-3 font-mono text-[11px] leading-relaxed overflow-x-auto">
                  {newContent.split('\n').map((line, idx) => (
                    <div key={idx} className="flex hover:bg-zinc-900/40">
                      <span className="w-8 shrink-0 text-right pr-3 select-none text-zinc-600 text-[10px]">{idx + 1}</span>
                      <pre className="whitespace-pre text-zinc-200 m-0">{line || ' '}</pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-t border-zinc-800 bg-[#17181f] text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Diff generated from working tree memory</span>
          </div>
          <button
            type="button"
            onClick={handleCopyNew}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            {copied ? <LuCheck size={12} className="text-emerald-400" /> : <LuCopy size={12} />}
            <span>{copied ? 'Copied Content!' : 'Copy Current Code'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Topbar({
  onToggleFiles,
  onToggleAssistant,
  onDeploy,
  onShare,
  onOpenGit,
  mobile,
  theme,
  setTheme,
  customColor,
  setCustomColor,
  projectName = 'Workspace',
  activeTab,
  saved,
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton title="Toggle files" className="topbar-panel-button" onClick={onToggleFiles}>
          <LuPanelLeft size={17} />
        </IconButton>
        <div className="breadcrumb">
          <span className="crumb-project truncate max-w-[150px]">{projectName}</span>
          <LuChevronRight size={13} />
          <strong>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
        </div>
        <button
          className="topbar-branch hover:bg-zinc-800/80 px-2 py-0.5 rounded cursor-pointer transition-colors border-0 bg-transparent"
          onClick={onOpenGit}
          title="Git Snapshots & Local Commits"
        >
          <LuGitBranch size={12} /> main
        </button>
      </div>
      <div className="topbar-right">
        <div className="save-state">
          <span className={`save-dot ${saved ? '' : 'bg-amber-400'}`} /> {saved ? 'Saved' : 'Saving...'}
        </div>
        <ThemePicker
          theme={theme}
          setTheme={setTheme}
          customColor={customColor}
          setCustomColor={setCustomColor}
        />
        <IconButton title="Notifications" className="notification-button">
          <LuBell size={16} />
          <i />
        </IconButton>
        <button className="share-button" onClick={onShare}>
          <LuExternalLink size={14} />
          <span>Share</span>
        </button>
        <button className="deploy-button" onClick={onDeploy}>
          <LuRocket size={14} />
          <span>Deploy</span>
        </button>
        {mobile && (
          <IconButton
            title="Open assistant"
            className="topbar-panel-button ai-topbar-button"
            onClick={onToggleAssistant}
          >
            <LuMessageCircle size={17} />
          </IconButton>
        )}
      </div>
    </header>
  );
}

function Toolbar({
  mode,
  setMode,
  device,
  setDevice,
  onRefresh,
  onRun,
  isRunning,
  onToggleAssistant,
  inspectorActive = false,
  onToggleInspector,
  onOpenDiff,
  mobile,
}) {
  return (
    <div className="editor-toolbar">
      <div className="mode-tabs" role="tablist" aria-label="Workspace view">
        <button
          className={mode === 'preview' ? 'selected' : ''}
          onClick={() => setMode('preview')}
          role="tab"
          aria-selected={mode === 'preview'}
        >
          <LuGlobe size={14} /> Preview
        </button>
        <button
          className={mode === 'code' ? 'selected' : ''}
          onClick={() => setMode('code')}
          role="tab"
          aria-selected={mode === 'code'}
        >
          <LuCode size={14} /> Code
        </button>
        <button
          className={mode === 'terminal' ? 'selected' : ''}
          onClick={() => setMode('terminal')}
          role="tab"
          aria-selected={mode === 'terminal'}
        >
          <LuTerminal size={14} /> Terminal
        </button>
      </div>
      <div className="editor-tools">
        {mode === 'preview' && (
          <div className="device-switch" aria-label="Preview size">
            <IconButton
              title="Desktop preview"
              active={device === 'desktop'}
              onClick={() => setDevice('desktop')}
            >
              <LuMonitor size={15} />
            </IconButton>
            <IconButton
              title="Mobile preview"
              active={device === 'mobile'}
              onClick={() => setDevice('mobile')}
            >
              <LuSmartphone size={15} />
            </IconButton>
            <IconButton
              title={inspectorActive ? 'Deactivate visual inspector' : 'Click to Inspect & Edit with AI (Lovable Mode)'}
              active={inspectorActive}
              onClick={onToggleInspector}
              className={inspectorActive ? 'active !text-indigo-400 !border-indigo-500' : ''}
            >
              <LuSearch size={15} />
            </IconButton>
          </div>
        )}
        {onOpenDiff && (
          <IconButton
            title="Inspect latest changes & diffs (Unified / Split)"
            onClick={onOpenDiff}
            className="hover:!text-indigo-400"
          >
            <LuSliders size={15} />
          </IconButton>
        )}
        <span className="toolbar-separator" />
        <IconButton title="Refresh preview" onClick={onRefresh}>
          <LuRefreshCw size={15} />
        </IconButton>
        <button className={`run-button ${isRunning ? 'running' : ''}`} onClick={onRun}>
          {isRunning ? (
            <LuLoaderCircle size={14} className="spin" />
          ) : (
            <LuPlay size={13} fill="currentColor" />
          )}
          <span>{isRunning ? 'Building...' : 'Run'}</span>
        </button>
        {mobile && (
          <IconButton
            title="Open assistant"
            className="mobile-ai-icon"
            onClick={onToggleAssistant}
          >
            <LuMessageCircle size={16} />
          </IconButton>
        )}
        <IconButton title="More preview options">
          <LuEllipsis size={17} />
        </IconButton>
      </div>
    </div>
  );
}

function CodeEditorView({
  activeFile,
  code,
  onChangeCode,
  onSaveCode,
  saved,
  onOpenDiff,
  tabs = [],
  onSelectTab,
  onCloseTab,
}) {
  const lineCount = useMemo(() => (code || '').split('\n').length, [code]);
  const lang = useMemo(() => getMonacoLanguage(activeFile), [activeFile]);

  // Handle Ctrl+S / Cmd+S and Ctrl+W (close active tab)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSaveCode?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w' && activeFile) {
        e.preventDefault();
        onCloseTab?.(activeFile);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSaveCode, onCloseTab, activeFile]);

  const effectiveTabs = tabs && tabs.length > 0 ? tabs : (activeFile ? [activeFile] : []);

  return (
    <div className="code-editor flex flex-col h-full bg-[#17181b] border border-zinc-800 rounded-lg overflow-hidden">
      {/* Multi-Tab Strip */}
      <div className="code-tab-strip flex items-center bg-[#131418] border-b border-zinc-800 text-xs overflow-x-auto select-none min-h-[38px]">
        <div className="flex items-center min-w-0 flex-1 overflow-x-auto">
          {effectiveTabs.map((tabPath) => {
            const isActive = tabPath === activeFile;
            const fileName = tabPath.split('/').pop() || tabPath;
            const { icon: FileIcon } = getFileIconAndType(tabPath);
            return (
              <div
                key={tabPath}
                onClick={() => onSelectTab?.(tabPath)}
                className={`group flex items-center gap-1.5 px-3 py-2 border-r border-zinc-800/80 cursor-pointer font-mono text-xs transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#1c1d22] text-white border-t-2 border-t-indigo-500 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
                title={tabPath}
              >
                <FileIcon size={13} className={isActive ? 'text-indigo-400' : 'text-zinc-500'} />
                <span className="truncate max-w-[130px]">{fileName}</span>
                {isActive && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${saved ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    title={saved ? 'Saved' : 'Modified'}
                  />
                )}
                {effectiveTabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab?.(tabPath);
                    }}
                    className="ml-1 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-zinc-700/60 opacity-50 group-hover:opacity-100 transition-opacity"
                    title="Close tab (Ctrl+W)"
                  >
                    <LuX size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 px-3 shrink-0 bg-[#131418]">
          <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
            {lineCount} lines · {lang}
          </span>
          {onOpenDiff && activeFile && (
            <button
              type="button"
              onClick={() => onOpenDiff(activeFile)}
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium flex items-center gap-1 transition-colors border border-zinc-700/80"
              title="Compare modifications against checkpoint"
            >
              <LuSliders size={12} /> Diff
            </button>
          )}
          <button
            type="button"
            onClick={onSaveCode}
            className="text-xs px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-1 shadow-sm transition-colors"
            title="Save file (Ctrl+S)"
          >
            <LuSave size={12} /> Save
          </button>
        </div>
      </div>
      <div className="code-scroll relative flex-1 min-h-0 bg-[#151619]">
        {typeof window !== 'undefined' && process.env.NODE_ENV !== 'test' ? (
          <MonacoEditor
            height="100%"
            language={lang}
            theme="vs-dark"
            value={code || ''}
            onChange={(val) => onChangeCode(val || '')}
            options={{
              fontSize: 12,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              automaticLayout: true,
              tabSize: 2,
              fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            }}
          />
        ) : (
          <div className="flex w-full h-full p-4">
            <div className="select-none pr-3 text-right font-mono text-[11px] text-zinc-600 border-r border-zinc-800">
              {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
                <div key={i} className="leading-[1.85]">{String(i + 1).padStart(2, '0')}</div>
              ))}
            </div>
            <textarea
              value={code || ''}
              onChange={(e) => onChangeCode(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full pl-4 bg-transparent outline-none resize-none font-mono text-[11px] leading-[1.85] text-zinc-200"
              placeholder="File content..."
            />
          </div>
        )}
      </div>
      <div className="code-status flex items-center gap-4 px-3 py-1.5 bg-[#1c1d20] border-t border-zinc-800 text-[10px] text-zinc-500 font-mono">
        <span className="flex items-center gap-1 text-zinc-400">
          <LuGitBranch size={11} /> main
        </span>
        <span>Lines: {lineCount}</span>
        <span className="uppercase text-purple-400 font-semibold">{lang}</span>
        <span>UTF-8</span>
        <span className="ml-auto text-zinc-400">{saved ? 'All changes saved' : 'Press Ctrl+S to save'}</span>
      </div>
    </div>
  );
}

function RealTerminalView({ logs = [], projectName, onExecuteCommand, onClearLogs }) {
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const termEndRef = useRef(null);

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = cmd.trim();
    if (!trimmed || isExecuting) return;

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIdx(-1);
    setCmd('');
    setIsExecuting(true);
    try {
      await onExecuteCommand?.(trimmed);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCmd(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setCmd('');
      } else {
        setHistoryIdx(nextIdx);
        setCmd(history[nextIdx] || '');
      }
    }
  };

  return (
    <div className="terminal-view flex flex-col h-full bg-[#151619] border border-zinc-800 rounded-lg overflow-hidden">
      <div className="terminal-header flex items-center justify-between px-3 py-2 bg-[#1c1d22] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="terminal-tab flex items-center gap-1.5 text-zinc-200 text-xs font-mono">
            <LuTerminal size={14} className="text-purple-400" />
            <span>Terminal</span>
          </div>
          <span className="terminal-session text-[10px] text-zinc-500 font-mono">zsh · 80 × 24</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onClearLogs}
            className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Clear terminal output"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Quick Pills */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17181c] border-b border-zinc-800/80 text-[10px] overflow-x-auto">
        <span className="text-zinc-500 font-medium shrink-0">Quick:</span>
        {[
          { label: 'npm test', cmd: 'npm test' },
          { label: 'git status', cmd: 'git status' },
          { label: 'ls -la', cmd: 'ls' },
          { label: 'npm run dev', cmd: 'npm run dev' },
          { label: 'node -v', cmd: 'node -v' },
        ].map((pill) => (
          <button
            key={pill.label}
            onClick={() => onExecuteCommand?.(pill.cmd)}
            disabled={isExecuting}
            className="px-2 py-0.5 rounded bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 font-mono text-[10px] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="terminal-content flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
        <div>
          <span className="terminal-prompt text-emerald-400 font-bold">➜</span>{' '}
          <b className="text-purple-300">~/{projectName}</b>{' '}
          <span className="terminal-branch text-amber-400">git:(main)</span>
        </div>
        <div className="terminal-success text-emerald-400 flex items-center gap-1.5 text-[11px]">
          <LuCircleCheck size={13} /> Interactive terminal ready. Type a command below or click a quick pill.
        </div>

        {logs.map((log, idx) => (
          <div key={idx} className="terminal-muted whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
            {log}
          </div>
        ))}

        {isExecuting && (
          <div className="flex items-center gap-2 text-purple-400 text-xs py-1">
            <LuLoaderCircle size={12} className="spin" /> Executing command...
          </div>
        )}

        {/* Real Interactive Input Line */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 text-xs">
          <span className="terminal-prompt text-emerald-400 font-bold">➜</span>
          <span className="text-purple-300 font-semibold font-mono text-xs">~/{projectName}</span>
          <span className="text-zinc-500 font-mono text-xs">$</span>
          <input
            type="text"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type command (e.g. npm test, ls) and hit Enter..."
            disabled={isExecuting}
            className="flex-1 bg-transparent outline-none border-none text-zinc-100 font-mono text-xs placeholder-zinc-600 focus:ring-0 p-0"
          />
        </form>
        <div ref={termEndRef} />
      </div>
    </div>
  );
}

function WorkingActivityCard({
  activeStep,
  stepLabel,
  detail,
  activeSpecialist,
  liveActivities = [],
  sessionFilesWritten = [],
  elapsedSeconds = 0,
  onOpenFile,
  onOpenDiff,
  onRetry,
  lastError,
}) {
  const defaultSteps = [
    'Understanding requirement',
    'Analyzing codebase files',
    'Generating code changes',
    'Testing & verifying build',
  ];
  const progress = Math.min(100, Math.round(((activeStep + 0.8) / defaultSteps.length) * 100));

  const formatTime = (secs = 0) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="workflow-card" aria-live="polite">
      <div className="workflow-header">
        <span className="workflow-spark">
          <LuSparkles size={13} />
        </span>
        <div className="workflow-title">
          <b>Working through your request</b>
          <small>
            Autonomous loop · step {activeStep + 1} of {defaultSteps.length}
            {activeSpecialist ? ` · ${activeSpecialist.specialty || activeSpecialist.role || 'Specialist'}` : ''}
          </small>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {elapsedSeconds > 0 && (
            <span className="live-timer-chip">
              ⏱ {formatTime(elapsedSeconds)}
            </span>
          )}
          <span className="workflow-live">
            <i /> LIVE
          </span>
        </div>
      </div>

      <div className="workflow-progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      {/* Specialist & Current Objective Banner */}
      {activeSpecialist && (
        <div className="mt-2 mb-1 p-2 rounded bg-violet-950/40 border border-violet-800/40 text-[8.5px] text-violet-200">
          <div className="flex items-center gap-1.5 font-semibold text-violet-300">
            <LuZap size={11} className="text-violet-400" />
            <span>Specialist: {activeSpecialist.specialty || activeSpecialist.role}</span>
            {activeSpecialist.attempt && (
              <span className="text-[7.5px] px-1 py-0.5 rounded bg-violet-800/50 text-violet-200">
                Attempt {activeSpecialist.attempt}/3
              </span>
            )}
          </div>
          {activeSpecialist.objective && (
            <div className="mt-0.5 text-zinc-300 line-clamp-2">
              {activeSpecialist.objective}
            </div>
          )}
        </div>
      )}

      {/* Standard Step Progress Checklist */}
      <div className="workflow-steps">
        {defaultSteps.map((step, index) => {
          const state = index < activeStep ? 'complete' : index === activeStep ? 'active' : 'pending';
          return (
            <div className={`workflow-step ${state}`} key={step}>
              <span className="workflow-step-icon">
                {state === 'complete' ? (
                  <LuCheck size={11} />
                ) : state === 'active' ? (
                  <LuLoaderCircle size={12} className="spin" />
                ) : (
                  <LuCircleDot size={11} />
                )}
              </span>
              <span>{step}</span>
              {state === 'active' && <span className="workflow-now">in progress</span>}
            </div>
          );
        })}
      </div>

      {/* Real-time Granular Stream / Activity Timeline (Devin / Bolt / Replit Style) */}
      {liveActivities && liveActivities.length > 0 && (
        <div className="live-activity-stream mt-2">
          <div className="live-stream-header">
            <LuActivity size={11} className="text-violet-400" />
            <span className="text-[8px] font-semibold text-zinc-200">Real-Time Execution Stream</span>
            <span className="text-[7.5px] text-zinc-400 ml-auto">
              {liveActivities.length} action{liveActivities.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="live-activity-list">
            {liveActivities.slice(-10).map((act, idx) => {
              const isRunning = act.status === 'running';
              const isDone = act.status === 'done';
              const isFailed = act.status === 'failed';
              return (
                <div key={act.id || idx} className={`live-activity-row ${act.status || ''}`}>
                  <span className="mt-0.5 shrink-0">
                    {isRunning ? (
                      <LuLoaderCircle size={10} className="spin text-violet-400" />
                    ) : isDone ? (
                      <LuCheck size={10} className="text-emerald-400" />
                    ) : isFailed ? (
                      <LuX size={10} className="text-rose-400" />
                    ) : (
                      <LuCircleDot size={10} className="text-zinc-500" />
                    )}
                  </span>

                  <span className={`live-action-badge ${act.type || 'tool'}`}>
                    {act.badge || (act.type || 'act').toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-zinc-200 text-[8px] truncate">
                      {act.title}
                    </div>
                    {act.file && (
                      <button
                        type="button"
                        onClick={() => onOpenFile?.(act.file)}
                        className="live-file-btn mt-0.5"
                        title="Open in editor"
                      >
                        <LuCode size={9} />
                        <span>{act.file}</span>
                        {act.diff && (
                          <span className="flex items-center gap-1 ml-1 font-mono text-[7px]">
                            {act.diff.added > 0 && <span className="diff-tag-add">+{act.diff.added}</span>}
                            {act.diff.removed > 0 && <span className="diff-tag-sub">−{act.diff.removed}</span>}
                          </span>
                        )}
                      </button>
                    )}
                    {act.detail && !act.file && (
                      <div className="text-zinc-400 text-[7px] truncate mt-0.5">
                        {act.detail}
                      </div>
                    )}
                  </div>

                  <span className="text-[7px] text-zinc-500 font-mono shrink-0 ml-auto">
                    {act.time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Modified Tray (Click to Inspect / Diff) */}
      {sessionFilesWritten && sessionFilesWritten.length > 0 && (
        <div className="live-modified-tray mt-2 rounded bg-zinc-900/60 border border-zinc-800 p-1.5">
          <span className="text-[7.5px] font-semibold text-zinc-400 mr-1 flex items-center gap-1">
            <LuFileCode2 size={10} className="text-emerald-400" />
            Files changed ({sessionFilesWritten.length}):
          </span>
          <div className="flex flex-wrap gap-1">
            {sessionFilesWritten.map((f, i) => (
              <div key={i} className="inline-flex items-center rounded overflow-hidden border border-zinc-700/60 bg-zinc-800/80 text-[9px]">
                <button
                  type="button"
                  onClick={() => onOpenFile?.(f.path)}
                  className="px-2 py-0.5 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                  title={`Open ${f.path} in editor`}
                >
                  <span>{f.path.split('/').pop() || f.path}</span>
                </button>
                {onOpenDiff && (
                  <button
                    type="button"
                    onClick={() => onOpenDiff(f.path)}
                    className="px-1.5 py-0.5 border-l border-zinc-700/80 hover:bg-indigo-600/30 text-indigo-300 flex items-center gap-0.5 font-mono text-[8px]"
                    title={`Review Diff & Rollback for ${f.path}`}
                  >
                    {f.added !== undefined && <span className="text-emerald-400 font-semibold">+{f.added}</span>}
                    {f.removed !== undefined && <span className="text-rose-400 font-semibold">−{f.removed}</span>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Thought / Current Status Subtitle */}
      <div className="workflow-detail">
        <span className="workflow-pulse" />
        <span className="truncate">{detail || stepLabel || 'Executing autonomous edits...'}</span>
      </div>

      {/* Error Card with Retry Button if Failed */}
      {lastError && (
        <div className="live-error-card mt-2">
          <div className="flex items-center gap-1.5 font-semibold text-rose-300">
            <LuShieldAlert size={12} />
            <span>Execution stopped</span>
          </div>
          <div className="mt-1 text-zinc-300 text-[8px] line-clamp-3">
            {lastError}
          </div>
          {onRetry && (
            <div className="live-error-actions">
              <button type="button" onClick={onRetry} className="live-retry-btn">
                <LuRotateCcw size={10} /> Retry with cascade
              </button>
            </div>
          )}
        </div>
      )}

      <div className="workflow-note">
        Forge autonomous loop · connected to backend cascade (NVIDIA, DeepSeek, Mistral, Groq, Gemini)
      </div>
    </div>
  );
}

function AssistantPanel({
  open,
  onClose,
  autopilot,
  setAutopilot,
  prompt,
  setPrompt,
  messages,
  onSubmit,
  onStop,
  onToast,
  isAssistantWorking,
  activityStep,
  activityDetail,
  agentPlan,
  lastAction,
  projectName,
  user,
  files = [],
  activeSpecialist = null,
  liveActivities = [],
  sessionFilesWritten = [],
  elapsedSeconds = 0,
  lastError = null,
  pendingApproval = null,
  onApprove,
  onOpenFile,
  onOpenDiff,
  onRetry,
  selectedElement = null,
  onClearSelectedElement,
  runtimeError = null,
  onAutoFixRuntimeError,
}) {
  const listRef = useRef(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachInputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isAssistantWorking, activityStep, agentPlan]);

  const handleAttachWorkspaceFile = (filePath) => {
    setPrompt((prev) => (prev ? `${prev} @${filePath} ` : `@${filePath} `));
    setAttachMenuOpen(false);
    onToast?.(`Referenced @${filePath}`);
  };

  const handleUploadAttachment = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setPrompt((prev) => `${prev ? prev + '\n\n' : ''}[File: ${file.name}]\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``);
        onToast?.(`Attached ${file.name} to prompt`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setAttachMenuOpen(false);
  };

  return (
    <>
      {open && <div className="mobile-scrim assistant-scrim" onClick={onClose} />}
      <aside className={`assistant-panel ${open ? 'is-open' : ''}`}>
        <div className="assistant-header">
          <div className="assistant-title">
            <span className="assistant-mark">
              <LuSparkles size={16} />
            </span>
            <div>
              <strong>Forge AI</strong>
              <span>Autonomous builder</span>
            </div>
          </div>
          <div className="assistant-head-actions">
            <button
              className={`autopilot-toggle ${autopilot ? 'on' : ''}`}
              onClick={() => setAutopilot(!autopilot)}
            >
              <span className="toggle-dot" /> Autopilot {autopilot ? 'on' : 'off'}
            </button>
            <IconButton
              title="Close assistant"
              className="assistant-close"
              onClick={onClose}
            >
              <LuX size={17} />
            </IconButton>
          </div>
        </div>

        <div className="task-context">
          <span className="task-context-dot">
            <LuWandSparkles size={13} />
          </span>
          <span className="truncate">
            <b>Building</b> · {projectName}
          </span>
          <LuChevronDown size={13} className="ml-auto shrink-0" />
        </div>

        <div className="assistant-thread" ref={listRef}>
          {/* Welcome Message */}
          <div className="assistant-message">
            <span className="message-avatar">
              <LuSparkles size={13} />
            </span>
            <div className="message-body">
              <div className="message-meta">
                <strong>Forge AI</strong>
                <span>Just now</span>
              </div>
              <p>
                Hello! I am ready to build, modify, or debug <b>{projectName}</b>. Type your prompt below to start.
              </p>

              {/* Dynamic Real Agent Plan Checklist if active */}
              {agentPlan && agentPlan.length > 0 && (
                <div className="build-summary my-2">
                  <div className="summary-heading">
                    <LuCheckCheck size={14} />
                    <span>Build plan</span>
                    <span className="summary-done">
                      {agentPlan.filter((s) => s.status === 'done' || s.status === 'COMPLETED').length} of {agentPlan.length} done
                    </span>
                  </div>
                  {agentPlan.map((step, idx) => {
                    const isDone = step.status === 'done' || step.status === 'COMPLETED';
                    const isActive = step.status === 'running' || step.status === 'active';
                    return (
                      <div
                        key={idx}
                        className={`summary-item ${isDone ? 'done' : isActive ? 'in-progress' : ''}`}
                      >
                        <span className="summary-check">
                          {isDone ? (
                            <LuCheck size={11} />
                          ) : isActive ? (
                            <span className="summary-spinner" />
                          ) : (
                            <LuCircleDot size={11} />
                          )}
                        </span>
                        <span className="truncate">{step.title || step.label || step.description || `Task ${idx + 1}`}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Real Last Action Card */}
              {lastAction && (
                <div
                  className="agent-action-card cursor-pointer hover:border-indigo-500/50 transition-colors"
                  onClick={() => onOpenDiff?.(lastAction.file)}
                  title="Click to inspect diff and rollback"
                >
                  <div className="agent-action-top">
                    <span className="agent-action-icon">
                      <LuCode size={12} />
                    </span>
                    <div>
                      <b>Last action</b>
                      <small>
                        Updated <code>{lastAction.file}</code>
                      </small>
                    </div>
                    <LuCircleCheck size={14} className="agent-action-check ml-auto" />
                  </div>
                  <div className="agent-action-bottom">
                    <span className="diff-added">+{lastAction.added || 0}</span>
                    <span className="diff-removed">−{lastAction.removed || 0}</span>
                    <span className="truncate">{lastAction.summary || 'Code modifications verified'}</span>
                    {onOpenDiff && (
                      <span className="ml-auto text-[9px] text-indigo-400 flex items-center gap-0.5 underline">
                        Diff
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          {messages.map((message, index) => (
            <div key={index} className={`chat-entry ${message.role}`}>
              {message.role === 'assistant' && (
                <span className="message-avatar">
                  <LuSparkles size={13} />
                </span>
              )}
              <div className="chat-bubble-wrap">
                <div className="message-meta">
                  <strong>{message.role === 'user' ? user.name : 'Forge AI'}</strong>
                  <span>{message.time}</span>
                </div>
                <div className="chat-bubble">
                  {message.role === 'assistant' ? (
                    <>
                      <CopilotMarkdown text={message.text} />
                      {message.files && message.files.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-zinc-700/40 flex flex-wrap gap-1">
                          <span className="text-[7.5px] text-zinc-400 font-semibold w-full">Modified Files:</span>
                          {message.files.map((fp, fi) => {
                            const filePath = typeof fp === 'string' ? fp : fp.path;
                            return (
                              <div key={fi} className="inline-flex items-center rounded bg-zinc-800/90 border border-zinc-700/60 overflow-hidden text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => onOpenFile?.(filePath)}
                                  className="px-2 py-0.5 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                                  title="Open in editor"
                                >
                                  <LuCode size={9} />
                                  <span>{filePath.split('/').pop()}</span>
                                </button>
                                {onOpenDiff && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenDiff(filePath)}
                                    className="px-1.5 py-0.5 border-l border-zinc-700 hover:bg-indigo-600/30 text-indigo-300"
                                    title="Inspect changes & rollback"
                                  >
                                    <LuSliders size={9} />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {message.error && onRetry && (
                        <div className="mt-2 pt-1.5 border-t border-rose-900/30">
                          <button
                            type="button"
                            onClick={onRetry}
                            className="live-retry-btn"
                          >
                            <LuRotateCcw size={10} /> Retry with cascade
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.text}</div>
                  )}
                </div>
              </div>
              {message.role === 'user' && <span className="avatar message-user-avatar">{user.initials}</span>}
            </div>
          ))}

          {/* Working Activity Live Card */}
          {isAssistantWorking && (
            <div className="activity-entry">
              <span className="message-avatar activity-avatar">
                <LuSparkles size={13} />
              </span>
              <WorkingActivityCard
                activeStep={activityStep}
                detail={activityDetail}
                activeSpecialist={activeSpecialist}
                liveActivities={liveActivities}
                sessionFilesWritten={sessionFilesWritten}
                elapsedSeconds={elapsedSeconds}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
                onRetry={onRetry}
                lastError={lastError}
              />
            </div>
          )}
          {pendingApproval?.token && (
            <div className="approval-banner rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs" role="alert">
              <p className="mb-2">{pendingApproval.message || 'Forge needs your approval before continuing.'}</p>
              <button type="button" onClick={onApprove} disabled={isAssistantWorking} className="rounded-md bg-amber-300 px-3 py-1.5 font-semibold text-zinc-950 disabled:opacity-50">
                Approve and continue
              </button>
            </div>
          )}
        </div>

        <div className="assistant-bottom">
          <div className="suggestion-row">
            <button onClick={() => setPrompt('Add responsive navigation and mobile menu')}>
              <LuSmartphone size={12} /> Mobile menu
            </button>
            <button onClick={() => setPrompt('Audit for WCAG accessibility and keyboard navigation')}>
              <LuShieldCheck size={12} /> Accessibility
            </button>
            <button onClick={() => setPrompt('Refactor styling with modern CSS variables')}>
              <LuPalette size={12} /> CSS variables
            </button>
          </div>

          {selectedElement && (
            <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg bg-indigo-950/70 border border-indigo-500/50 text-xs text-indigo-200">
              <LuSearch size={13} className="text-indigo-400 shrink-0" />
              <span className="font-mono text-[11px] truncate flex-1">
                Target: &lt;{selectedElement.tag}{selectedElement.className ? '.' + String(selectedElement.className).split(' ')[0] : ''}&gt;
                {selectedElement.text ? ` "${selectedElement.text.slice(0, 24)}"` : ''}
              </span>
              <button
                type="button"
                onClick={onClearSelectedElement}
                className="p-1 hover:text-white text-indigo-400 cursor-pointer"
                title="Clear targeted element"
              >
                <LuX size={12} />
              </button>
            </div>
          )}

          {runtimeError && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 mb-2 rounded-lg bg-red-950/70 border border-red-500/50 text-xs text-red-200">
              <div className="flex items-center gap-2 truncate">
                <LuShieldAlert size={14} className="text-red-400 shrink-0" />
                <span className="truncate font-mono text-[11px]">{runtimeError.error || 'Preview runtime error'}</span>
              </div>
              <button
                type="button"
                onClick={() => onAutoFixRuntimeError?.(runtimeError.error)}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold text-[11px] rounded-md shrink-0 transition shadow-sm cursor-pointer"
              >
                ⚡ Auto-Fix
              </button>
            </div>
          )}

          <form className="prompt-composer" onSubmit={onSubmit}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isAssistantWorking
                  ? 'Forge is executing autonomous changes…'
                  : 'Ask Forge AI to build or edit anything...'
              }
              aria-label="Message Forge AI"
              rows="2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form.requestSubmit();
                }
              }}
            />
            <div className="composer-footer">
              <div className="relative">
                <button
                  type="button"
                  className="composer-tool"
                  title="Attach file context"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                >
                  <LuPaperclip size={15} />
                </button>
                {attachMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-64 bg-[#1e1f24] border border-zinc-700/80 rounded-xl shadow-2xl p-2 z-50 text-xs text-zinc-200">
                    <div className="text-[10px] text-zinc-500 font-semibold px-2 py-1">ATTACH TO CONTEXT</div>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {files.length > 0 ? (
                        files.map((f) => (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => handleAttachWorkspaceFile(f.path)}
                            className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] truncate flex items-center gap-1.5"
                          >
                            <LuFileCode2 size={12} className="text-purple-400 shrink-0" />
                            <span className="truncate">{f.path}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-1 text-zinc-500 text-[11px]">No files in workspace</div>
                      )}
                    </div>
                    <div className="border-t border-zinc-800 my-1" />
                    <button
                      type="button"
                      onClick={() => attachInputRef.current?.click()}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-800 text-purple-400 font-medium flex items-center gap-1.5"
                    >
                      <LuUpload size={13} /> Upload external file
                    </button>
                    <input
                      type="file"
                      ref={attachInputRef}
                      className="hidden"
                      onChange={handleUploadAttachment}
                    />
                  </div>
                )}
              </div>

              <span className="composer-hint">
                {isAssistantWorking ? (
                  <>
                    <LuLoaderCircle size={11} className="spin" /> Executing…
                  </>
                ) : (
                  <>
                    <LuCommand size={11} /> Enter to send
                  </>
                )}
              </span>

              {isAssistantWorking ? (
                <button
                  type="button"
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1"
                  onClick={onStop}
                  title="Stop agent run"
                >
                  <LuSquare size={11} /> Stop
                </button>
              ) : (
                <button
                  type="submit"
                  className={`send-button ${prompt.trim() ? 'ready' : ''}`}
                  aria-label="Send message"
                  disabled={!prompt.trim()}
                >
                  <LuArrowUp size={16} />
                </button>
              )}
            </div>
          </form>
          <div className="assistant-disclaimer">
            Forge autonomous loop executes safe diff edits. Review before deploying.
          </div>
        </div>
      </aside>
    </>
  );
}

function OverviewPage({ onSwitchToBuilder, onToast, projectName, files = [] }) {
  const lineCount = useMemo(() => {
    return files.reduce((acc, f) => acc + (f.content ? f.content.split('\n').length : 1), 0);
  }, [files]);

  return (
    <div className="p-8 max-w-5xl mx-auto overflow-y-auto w-full h-full text-zinc-200">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LuSparkles className="text-purple-400" /> {projectName}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Autonomous workspace · Connected to real project repository</p>
        </div>
        <button
          onClick={onSwitchToBuilder}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <LuCode size={16} /> Open Builder
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-semibold">STATUS</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Ready
          </div>
          <div className="text-xs text-zinc-500 mt-1">Sandbox environment synced</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-semibold">TOTAL FILES</div>
          <div className="text-xl font-bold text-white mt-1">{files.length}</div>
          <div className="text-xs text-zinc-500 mt-1">Real repository workspace</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-semibold">TOTAL LINES OF CODE</div>
          <div className="text-xl font-bold text-purple-400 mt-1">{lineCount}</div>
          <div className="text-xs text-zinc-500 mt-1">Active codebase statements</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-semibold">CONNECTED MCPS</div>
          <div className="text-xl font-bold text-blue-400 mt-1">{MCP_REGISTRY.length} Tools</div>
          <div className="text-xs text-zinc-500 mt-1">Filesystem, Sandbox, Brave</div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="font-semibold text-white text-sm mb-3">Repository Files ({files.length})</h2>
        {files.length > 0 ? (
          <div className="divide-y divide-zinc-800/60 max-h-80 overflow-y-auto">
            {files.map((f) => (
              <div key={f.path} className="py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-zinc-300">{f.path}</span>
                <span className="text-zinc-500">{(f.content || '').length} bytes</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No files generated yet in this workspace. Use the Builder to start.</p>
        )}
      </div>
    </div>
  );
}

function DeploymentsPage({ onToast, projectName, projectId }) {
  const [targets, setTargets] = useState(['vercel', 'netlify', 'cloudflare', 'docker']);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${BACKEND}/api/deploy/targets`)
      .then((r) => r.json())
      .then((data) => {
        if (active && data?.targets) setTargets(data.targets);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleDownloadZip = () => {
    const url = `${BACKEND}/api/preview/${encodeURIComponent(projectId)}/zip`;
    window.open(url, '_blank');
    onToast(`Downloading ${projectName} ZIP archive`);
  };

  const handleDeployTarget = async (target) => {
    setDeploying(true);
    onToast(`Initiating deployment to ${target}...`);
    try {
      const res = await fetch(`${BACKEND}/api/deploy/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: '.', target }),
      });
      const data = await res.json();
      if (data?.success && data?.result?.url) {
        onToast(`Deployed successfully: ${data.result.url}`);
      } else {
        onToast(data?.error || `Deployment to ${target} initiated`);
      }
    } catch (err) {
      onToast(`Deploy notice: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto w-full h-full text-zinc-200">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LuGlobe className="text-blue-400" /> Deployments &amp; Hosting
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Autonomous deployment pipelines &amp; preview environments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadZip}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-2 border border-zinc-700"
          >
            <LuCloud size={14} /> Download ZIP
          </button>
          <button
            onClick={() => handleDeployTarget('vercel')}
            disabled={deploying}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            <LuRocket size={14} /> {deploying ? 'Deploying...' : 'Deploy to Cloud'}
          </button>
        </div>
      </div>

      <div className="space-y-4 my-6">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm">Preview Sandbox</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">Active</span>
            </div>
            <div className="text-xs text-zinc-400 mt-1 font-mono">http://localhost:5173</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">Isolated runtime · instant live sync</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToast('Sandbox preview synced')}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded text-zinc-300"
            >
              Live Sync
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-semibold text-zinc-400 mb-3">AVAILABLE DEPLOYMENT TARGETS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {targets.map((t) => (
              <div key={t} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                <div>
                  <b className="text-white text-xs uppercase tracking-wide">{t}</b>
                  <div className="text-[11px] text-zinc-500">Auto-configured pipeline</div>
                </div>
                <button
                  onClick={() => handleDeployTarget(t)}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-purple-300"
                >
                  Deploy
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationsPage({ onToast }) {
  const [mcps, setMcps] = useState(MCP_REGISTRY);
  const [customConfigs, setCustomConfigs] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', command: '', args: '' });

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mcp_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomConfigs(parsed);
        }
      }
    } catch (_) {}
  }, []);

  const toggleMcp = (id) => {
    setMcps((prev) =>
      prev.map((m) => (m.id === id ? { ...m, connected: !m.connected } : m))
    );
    onToast?.('MCP connector status updated');
  };

  const handleAddServer = (e) => {
    e.preventDefault();
    if (!newServer.name.trim() || !newServer.command.trim()) return;

    const entry = {
      id: 'custom-' + Date.now(),
      name: newServer.name.trim(),
      command: newServer.command.trim(),
      args: newServer.args.trim(),
      summary: `Custom MCP: ${newServer.command} ${newServer.args}`,
      tools: [newServer.command.trim()],
      risk: 'Medium',
      connected: true,
      isCustom: true,
    };

    const updated = [...customConfigs, entry];
    setCustomConfigs(updated);
    try {
      localStorage.setItem('mcp_configs', JSON.stringify(updated));
    } catch (_) {}

    setNewServer({ name: '', command: '', args: '' });
    setShowAddForm(false);
    onToast?.(`Added custom MCP Server "${entry.name}"`);
  };

  const handleDeleteCustom = (id) => {
    const updated = customConfigs.filter((c) => c.id !== id);
    setCustomConfigs(updated);
    try {
      localStorage.setItem('mcp_configs', JSON.stringify(updated));
    } catch (_) {}
    onToast?.('Removed custom MCP Server');
  };

  const allServers = useMemo(() => {
    return [...mcps, ...customConfigs];
  }, [mcps, customConfigs]);

  return (
    <div className="p-8 max-w-5xl mx-auto overflow-y-auto w-full h-full text-zinc-200">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LuPlug className="text-purple-400" /> MCP Connect &amp; Tool Catalog
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Model Context Protocol servers allowing the agent to read, write, build, search, and verify.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <LuPlus size={14} /> Add MCP Server
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddServer} className="my-5 p-4 rounded-xl bg-zinc-900 border border-purple-500/30 space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Configure New MCP Server</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Server Name</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="e.g. SQLite DB Server"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Executable Command</label>
              <input
                type="text"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                placeholder="e.g. npx"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Arguments</label>
              <input
                type="text"
                value={newServer.args}
                onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                placeholder="e.g. -y @modelcontextprotocol/server-sqlite"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              Save Server
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {allServers.map((mcp) => (
          <div key={mcp.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{mcp.name}</span>
                  {mcp.isCustom && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950 text-purple-300 border border-purple-800">
                      Custom
                    </span>
                  )}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                    mcp.connected
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {mcp.connected ? 'Connected' : 'Available'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{mcp.summary}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(mcp.tools || []).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-zinc-950 text-purple-300 font-mono text-[10px] border border-zinc-800">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Risk: <b className="text-zinc-400">{mcp.risk || 'Low'}</b></span>
              <div className="flex items-center gap-2">
                {mcp.isCustom && (
                  <button
                    onClick={() => handleDeleteCustom(mcp.id)}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"
                    title="Remove custom server"
                  >
                    <LuTrash2 size={13} />
                  </button>
                )}
                <button
                  onClick={() => toggleMcp(mcp.id)}
                  className={`px-3 py-1 rounded text-xs font-semibold ${
                    mcp.connected
                      ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {mcp.connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillsPage({ onToast }) {
  const [skills, setSkills] = useState(SKILLS_MANIFEST);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSkill, setNewSkill] = useState({ name: '', description: '', prompt: '' });
  const [loading, setLoading] = useState(false);

  // Fetch real skills from backend
  const fetchBackendSkills = useCallback(async (isActive = () => true) => {
    try {
      if (isActive()) setLoading(true);
      const res = await fetch(`${BACKEND}/api/skills`);
      if (!isActive()) return;
      if (res.ok) {
        const data = await res.json();
        if (!isActive()) return;
        if (data?.skills && Array.isArray(data.skills) && data.skills.length > 0) {
          const mapped = data.skills.map((s) => ({
            id: s.id,
            name: s.name,
            tier: s.is_official ? 1 : 2,
            description: s.description || s.name,
            tags: s.tools || ['automation'],
            domain: 'backend',
            enabled: true,
            isCustom: !s.is_official,
          }));
          // Merge unique skills
          setSkills((prev) => {
            const ids = new Set(mapped.map((m) => m.id));
            return [...mapped, ...prev.filter((p) => !ids.has(p.id))];
          });
        }
      }
    } catch (_) {
      /* Skills remain available from the local manifest when offline. */
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchBackendSkills(() => active);
    return () => { active = false; };
  }, [fetchBackendSkills]);

  const toggleSkill = (id) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    onToast?.('Skill activation policy updated');
  };

  const handleCreateSkill = async (e) => {
    e.preventDefault();
    if (!newSkill.name.trim() || !newSkill.prompt.trim()) return;

    try {
      const res = await fetch(`${BACKEND}/api/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSkill.name.trim(),
          description: newSkill.description.trim() || newSkill.name.trim(),
          system_prompt: newSkill.prompt.trim(),
          tools: [],
        }),
      });
      if (res.ok) {
        onToast?.(`Created custom skill "${newSkill.name}"`);
        setNewSkill({ name: '', description: '', prompt: '' });
        setShowAddForm(false);
        fetchBackendSkills();
      } else {
        const err = await res.json();
        onToast?.(err.error || 'Failed to create skill');
      }
    } catch (err) {
      onToast?.(`Error: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto overflow-y-auto w-full h-full text-zinc-200">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LuBookOpen className="text-purple-400" /> Agent Skills Library
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Bundled and protected workflows loaded on-demand during autonomous code generation.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <LuPlus size={14} /> New Custom Skill
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateSkill} className="my-5 p-4 rounded-xl bg-zinc-900 border border-purple-500/30 space-y-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">Create Custom Autonomous Skill</h2>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Skill Name</label>
              <input
                type="text"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                placeholder="e.g. Tailwind to CSS Refactorer"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Description</label>
              <input
                type="text"
                value={newSkill.description}
                onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                placeholder="Brief summary of what this skill does"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">System Instructions / Prompt</label>
              <textarea
                value={newSkill.prompt}
                onChange={(e) => setNewSkill({ ...newSkill, prompt: e.target.value })}
                placeholder="Detailed instructions for the autonomous agent when this skill is loaded..."
                rows="3"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              Create Skill
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
        {skills.map((skill) => (
          <div key={skill.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-sm">{skill.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                  Tier {skill.tier || 1}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{skill.description}</p>
              <div className="flex gap-1.5 mt-3">
                {(skill.tags || []).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 text-[10px] border border-zinc-800">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Domain: <b className="text-zinc-400">{skill.domain || 'core'}</b></span>
              <button
                onClick={() => toggleSkill(skill.id)}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  skill.enabled
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {skill.enabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ onToast }) {
  const [model, setModel] = useState('auto');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai_dost_copilot_model');
      if (saved) setModel(saved);
    } catch (_) {}
  }, []);

  const handleModelChange = (m) => {
    setModel(m);
    try {
      localStorage.setItem('ai_dost_copilot_model', m);
    } catch (_) {}
    onToast?.(`Preferred AI model set to ${m}`);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto overflow-y-auto w-full h-full text-zinc-200">
      <div className="pb-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <LuSettings2 className="text-purple-400" /> Workspace Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Configure AI model cascade, timeouts, and autonomous builder policies.</p>
      </div>

      <div className="space-y-6 my-6 text-sm">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="font-semibold text-white text-sm mb-1">Preferred Model Provider</h2>
          <p className="text-xs text-zinc-400 mb-3">Select the primary model provider for autonomous agent iterations.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: 'auto', label: 'Auto Cascade' },
              { id: 'gemini', label: 'Google Gemini' },
              { id: 'groq', label: 'Groq (Ultra-fast)' },
              { id: 'ollama', label: 'Ollama (Local)' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleModelChange(opt.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  model === opt.id
                    ? 'bg-purple-900/60 text-purple-300 border-purple-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="font-semibold text-white text-sm mb-2">Model Routing Cascade</h2>
          <p className="text-xs text-zinc-400 mb-3">Preferred LLM providers ordered by latency and free capacity.</p>
          <div className="space-y-2 text-xs">
            {PROVIDERS_SUPPORT.map((p) => (
              <div key={p.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <b className="text-white">{p.name}</b>
                  <div className="text-zinc-500">{p.status}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] ${p.active ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-500'}`}>
                  {p.active ? 'Ready' : 'Standby'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="font-semibold text-white text-sm mb-2">Autonomous Execution Guardrails</h2>
          <div className="space-y-3 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-zinc-700" />
              <span>Require approval for file deletions and git force-pushes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-zinc-700" />
              <span>Take snapshot checkpoint before applying surgical diff edits</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-zinc-700" />
              <span>Run automated build &amp; console error scan after edits</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForgeCopilot({
  projectId = 'copilot-workspace',
  projectName: initialProjectName = 'Forge Studio Workspace',
  onToast: externalToast,
}) {
  const [currentProjectId, setCurrentProjectId] = useState(projectId);
  const [projectList, setProjectList] = useState([]);
  const [mobile, setMobile] = useState(false);
  const [filesOpen, setFilesOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [theme, setTheme] = useState('violet');
  const [customColor, setCustomColor] = useState('#a78bfa');
  const [mode, setMode] = useState('preview');
  const [device, setDevice] = useState('desktop');
  const [activeFile, setActiveFile] = useState('');
  const [files, setFiles] = useState([]);
  const [contents, setContents] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [autopilot, setAutopilot] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAssistantWorking, setIsAssistantWorking] = useState(false);
  const [activityStep, setActivityStep] = useState(0);
  const [activityDetail, setActivityDetail] = useState('');
  const [agentPlan, setAgentPlan] = useState([]);
  const [lastAction, setLastAction] = useState(null);
  const [liveActivities, setLiveActivities] = useState([]);
  const [activeSpecialist, setActiveSpecialist] = useState(null);
  const [sessionFilesWritten, setSessionFilesWritten] = useState([]);
  const [runElapsedSeconds, setRunElapsedSeconds] = useState(0);
  const [lastRunError, setLastRunError] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const [toast, setToast] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [activeTab, setActiveTab] = useState('builder');
  const [projectName, setProjectName] = useState(displayProjectName(initialProjectName, projectId));
  const [saved, setSaved] = useState(true);
  const [devServer, setDevServer] = useState({ state: null, url: null, hostPort: null });
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [gitOpen, setGitOpen] = useState(false);
  const [user, setUser] = useState({ name: 'Developer', initials: 'AI', role: 'Local Workspace' });

  const [inspectorActive, setInspectorActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [runtimeError, setRuntimeError] = useState(null);
  const [diffModalFile, setDiffModalFile] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);

  const abortRef = useRef(null);
  const currentTaskIdRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const iframeRef = useRef(null);
  const previousContentsRef = useRef({});

  const toggleInspector = useCallback(() => {
    setInspectorActive((prev) => {
      const next = !prev;
      try {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'SET_INSPECTOR_ACTIVE',
          active: next,
        }, '*');
      } catch (_) {}
      return next;
    });
  }, []);

  const submitPromptRef = useRef(null);
  const autoFixCountRef = useRef(0);
  const autoFixTimerRef = useRef(null);

  const handleAutoFixRuntimeError = useCallback((errText, triggerRun = false) => {
    const errorMsg = errText || runtimeError;
    if (!errorMsg) return;
    const fixPrompt = `Fix the preview runtime error: "${String(errorMsg).slice(0, 300)}". Check for undefined variables, missing imports, or unhandled null checks in the active components.`;
    setRuntimeError(null);
    if (triggerRun && !isAssistantWorking && submitPromptRef.current) {
      autoFixCountRef.current += 1;
      setToast(`⚡ Autopilot: Auto-fixing preview runtime error (attempt ${autoFixCountRef.current}/2)...`);
      submitPromptRef.current(null, { prompt: fixPrompt });
    } else {
      setPrompt(fixPrompt);
      setToast('Auto-Fix prompt loaded. Submit to apply fix.');
    }
  }, [runtimeError, isAssistantWorking]);

  useEffect(() => {
    const handleWindowMessage = (event) => {
      const data = event?.data;
      if (!data) return;

      if (data.type === 'INSPECT_ELEMENT' && data.element) {
        setSelectedElement(data.element);
        setInspectorActive(false);
        setToast(`Selected <${data.element.tag}> to edit with AI`);
      }

      if (data.type === 'AUTO_FIX_ERROR' || (data.channel === 'ai-dost-preview' && data.type === 'RUNTIME_ERROR')) {
        const err = data.error || data.message || 'Unknown preview error';
        setRuntimeError(err);
        if (autopilot && !isAssistantWorking && autoFixCountRef.current < 2) {
          if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current);
          autoFixTimerRef.current = setTimeout(() => {
            handleAutoFixRuntimeError(err, true);
          }, 1200);
        }
      }

      if (data.channel === 'ai-dost-preview' && data.type === 'PREVIEW_READY') {
        setRuntimeError(null);
        autoFixCountRef.current = 0;
      }

      if (data.channel === 'ai-dost-preview' && data.type === 'CONSOLE') {
        const prefix = data.level === 'error' ? '[browser-error] ' : data.level === 'warn' ? '[browser-warn] ' : '[browser-log] ';
        setTerminalLogs((prev) => {
          const next = [...prev, `${prefix}${data.text || ''}`];
          return next.slice(-200);
        });
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
      if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current);
    };
  }, [autopilot, isAssistantWorking, handleAutoFixRuntimeError]);

  // Live timer for autonomous run execution
  useEffect(() => {
    let interval = null;
    if (isAssistantWorking) {
      setRunElapsedSeconds(0);
      interval = setInterval(() => {
        setRunElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAssistantWorking]);

  const handleOpenFileInEditor = useCallback((filePath) => {
    if (!filePath) return;
    setActiveFile(filePath);
    setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setMode('code');
  }, []);

  const handleCloseTab = useCallback((filePath) => {
    setOpenTabs((prev) => {
      const nextTabs = prev.filter((t) => t !== filePath);
      if (activeFile === filePath) {
        const nextActive = nextTabs[nextTabs.length - 1] || '';
        setActiveFile(nextActive);
      }
      return nextTabs;
    });
  }, [activeFile]);

  const handleRetryRun = useCallback(() => {
    if (lastPrompt) {
      setPrompt(lastPrompt);
      setToast('Prompt loaded. Submit to retry.');
    }
  }, [lastPrompt]);

  const showToast = useCallback((message) => {
    setToast(message);
    externalToast?.(message);
  }, [externalToast]);

  const handleOpenDiff = useCallback((filePath) => {
    const targetPath = filePath || lastAction?.file || activeFile;
    if (!targetPath) {
      showToast('No file selected to compare');
      return;
    }
    const oldCode = previousContentsRef.current[targetPath] ?? '';
    const newCode = contents[targetPath] ?? '';
    setDiffModalFile({
      filePath: targetPath,
      oldContent: oldCode,
      newContent: newCode,
      summary: lastAction?.file === targetPath ? lastAction.summary : `Modifications in ${targetPath}`,
    });
  }, [lastAction, activeFile, contents, showToast]);

  const handleRevertFile = useCallback(async (filePath) => {
    if (!filePath) return;
    const oldCode = previousContentsRef.current[filePath];
    if (oldCode === undefined) {
      showToast(`No prior checkpoint recorded for ${filePath}`);
      return;
    }
    try {
      if (currentProjectId) {
        await saveProjectFile(currentProjectId, filePath, oldCode);
      }
      setContents((c) => ({ ...c, [filePath]: oldCode }));
      const currentCode = contents[filePath] || '';
      previousContentsRef.current[filePath] = currentCode;
      showToast(`Reverted ${filePath} to prior checkpoint`);
      setDiffModalFile(null);
    } catch (err) {
      showToast(`Revert failed: ${err.message}`);
    }
  }, [currentProjectId, contents, showToast]);

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [projectId]);

  // Load user details & real auth profile
  useEffect(() => {
    let active = true;
    setUser(getLoggedInUser());

    const loadAuthMe = async () => {
      try {
        const token = localStorage.getItem('ai_dost_token');
        if (!token) return;
        const res = await fetch(`${BACKEND}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          if (active && u) {
            const name = u.name || u.username || (u.email ? u.email.split('@')[0] : 'Developer');
            const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'AI';
            setUser({ name, initials, role: u.email || 'Local Workspace' });
          }
        }
      } catch (_) {}
    };
    loadAuthMe();
    return () => { active = false; };
  }, []);

  // Load real project list
  const loadProjects = useCallback(async (isActive = () => true) => {
    try {
      const list = await fetchProjects('default');
      // Async requests can outlive a closed Forge view. Avoid scheduling React
      // updates after its effect has been cleaned up.
      if (isActive() && Array.isArray(list)) {
        setProjectList(list);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    let active = true;
    loadProjects(() => active);
    return () => { active = false; };
  }, [loadProjects]);

  // Load theme preferences
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('forge-ui-theme');
      if (savedTheme) setTheme(savedTheme);
      const savedCustomColor = localStorage.getItem('forge-ui-custom-color');
      if (savedCustomColor) setCustomColor(savedCustomColor);
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('forge-ui-theme', theme);
      localStorage.setItem('forge-ui-custom-color', customColor);
    } catch (_) {}
  }, [theme, customColor]);

  // Load real project data & files from backend
  const loadProjectData = useCallback(async (isActive = () => true) => {
    try {
      const data = await fetchProject(currentProjectId);
      if (!isActive()) return [];
      if (!data) return [];
      if (data.name || data.project_name) {
        setProjectName(displayProjectName(data.name || data.project_name, currentProjectId));
      }
      const fileList = Array.isArray(data.files) ? data.files : [];
      setFiles(fileList);

      const newContents = {};
      fileList.forEach((f) => {
        newContents[f.path] = f.content || '';
      });
      setContents(newContents);

      if (fileList.length > 0 && !activeFile) {
        const first = fileList[0].path;
        setActiveFile(first);
        setOpenTabs((prev) => (prev.length > 0 ? prev : [first]));
      }
      return fileList;
    } catch (err) {
      if (isActive()) {
        console.warn('Could not load project files from backend:', err?.message);
      }
      return null;
    }
  }, [currentProjectId, activeFile]);

  useEffect(() => {
    let active = true;
    loadProjectData(() => active);
    return () => { active = false; };
  }, [loadProjectData]);

  // Check Dev Server status
  useEffect(() => {
    let active = true;
    const checkServer = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/preview/${encodeURIComponent(currentProjectId)}/status`);
        if (res.ok) {
          const data = await res.json();
          if (active && data) {
            setDevServer(data);
          }
        }
      } catch (_) {}
    };
    checkServer();
    return () => { active = false; };
  }, [currentProjectId]);

  // Handle responsive viewports
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 920px)');
    const update = () => {
      setMobile(mq.matches);
      if (mq.matches) {
        setFilesOpen(false);
        setAssistantOpen(false);
      } else {
        setFilesOpen(true);
        setAssistantOpen(true);
      }
    };
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Handle switching projects
  const handleSelectProject = (p) => {
    const pId = p.project_id || p.id;
    if (pId) {
      setCurrentProjectId(pId);
      const nextProjectName = displayProjectName(p.project_name || p.name || 'Workspace', pId);
      setProjectName(nextProjectName);
      setActiveFile('');
      showToast(`Switched to ${nextProjectName}`);
    }
  };

  // Handle deleting projects
  const handleDeleteProject = async (pId, pName) => {
    if (!pId) return;
    const displayName = pName || pId;
    const confirmed = window.confirm(`Are you sure you want to delete project "${displayName}"?\nAll files and workspace data in this project will be permanently removed.`);
    if (!confirmed) return;

    try {
      await deleteProject(pId);
      showToast(`Deleted project "${displayName}"`);
      await loadProjects();

      // If the deleted project was the currently open project, switch to another
      if (pId === currentProjectId) {
        const remaining = projectList.filter((p) => (p.project_id || p.id) !== pId);
        if (remaining.length > 0) {
          handleSelectProject(remaining[0]);
        } else {
          setCurrentProjectId('copilot-workspace');
          setProjectName('Forge Studio Workspace');
          setFiles([]);
          setContents({});
          setActiveFile('');
        }
      }
    } catch (err) {
      showToast(`Failed to delete project: ${err.message || 'Error'}`);
    }
  };

  // Real Code View Save
  const handleCodeChange = (newCode) => {
    setSaved(false);
    setContents((prev) => ({ ...prev, [activeFile]: newCode }));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveProjectFile(currentProjectId, activeFile, newCode);
        setSaved(true);
      } catch (err) {
        console.error('Failed to auto-save file:', err);
      }
    }, 1200);
  };

  const handleExplicitSave = async () => {
    try {
      await saveProjectFile(currentProjectId, activeFile, contents[activeFile] || '');
      setSaved(true);
      showToast(`Saved ${activeFile}`);
    } catch (err) {
      showToast(`Save failed: ${err.message}`);
    }
  };

  const handleCreateFile = async () => {
    const name = window.prompt('Enter file path (e.g. src/Button.jsx):');
    if (!name) return;
    try {
      await addProjectFile(currentProjectId, name, '// New file\n');
      await loadProjectData();
      handleOpenFileInEditor(name);
      showToast(`Created ${name}`);
    } catch (err) {
      showToast(`Error creating file: ${err.message}`);
    }
  };

  const handleDeleteFile = async (pathToDelete) => {
    if (!window.confirm(`Delete ${pathToDelete}?`)) return;
    try {
      await deleteProjectFile(currentProjectId, pathToDelete);
      await loadProjectData();
      handleCloseTab(pathToDelete);
      showToast(`Deleted ${pathToDelete}`);
    } catch (err) {
      showToast(`Error deleting file: ${err.message}`);
    }
  };

  const handleNewFolder = async () => {
    const name = window.prompt('Enter folder name (e.g. components, utils):');
    if (!name || !name.trim()) return;
    const clean = name.trim().replace(/^\/+|\/+$/g, '');
    const placeholder = `${clean}/.gitkeep`;
    try {
      await addProjectFile(currentProjectId, placeholder, '');
      await loadProjectData();
      showToast(`Created folder ${clean}`);
    } catch (err) {
      showToast(`Error creating folder: ${err.message}`);
    }
  };

  const handleUploadFile = async (fileName, fileContent) => {
    if (!fileName) return;
    try {
      await addProjectFile(currentProjectId, fileName, fileContent);
      await loadProjectData();
      setActiveFile(fileName);
      showToast(`Uploaded ${fileName}`);
    } catch (err) {
      showToast(`Error uploading file: ${err.message}`);
    }
  };

  const handleRenameFile = async (oldPath) => {
    const newPath = window.prompt(`Rename "${oldPath}" to:`, oldPath);
    if (!newPath || !newPath.trim() || newPath.trim() === oldPath) return;
    const target = newPath.trim();
    try {
      const content = contents[oldPath] || '';
      await addProjectFile(currentProjectId, target, content);
      await deleteProjectFile(currentProjectId, oldPath);
      await loadProjectData();
      setActiveFile(target);
      showToast(`Renamed to ${target}`);
    } catch (err) {
      showToast(`Rename failed: ${err.message}`);
    }
  };

  // Real Terminal Execution Handler
  const handleExecuteTerminalCommand = async (commandToRun) => {
    if (!commandToRun || !commandToRun.trim()) return;
    const cmd = commandToRun.trim();
    setTerminalLogs((prev) => [...prev, `➜ ~/${projectName} $ ${cmd}`]);

    try {
      const res = await fetch(`${BACKEND}/api/terminal/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          projectId: currentProjectId,
        }),
      });
      const data = await res.json();
      if (data?.stdout) {
        setTerminalLogs((prev) => [...prev, data.stdout]);
      }
      if (data?.stderr) {
        setTerminalLogs((prev) => [...prev, `[stderr] ${data.stderr}`]);
      }
      if (!data?.stdout && !data?.stderr) {
        if (data?.success) {
          setTerminalLogs((prev) => [...prev, `Command finished (exit code: ${data.exitCode ?? 0})`]);
        } else if (data?.error) {
          setTerminalLogs((prev) => [...prev, `Error: ${data.error}`]);
        }
      }
    } catch (err) {
      setTerminalLogs((prev) => [...prev, `Failed to execute: ${err.message}`]);
    }
  };

  const handleClearTerminalLogs = () => {
    setTerminalLogs([]);
  };

  // Real Run / Dev Server Trigger
  const runBuild = async (options = {}) => {
    const silent = options?.silent === true;
    setIsRunning(true);
    setTerminalLogs((prev) => [...prev, '> Starting dev server in sandbox container...']);
    try {
      const res = await fetch(`${BACKEND}/api/preview/${encodeURIComponent(currentProjectId)}/dev/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: '.' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success !== true || data?.state === 'FAILED' || (!data?.url && data?.hostPort == null)) {
          throw new Error(data?.error || `Dev server did not become ready (HTTP ${res.status})`);
        }
        setDevServer({ ...data, state: 'READY' });
        setTerminalLogs((prev) => [
          ...prev,
          `> Dev server ready on http://localhost:${data.hostPort || 5173}`,
        ]);
        if (!silent) showToast('Dev server ready');
        return true;
      } else {
        const reason = `Preview server request failed (HTTP ${res.status})`;
        setDevServer({ state: 'FAILED', url: null, hostPort: null, reason, error: reason });
        setTerminalLogs((prev) => [...prev, `> Live dev server failed: ${reason}`, '> The in-browser preview remains available as a fallback.']);
        if (!silent) showToast('Live server failed; check Terminal');
        return false;
      }
    } catch (err) {
      const reason = String(err?.message || err || 'Unknown preview error').slice(0, 220);
      setDevServer({ state: 'FAILED', url: null, hostPort: null, reason, error: reason });
      setTerminalLogs((prev) => [...prev, `> Live dev server failed: ${reason}`, '> The in-browser preview remains available as a fallback.']);
      if (!silent) showToast('Live server failed; check Terminal');
      return false;
    } finally {
      setIsRunning(false);
      setRefreshCount((c) => c + 1);
    }
  };

  // Real Autonomous Agent Run Execution (POST /api/agent/run SSE stream)
  const submitPrompt = async (event, resumeOptions = {}) => {
    event?.preventDefault();
    const text = String(resumeOptions.prompt || prompt || '').trim();
    const approvalToken = resumeOptions.approvalToken || null;
    if (!text || (isAssistantWorking && !approvalToken)) return;

    if (!resumeOptions.prompt) {
      autoFixCountRef.current = 0;
    }

    let effectivePrompt = text;
    if (selectedElement && !approvalToken) {
      effectivePrompt = `[TARGET ELEMENT TO EDIT: <${selectedElement.tag || 'element'} class="${selectedElement.className || ''}"> text="${(selectedElement.text || '').slice(0, 100)}"]\n${text}`;
      setSelectedElement(null);
      setInspectorActive(false);
      try {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'SET_INSPECTOR_ACTIVE',
          active: false,
        }, '*');
      } catch (_) {}
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const prevHistory = messages.slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.text || '').slice(0, 500),
    }));
    const prevFiles = sessionFilesWritten.slice(-10).map((f) => ({
      path: f.path,
      summary: f.summary || `Modified ${f.path}`,
    }));

    if (!approvalToken) {
      previousContentsRef.current = { ...contents };
      setMessages((prev) => [...prev, { role: 'user', text, time }]);
      setLastPrompt(text);
      setPrompt('');
      setPendingApproval(null);
    }
    setIsAssistantWorking(true);
    setActivityStep(0);
    setActivityDetail('Connecting to autonomous director...');
    setLiveActivities([]);
    setSessionFilesWritten([]);
    setLastRunError(null);
    setActiveSpecialist(null);

    const taskId = resumeOptions.taskId || `forge-${Date.now()}`;
    currentTaskIdRef.current = taskId;
    let terminalOutcome = null;
    const terminalChangedPaths = new Set();
    const terminalExpectedContent = new Map();
    const controller = new AbortController();
    abortRef.current = controller;

    const preferredModel = (typeof window !== 'undefined' && localStorage.getItem('ai_dost_copilot_model')) || 'auto';

    try {
      const res = await fetch(`${BACKEND}/api/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-dost-task-id': taskId,
        },
        body: JSON.stringify({
          userPrompt: effectivePrompt,
          projectId: currentProjectId,
          taskId,
          copilotDirector: true,
          permissionLevel: resumeOptions.permissionLevel || (autopilot ? 'auto' : 'ask'),
          preferredModel,
          conversationHistory: prevHistory,
          recentFilesWritten: prevFiles,
          ...(approvalToken ? { approvalToken } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Agent run failed with status ${res.status}`);
      if (!res.body) throw new Error('SSE stream unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (!finished) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          if (jsonStr === '[DONE]') {
            finished = true;
            break;
          }

          try {
            const data = JSON.parse(jsonStr);

            // Surface a real approval action and retain the same task ID so the
            // backend can validate/consume the single-use approval token.
            if (data.type === 'gate_approval_required' && data.gate?.approval_token) {
              setPendingApproval({
                token: data.gate.approval_token,
                taskId,
                prompt: text,
                permissionLevel: resumeOptions.permissionLevel || (autopilot ? 'auto' : 'ask'),
                message: data.message || 'This action requires approval before Forge can continue.',
              });
              setActivityDetail('Waiting for your approval before making changes…');
            }

            // 1. Plan established
            if (data.type === 'plan' || data.type === 'director_plan' || data.plan) {
              const taskList = data.tasks || data.steps || data.plan || [];
              setAgentPlan(taskList);
              setActivityStep(1);
              const summary = data.summary || `${taskList.length} adaptive tasks planned`;
              setActivityDetail(`Plan established: ${summary}`);
              setLiveActivities((prev) => [
                ...prev,
                {
                  id: `plan-${Date.now()}`,
                  type: 'think',
                  badge: 'PLAN',
                  title: `Roadmap established: ${summary}`,
                  status: 'done',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                },
              ]);
            }

            // 2. Specialist / Director Task
            if (data.type === 'director_task') {
              const { status, taskId: dtId, specialty, role, objective, attempt, error: taskErr } = data;
              const specLabel = specialty ? specialty.replace(/^task_/, '') : (role || 'Specialist');
              if (status === 'DELEGATING' || status === 'RETRYING') {
                setActiveSpecialist({ taskId: dtId, specialty: specLabel, role, objective, attempt, status });
                setActivityStep(2);
                setActivityDetail(`Specialist [${specLabel}]${attempt > 1 ? ` (attempt ${attempt}/3)` : ''}: ${objective || 'planning edits...'}`);
                setLiveActivities((prev) => [
                  ...prev,
                  {
                    id: `dt-${dtId}-${attempt || 1}`,
                    type: 'specialist',
                    badge: specLabel.toUpperCase(),
                    title: `${specLabel} specialist started${attempt > 1 ? ` (attempt ${attempt}/3)` : ''}`,
                    detail: objective,
                    status: 'running',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  },
                ]);
              } else if (status === 'SUCCEEDED') {
                setLiveActivities((prev) => [
                  ...prev.map((a) => (a.id === `dt-${dtId}-${attempt || 1}` ? { ...a, status: 'done' } : a)),
                  {
                    id: `dt-done-${dtId}-${Date.now()}`,
                    type: 'specialist',
                    badge: 'DONE',
                    title: `${specLabel} specialist verified changes`,
                    status: 'done',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  },
                ]);
              } else if (status === 'FAILED' || status === 'SKIPPED') {
                setLiveActivities((prev) => [
                  ...prev.map((a) => (a.id === `dt-${dtId}-${attempt || 1}` ? { ...a, status: 'failed' } : a)),
                  {
                    id: `dt-err-${dtId}-${Date.now()}`,
                    type: 'error',
                    badge: status === 'SKIPPED' ? 'SKIPPED' : 'FAILED',
                    title: `${specLabel} ${status.toLowerCase()}: ${taskErr || 'Error occurred'}`,
                    status: 'failed',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  },
                ]);
              }
            }

            // 3. Granular Tool Step (read_file, apply_diff, write_file, run_terminal, etc.)
            if (data.type === 'step') {
              const tool = data.tool || 'tool';
              const isRead = tool.includes('read');
              const isWrite = tool.includes('write') || tool.includes('diff') || tool.includes('patch');
              const isTerm = tool.includes('term');
              const badge = isRead ? 'READ' : isWrite ? 'WRITE' : isTerm ? 'TERM' : tool.slice(0, 5).toUpperCase();
              const actionType = isRead ? 'read' : isWrite ? 'write' : isTerm ? 'tool' : 'tool';
              const label = data.description || `${tool} executed`;

              setActivityDetail(label);
              if (data.status === 'running') {
                setLiveActivities((prev) => [
                  ...prev,
                  {
                    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: actionType,
                    badge,
                    title: label,
                    status: 'running',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  },
                ]);
              } else if (data.status === 'done' || data.status === 'completed' || data.status === 'succeeded') {
                setLiveActivities((prev) => {
                  const copy = [...prev];
                  const lastIdx = copy.findLastIndex((x) => x.type === actionType && x.status === 'running');
                  if (lastIdx !== -1) copy[lastIdx] = { ...copy[lastIdx], status: 'done' };
                  return copy;
                });
              } else if (data.status === 'failed') {
                setLiveActivities((prev) => {
                  const copy = [...prev];
                  const lastIdx = copy.findLastIndex((x) => x.type === actionType && x.status === 'running');
                  if (lastIdx !== -1) copy[lastIdx] = { ...copy[lastIdx], status: 'failed', detail: data.error };
                  return copy;
                });
              }
            }

            // 4. Thinking / Reasoning event
            if (data.type === 'thinking' || data.thought) {
              const thoughtMsg = data.thought || data.message || 'Analyzing codebase...';
              setActivityDetail(thoughtMsg);
              setLiveActivities((prev) => [
                ...prev,
                {
                  id: `think-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  type: 'think',
                  badge: 'THINK',
                  title: thoughtMsg,
                  status: 'done',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                },
              ]);
            }

            // 5. File written / File diff event
            if (data.type === 'file_written' || data.file_written || data.action === 'write_file' || data.type === 'director_file_diff') {
              const filePath = data.path || data.fullPath || data.file;
              const content = data.content || '';
              if (filePath) {
                if (data.type !== 'director_file_diff') terminalChangedPaths.add(String(filePath));
                if (data.type === 'file_written' && typeof data.content === 'string') terminalExpectedContent.set(String(filePath), data.content);
                const prior = previousContentsRef.current[filePath] ?? contents[filePath] ?? '';
                if (previousContentsRef.current[filePath] === undefined) {
                  previousContentsRef.current[filePath] = prior;
                }
                if (content) {
                  setContents((c) => ({ ...c, [filePath]: content }));
                }
                const stats = content ? diffStats(diffLines(prior, content)) : { added: data.added || 1, removed: data.removed || 0 };
                setLastAction({
                  file: filePath,
                  added: stats.added,
                  removed: stats.removed,
                  summary: data.summary || `Updated ${filePath}`,
                  oldContent: prior,
                  newContent: content,
                });
                setSessionFilesWritten((prev) => [
                  ...prev.filter((f) => f.path !== filePath),
                  { path: filePath, added: stats.added, removed: stats.removed, summary: data.summary },
                ]);
                setActivityStep(2);
                setActivityDetail(`Wrote ${filePath} (+${stats.added} -${stats.removed})`);
                setLiveActivities((prev) => [
                  ...prev,
                  {
                    id: `file-${filePath}-${Date.now()}`,
                    type: 'write',
                    badge: 'MODIFIED',
                    title: `Updated ${filePath}`,
                    file: filePath,
                    diff: { added: stats.added, removed: stats.removed },
                    detail: data.summary || 'Targeted diff applied',
                    status: 'done',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                  },
                ]);
              }
            }

            // 6. Verification event
            if (data.type === 'director_verification') {
              setActivityStep(3);
              const isSucceeded = data.status === 'SUCCEEDED';
              setActivityDetail(`Verifying code integrity (${data.status})...`);
              setLiveActivities((prev) => [
                ...prev,
                {
                  id: `verify-${Date.now()}`,
                  type: 'verify',
                  badge: 'VERIFY',
                  title: isSucceeded ? 'Build and interface verification passed' : `Verification status: ${data.status}`,
                  status: isSucceeded ? 'done' : data.status === 'FAILED' ? 'failed' : 'running',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                },
              ]);
            }

            // 7. Terminal output event & command execution logs
            if (
              (data.type === 'terminal_output' || data.type === 'terminal_stream' || data.type === 'command_output') &&
              (data.text || data.stdout || data.stderr || data.line)
            ) {
              const streamLine = data.text || data.stdout || (data.stderr ? `[stderr] ${data.stderr}` : '') || data.line;
              if (streamLine) setTerminalLogs((prev) => [...prev, streamLine]);
            }

            // Explicit terminal events only. A single successful worker is not the end of a multi-task run.
            // Worker events also carry status=SUCCEEDED; only terminal event types finish the whole run.
            if (data.type === 'done' || data.type === 'director_complete') {
              finished = true;
              const terminalMessage = String(data.message || data.summary || '');
              const approvalPaused = data.type === 'done' && Boolean(data.approvalGate || /approval required|run paused/i.test(terminalMessage));
              const rejected = data.type === 'done' && /execution blocked|approval invalid|blocked by capabilitygatekeeper|^❌/i.test(terminalMessage);
              const explicitStatus = String(data.status || '').toUpperCase();
              const explicitSuccess = ['SUCCEEDED', 'SUCCESS', 'COMPLETED'].includes(explicitStatus);
              const explicitCancellation = ['CANCELLED', 'CANCELED'].includes(explicitStatus);
              const explicitFailure = ['FAILED', 'ERROR', 'BLOCKED'].includes(explicitStatus);
              if (explicitCancellation) {
                terminalOutcome = 'canceled';
              } else if (approvalPaused) {
                terminalOutcome = 'paused';
              } else if (
                rejected ||
                explicitFailure ||
                (data.type === 'director_complete' && !explicitSuccess)
              ) {
                // Director completion is successful only when the backend explicitly
                // reports a success status. Missing or unfamiliar statuses fail closed.
                terminalOutcome = 'failed';
              } else {
                terminalOutcome = 'succeeded';
              }
              if (Array.isArray(data.changedPaths)) data.changedPaths.forEach((p) => { if (typeof p === 'string' && p.trim()) terminalChangedPaths.add(p); });
              if (terminalOutcome === 'failed') setLastRunError(terminalMessage || 'Execution was blocked.');
              const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setLiveActivities((prev) => prev.map((a) => (a.status === 'running' ? { ...a, status: terminalOutcome === 'failed' ? 'failed' : 'done' } : a)));
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  time: replyTime,
                  text: terminalMessage || (terminalOutcome === 'succeeded' ? `Forge Studio finished the requested changes for: "${text}".` : terminalOutcome === 'paused' ? 'Run paused for approval.' : 'Execution was blocked.'),
                  files: data.changedPaths || sessionFilesWritten.map((f) => f.path),
                  ...(terminalOutcome === 'failed' ? { error: terminalMessage || 'Execution was blocked.' } : {}),
                },
              ]);
              break;
            }

            // 9. Error events (director_error / error / FAILED)
            if (data.type === 'director_error' || data.type === 'error') {
              finished = true;
              terminalOutcome = 'failed';
              const errMsg = data.error || data.message || 'Execution failed';
              setLastRunError(errMsg);
              const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              setLiveActivities((prev) => prev.map((a) => (a.status === 'running' ? { ...a, status: 'failed', detail: errMsg } : a)));
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  time: replyTime,
                  text: `⚠️ **Execution stopped**: ${errMsg}\n\n*The AI cascade attempted automatic self-healing. You can retry with cascade or modify your request.*`,
                  error: errMsg,
                },
              ]);
              showToast(`Error: ${errMsg.slice(0, 60)}`);
              break;
            }

            // 10. Cancellation event
            if (data.type === 'director_canceled' || data.type === 'task_canceled') {
              finished = true;
              terminalOutcome = 'canceled';
              showToast('Run canceled');
              break;
            }
          } catch (_) {}
        }
      }

      const reloadedFiles = await loadProjectData();
      setRefreshCount((c) => c + 1);

      // A successful tool event is not enough to prove persistence. Confirm the
      // backend returns each changed path before reporting the run as complete.
      if (terminalOutcome === 'succeeded' && terminalChangedPaths.size > 0) {
        const savedPaths = new Set(
          Array.isArray(reloadedFiles)
            ? reloadedFiles.map((file) => normalizeWorkspacePath(file.path))
            : []
        );
        const missingPaths = Array.isArray(reloadedFiles)
          ? [...terminalChangedPaths].filter((filePath) => !savedPaths.has(normalizeWorkspacePath(filePath)))
          : [...terminalChangedPaths];
        const savedByPath = new Map(
          Array.isArray(reloadedFiles)
            ? reloadedFiles.map((file) => [normalizeWorkspacePath(file.path), file])
            : []
        );
        const normalizeContent = (value) => String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const contentMismatchPaths = Array.isArray(reloadedFiles)
          ? [...terminalExpectedContent].filter(([filePath, expected]) => {
              const saved = savedByPath.get(normalizeWorkspacePath(filePath));
              return saved && normalizeContent(saved.content) !== normalizeContent(expected);
            }).map(([filePath]) => filePath)
          : [...terminalExpectedContent.keys()];
        const unverifiedPaths = [...new Set([...missingPaths, ...contentMismatchPaths])];
        if (unverifiedPaths.length > 0) {
          terminalOutcome = 'failed';
          const persistenceError = !Array.isArray(reloadedFiles)
            ? 'Workspace could not be reloaded to verify file persistence.'
            : missingPaths.length > 0
              ? `Workspace reload did not confirm saved files: ${missingPaths.slice(0, 6).join(', ')}`
              : `Workspace returned stale content for changed files: ${contentMismatchPaths.slice(0, 6).join(', ')}`;
          setLastRunError(persistenceError);
          setMessages((prev) => {
            const next = [...prev];
            const lastAssistant = next.map((message, index) => ({ message, index })).reverse()
              .find(({ message }) => message.role === 'assistant');
            const updated = {
              role: 'assistant',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              text: `⚠️ **Save verification failed**: ${persistenceError}`,
              error: persistenceError,
            };
            if (lastAssistant) next[lastAssistant.index] = { ...next[lastAssistant.index], ...updated };
            else next.push(updated);
            return next;
          });
          showToast('Save verification failed; changes are not confirmed');
        }
      }

      if (terminalOutcome === 'succeeded') {
        const hasPackageJson = Array.isArray(reloadedFiles) && reloadedFiles.some(
          (file) => normalizeWorkspacePath(file.path).split('/').pop() === 'package.json'
        );
        if (terminalChangedPaths.size > 0 && hasPackageJson) {
          const previewReady = await runBuild({ silent: true });
          showToast(previewReady
            ? 'Forge Studio run complete — live preview ready'
            : 'Code saved, but live build failed. Check Terminal; static preview remains available.');
        } else {
          showToast('Forge Studio run complete');
        }
      } else if (terminalOutcome === 'paused') {
        showToast('Approval required to continue');
      } else if (terminalOutcome === 'canceled') {
        showToast('Run canceled');
      } else if (terminalOutcome === 'failed' && !lastRunError) {
        showToast('Forge run failed or was blocked');
      } else if (!terminalOutcome) {
        const incompleteMessage = 'Forge stream ended without a terminal completion event. The run was not marked successful.';
        setLastRunError(incompleteMessage);
        setMessages((prev) => [...prev, { role: 'assistant', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `⚠️ **Run could not be verified**: ${incompleteMessage}`, error: incompleteMessage }]);
        showToast('Forge run ended without confirmation');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Agent run cancelled');
      } else {
        const errorTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastRunError(err.message);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            time: errorTime,
            text: `⚠️ **Execution error**: ${err.message}`,
            error: err.message,
          },
        ]);
        showToast(`Error: ${err.message}`);
      }
    } finally {
      setIsAssistantWorking(false);
      setActivityStep(0);
      setActivityDetail('');
      setActiveSpecialist(null);
    }
  };

  useEffect(() => {
    submitPromptRef.current = submitPrompt;
  });

  const handleApprove = () => {
    const approval = pendingApproval;
    if (!approval?.token || isAssistantWorking) return;
    setPendingApproval(null);
    submitPrompt(null, {
      prompt: approval.prompt,
      taskId: approval.taskId,
      approvalToken: approval.token,
      permissionLevel: approval.permissionLevel,
    });
  };

  // Stop running agent
  const handleStop = () => {
    cancelAgentRun({
      backend: BACKEND,
      taskId: currentTaskIdRef.current,
      controller: abortRef.current,
    });
    setIsAssistantWorking(false);
    showToast('Run stopped');
  };

  // Real Live HTML Preview string from project files
  const livePreviewHtml = useMemo(() => {
    if (devServer.state === 'READY' && (devServer.url || devServer.hostPort)) {
      return null;
    }
    const allFilePaths = new Set([
      ...(files || []).map((f) => f.path),
      ...Object.keys(contents || {}),
      ...(activeFile ? [activeFile] : []),
    ]);
    const mergedFiles = Array.from(allFilePaths).map((p) => {
      const existing = (files || []).find((f) => f.path === p);
      return {
        path: p,
        content: contents[p] !== undefined ? contents[p] : (existing?.content || ''),
      };
    });

    return generateLiveAppHtml(mergedFiles, contents, inspectorActive, activeFile);
  }, [files, contents, devServer, activeFile, inspectorActive]);

  return (
    <div
      className="app-shell"
      data-theme={theme}
      style={
        theme === 'custom'
          ? { '--accent': customColor, '--accent-strong': customColor }
          : undefined
      }
    >
      <Rail activeTab={activeTab} onSelectTab={setActiveTab} user={user} />
      <FileSidebar
        open={filesOpen}
        files={files}
        activeFile={activeFile}
        setActiveFile={handleOpenFileInEditor}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewProject={() => {
          const name = window.prompt('New Project Name:');
          if (name) {
            createProject(name, '', 'default').then((res) => {
              showToast(`Created ${name}`);
              loadProjects();
              if (res?.project_id || res?.id) {
                setCurrentProjectId(res.project_id || res.id);
                setProjectName(name);
              }
            });
          }
        }}
        onNewFile={handleCreateFile}
        onNewFolder={handleNewFolder}
        onUploadFile={handleUploadFile}
        onRenameFile={handleRenameFile}
        onDeleteFile={handleDeleteFile}
        onClose={() => setFilesOpen(false)}
        projectName={projectName}
        user={user}
        projects={projectList}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        currentProjectId={currentProjectId}
      />
      <div className="workspace-main">
        <Topbar
          onToggleFiles={() => setFilesOpen(!filesOpen)}
          onToggleAssistant={() => setAssistantOpen(!assistantOpen)}
          onDeploy={() => setActiveTab('deployments')}
          onOpenGit={() => setGitOpen(true)}
          onShare={() => {
            if (typeof window !== 'undefined') {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Project preview link copied to clipboard');
            }
          }}
          mobile={mobile}
          theme={theme}
          setTheme={setTheme}
          customColor={customColor}
          setCustomColor={setCustomColor}
          projectName={projectName}
          activeTab={activeTab}
          saved={saved}
        />
        <div className="workspace-content">
          <main className="main-workspace">
            {activeTab === 'overview' ? (
              <OverviewPage
                onSwitchToBuilder={() => setActiveTab('builder')}
                onToast={showToast}
                projectName={projectName}
                files={files}
              />
            ) : activeTab === 'deployments' ? (
              <DeploymentsPage onToast={showToast} projectName={projectName} projectId={currentProjectId} />
            ) : activeTab === 'integrations' ? (
              <IntegrationsPage onToast={showToast} />
            ) : activeTab === 'skills' ? (
              <SkillsPage onToast={showToast} />
            ) : activeTab === 'settings' ? (
              <SettingsPage onToast={showToast} />
            ) : (
              <>
                <Toolbar
                  mode={mode}
                  setMode={setMode}
                  device={device}
                  setDevice={setDevice}
                  onRefresh={() => setRefreshCount((c) => c + 1)}
                  onRun={runBuild}
                  isRunning={isRunning}
                  onToggleAssistant={() => setAssistantOpen(!assistantOpen)}
                  mobile={mobile}
                  inspectorActive={inspectorActive}
                  onToggleInspector={toggleInspector}
                  onOpenDiff={() => handleOpenDiff()}
                />
                <div className={`workspace-canvas ${mode === 'preview' ? 'preview-canvas' : ''}`}>
                  {mode === 'preview' ? (
                    <>
                      <div className="browser-bar">
                        <div className="browser-controls">
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="address-bar">
                          <LuLockKeyhole size={11} />
                          <span className="truncate">{projectName.toLowerCase().replace(/\s+/g, '-')}</span>
                          <span className="address-domain">.preview</span>
                          <LuChevronDown size={11} />
                        </div>
                        <div className="browser-actions">
                          <span className="preview-live">
                            <i /> Live preview
                          </span>
                          <IconButton
                            title="Open in new tab"
                            onClick={() => {
                              const url = devServer.url || (devServer.hostPort ? `http://localhost:${devServer.hostPort}` : null);
                              if (url) window.open(url, '_blank');
                              else showToast('Preview compiles live inside stage');
                            }}
                          >
                            <LuExternalLink size={14} />
                          </IconButton>
                        </div>
                      </div>

                      <div className="preview-stage">
                        <div
                          className={`preview-device ${device === 'mobile' ? 'mobile-device' : ''}`}
                          key={refreshCount}
                        >
                          {devServer.state === 'READY' && (devServer.url || devServer.hostPort) ? (
                            <iframe
                              ref={iframeRef}
                              src={devServer.url || `http://localhost:${devServer.hostPort}`}
                              className="w-full h-full border-0 bg-white"
                              title="Live Preview Server"
                            />
                          ) : Boolean(livePreviewHtml) ? (
                            <iframe
                              ref={iframeRef}
                              srcDoc={livePreviewHtml}
                              className="w-full h-full border-0 bg-white"
                              title="Instant Compiled Preview"
                            />
                          ) : (
                            <div className="w-full h-full min-h-[450px] flex flex-col items-center justify-center p-8 text-center bg-[#17181b] text-zinc-300">
                              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 grid place-items-center mb-4 text-purple-400">
                                <LuSparkles size={24} />
                              </div>
                              <h2 className="text-base font-semibold text-white">Ready to Build {projectName}</h2>
                              <p className="text-xs text-zinc-400 max-w-sm mt-1 mb-6">
                                No files yet. Tell Forge AI in the panel what website, web app, or feature to generate.
                              </p>
                              <div className="flex flex-wrap gap-2 justify-center">
                                <button
                                  onClick={() => setPrompt('Create a modern SaaS landing page with dark theme, pricing table, and feature cards')}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700"
                                >
                                  SaaS Landing Page
                                </button>
                                <button
                                  onClick={() => setPrompt('Create a full-stack Todo & Kanban board with localStorage state')}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700"
                                >
                                  Kanban App
                                </button>
                                <button
                                  onClick={() => setPrompt('Create a personal developer portfolio with projects grid and contact form')}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700"
                                >
                                  Portfolio
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="canvas-footer">
                        <span>
                          <LuCloud size={12} /> Preview synced
                        </span>
                        <span>
                          Port <b>{devServer.hostPort || 5173}</b>
                        </span>
                        <span className="canvas-size">
                          {device === 'mobile' ? '390 × 844' : 'Responsive'}
                        </span>
                      </div>
                    </>
                  ) : mode === 'code' ? (
                    <CodeEditorView
                      activeFile={activeFile}
                      code={contents[activeFile] || ''}
                      onChangeCode={handleCodeChange}
                      onSaveCode={handleExplicitSave}
                      saved={saved}
                      onOpenDiff={handleOpenDiff}
                      tabs={openTabs}
                      onSelectTab={handleOpenFileInEditor}
                      onCloseTab={handleCloseTab}
                    />
                  ) : (
                    <RealTerminalView
                      logs={terminalLogs}
                      projectName={projectName}
                      onExecuteCommand={handleExecuteTerminalCommand}
                      onClearLogs={handleClearTerminalLogs}
                    />
                  )}
                </div>
              </>
            )}
          </main>

          <AssistantPanel
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            autopilot={autopilot}
            setAutopilot={setAutopilot}
            prompt={prompt}
            setPrompt={setPrompt}
            messages={messages}
            onSubmit={submitPrompt}
            onStop={handleStop}
            onToast={showToast}
            isAssistantWorking={isAssistantWorking}
            activityStep={activityStep}
            activityDetail={activityDetail}
            agentPlan={agentPlan}
            lastAction={lastAction}
            projectName={projectName}
            user={user}
            files={files}
            activeSpecialist={activeSpecialist}
            liveActivities={liveActivities}
            sessionFilesWritten={sessionFilesWritten}
            elapsedSeconds={runElapsedSeconds}
            lastError={lastRunError}
            pendingApproval={pendingApproval}
            onApprove={handleApprove}
            onOpenFile={handleOpenFileInEditor}
            onOpenDiff={handleOpenDiff}
            onRetry={handleRetryRun}
            selectedElement={selectedElement}
            onClearSelectedElement={() => setSelectedElement(null)}
            runtimeError={runtimeError}
            onAutoFixRuntimeError={handleAutoFixRuntimeError}
          />
        </div>
      </div>
      <GitSnapshotsModal
        open={gitOpen}
        onClose={() => setGitOpen(false)}
        onToast={showToast}
        projectId={currentProjectId}
        projectName={projectName}
      />
      <FileDiffModal
        open={Boolean(diffModalFile)}
        onClose={() => setDiffModalFile(null)}
        diffData={diffModalFile}
        onRevert={handleRevertFile}
        onOpenInEditor={(fp) => {
          handleOpenFileInEditor(fp);
          setMode('code');
        }}
      />
      {toast && (
        <div className="toast">
          <LuCircleCheck size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
