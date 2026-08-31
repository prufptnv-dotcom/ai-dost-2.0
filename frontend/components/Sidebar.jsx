import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Bot, Code2, FolderOpen, Mic, Compass,
  Image as ImageIcon, FileText, History, Settings, Plus,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import BrandLogo from './ui/BrandLogo';

const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_WIDTH_EXPANDED = 260;

const NAV_GROUPS = [
  {
    title: 'Workspace',
    items: [
      { id: 'chat', label: 'Chat', icon: MessageSquare, badge: null },
      { id: 'agent', label: 'Agent', icon: Bot, badge: 'Beta' },
      { id: 'copilot', label: 'Copilot IDE', icon: Code2, badge: 'New' },
    ],
  },
  {
    title: 'Projects & Artifacts',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderOpen, badge: null },
      { id: 'images', label: 'Images', icon: ImageIcon, badge: null },
      { id: 'resume', label: 'Resume', icon: FileText, badge: null },
    ],
  },
  {
    title: 'Tools & System',
    items: [
      { id: 'voice', label: 'Voice', icon: Mic, badge: 'Live' },
      { id: 'mcp', label: 'MCP Connectors', icon: Compass, badge: null },
      { id: 'history', label: 'History', icon: History, badge: null },
      { id: 'settings', label: 'Settings', icon: Settings, badge: null },
    ],
  },
];

export default function Sidebar({
  isOpen = true,
  onToggle,
  activeItem = 'chat',
  onItemClick,
  userProjects = [],
  onNewProject,
  onNewChat,
}) {
  const handleNewChat = () => {
    if (onNewChat) onNewChat();
    else if (onItemClick) onItemClick('chat');
  };

  const handleNewProject = () => {
    if (onNewProject) onNewProject();
    else if (onItemClick) onItemClick('projects');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden bg-black/60 backdrop-blur-xs"
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isOpen ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-0 top-0 z-50 h-full flex flex-col bg-canvas-subtle border-r border-border select-none"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Header: Brand & Collapse Toggle */}
        <div className="flex items-center justify-between h-14 px-3.5 border-b border-border">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <BrandLogo size={24} showText={isOpen} />
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="w-7 h-7 rounded-sm flex items-center justify-center text-txt-muted hover:text-txt-primary hover:bg-canvas-surface transition-fast cursor-pointer focus-ring"
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={isOpen}
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick New Chat Button */}
        <div className="p-2.5 border-b border-border-subtle">
          <button
            type="button"
            onClick={handleNewChat}
            className={`flex items-center gap-2 w-full py-2 rounded-md bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-border-strong text-txt-primary transition-fast cursor-pointer focus-ring ${
              isOpen ? 'px-3 text-xs font-medium' : 'justify-center px-0'
            }`}
            title="Start new chat"
            aria-label="Start new chat"
          >
            <Plus className="w-4 h-4 text-accent flex-shrink-0" />
            {isOpen && <span>New Chat</span>}
          </button>
        </div>

        {/* Navigation Item Groups */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {isOpen && (
                <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-wider text-txt-muted select-none">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeItem === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onItemClick && onItemClick(item.id)}
                    className={`relative flex items-center gap-2.5 w-full rounded-md transition-fast cursor-pointer focus-ring ${
                      isOpen ? 'px-2.5 py-1.5 text-xs' : 'justify-center p-2.5'
                    } ${
                      isActive
                        ? 'bg-canvas-surface text-txt-primary font-medium border border-border-strong shadow-xs'
                        : 'text-txt-secondary hover:text-txt-primary hover:bg-canvas-surface/60 border border-transparent'
                    }`}
                    title={item.label}
                    aria-label={item.label}
                  >
                    {/* Active Left Accent Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-xs" />
                    )}

                    <Icon
                      className={`w-4 h-4 flex-shrink-0 transition-fast ${
                        isActive ? 'text-accent' : 'text-txt-muted'
                      }`}
                    />

                    {isOpen && (
                      <>
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-xs font-mono font-medium bg-canvas-elevated text-accent border border-accent/20">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* User Projects Section (when expanded) */}
          {isOpen && (
            <div className="pt-2 border-t border-border-subtle space-y-1">
              <div className="flex items-center justify-between px-2 pb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-txt-muted">
                  Recent Projects
                </span>
                <button
                  type="button"
                  onClick={handleNewProject}
                  className="text-txt-muted hover:text-accent p-0.5 rounded-xs cursor-pointer focus-ring"
                  title="Create new project"
                  aria-label="Create new project"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {(!userProjects || userProjects.length === 0) ? (
                <div className="px-2 py-1 text-xs text-txt-muted italic">
                  No projects yet
                </div>
              ) : (
                userProjects.slice(0, 4).map((p) => (
                  <button
                    key={p.project_id || p.id}
                    type="button"
                    onClick={() => onItemClick && onItemClick('projects')}
                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-txt-secondary hover:text-txt-primary hover:bg-canvas-surface/60 rounded-sm truncate text-left transition-fast cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3 text-txt-muted flex-shrink-0" />
                    <span className="truncate">{p.project_name || p.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer / Account / Settings Quick Bar */}
        <div className="p-2 border-t border-border bg-canvas-subtle">
          <button
            type="button"
            onClick={() => onItemClick && onItemClick('settings')}
            className={`flex items-center gap-2.5 w-full rounded-md text-txt-secondary hover:text-txt-primary hover:bg-canvas-surface transition-fast cursor-pointer focus-ring ${
              isOpen ? 'px-2.5 py-1.5 text-xs' : 'justify-center p-2'
            }`}
            title="Preferences"
            aria-label="Preferences"
          >
            <Settings className="w-4 h-4 text-txt-muted" />
            {isOpen && <span className="truncate">Preferences</span>}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
