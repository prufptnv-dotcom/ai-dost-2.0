import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Bot, Sparkles, History, Settings,
  FolderOpen, Plus, ChevronRight, ChevronLeft,
  MessageSquare, Terminal, Brain, Mic,
  FileText, Code2, LayoutDashboard, Compass, Image as ImageIcon
} from 'lucide-react';

const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_WIDTH_EXPANDED = 280;

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: null },
  { id: 'projects', label: 'Projects', icon: FolderOpen, badge: null },
  { id: 'copilot', label: 'Copilot IDE', icon: Code2, badge: 'New' },
  { id: 'agent', label: 'Agent', icon: Bot, badge: 'Beta' },
  { id: 'voice', label: 'Voice', icon: Mic, badge: 'Live' },
  { id: 'mcp', label: 'MCP Connectors', icon: Compass, badge: 'Beta' },
  { id: 'images', label: 'Images', icon: ImageIcon, badge: null },
  { id: 'resume', label: 'Resume', icon: FileText, badge: null },
  { id: 'history', label: 'History', icon: History, badge: null },
  { id: 'settings', label: 'Settings', icon: Settings, badge: null },
];

export default function Sidebar({
  isOpen,
  onToggle,
  activeItem,
  onItemClick,
  userProjects = [],
  onNewProject,
  onNewChat,
}) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const primaryIds = ['chat', 'copilot', 'agent', 'voice', 'resume'];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            onClick={onToggle}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isOpen ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 z-50 h-full flex flex-col overflow-hidden"
        style={{
          background: 'rgba(17, 19, 27, 0.96)',
          borderRight: '1px solid var(--color-border)',
          backdropFilter: 'blur(20px)',
          boxShadow: '4px 0 30px rgba(0,0,0,0.4)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Top: Logo & Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -20 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 min-w-0"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 16px var(--color-primary-glow)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-white text-lg truncate">
              AI-<span className="gradient-text">Dost</span>
            </span>
          </motion.div>

          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:bg-white/5 cursor-pointer"
            style={{
              background: isOpen ? 'rgba(75,139,252,0.1)' : 'transparent',
              border: isOpen ? '1px solid rgba(75,139,252,0.25)' : 'none',
            }}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={isOpen}
          >
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {isOpen ? (
                <ChevronLeft className="w-4 h-4 text-[var(--color-primary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
            </motion.span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" role="navigation" aria-label="Main menu">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onItemClick(item.id)}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 relative overflow-hidden group cursor-pointer hover-lift
                    ${isActive
                      ? 'text-white'
                      : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
                    }
                  `}
                  style={{
                    background: isActive ? 'var(--gradient-primary)' : 'transparent',
                    boxShadow: isActive ? '0 4px 20px var(--color-primary-glow)' : 'none',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: hoveredItem === item.id || isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                      border: isActive ? '1px solid rgba(255,255,255,0.2)' : '1px solid var(--color-border)',
                    }}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[var(--color-text-muted)]'}`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {isOpen && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="font-medium text-sm truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {item.badge && isOpen && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{
                        background: item.badge === 'Live' ? 'rgba(52,211,153,0.2)' : 'rgba(161,66,244,0.25)',
                        color: item.badge === 'Live' ? '#34d399' : '#c8a2ff',
                        border: item.badge === 'Live' ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(161,66,244,0.35)',
                      }}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isOpen ? 1 : 0 }}
            className="my-4 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          />

          {/* Projects Section */}
          <div className="space-y-1">
            <AnimatePresence mode="wait">
              {isOpen && (
                <motion.div
                  key="projects-header"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                    Projects
                  </span>
                  <button
                    onClick={onNewProject}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label="Create new project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {userProjects.map((project) => {
                const projectId = project.project_id || project.id;
                const projectKey = `project-${projectId}`;
                const isActive = activeItem === projectKey;
                return (
                  <button
                    key={projectId}
                    onClick={() => onItemClick(projectKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm truncate cursor-pointer hover-lift
                      ${isActive
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
                      }
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <FolderOpen className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                    <AnimatePresence mode="wait">
                      {isOpen && (
                        <motion.span
                          key="proj-name"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="truncate"
                        >
                          {project.project_name || project.name || 'Untitled Project'}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
              {userProjects.length === 0 && isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-3 py-4 text-center text-[var(--color-text-muted)] text-sm"
                >
                  No projects yet. Click + to create one.
                </motion.div>
              )}
            </div>
          </div>
        </nav>

        {/* Bottom: New Chat + User Info */}
        <div className="p-4 border-t space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            style={{
              background: 'var(--gradient-primary)',
              color: 'white',
              boxShadow: '0 4px 18px var(--color-primary-glow)',
            }}
            aria-label="Start new chat"
          >
            <Plus className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {isOpen && (
                <motion.span
                  key="new-chat"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  New Chat
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                key="user-info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 px-2 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(75,139,252,0.15)', border: '1px solid rgba(75,139,252,0.25)' }}
                >
                  <Bot className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white text-sm truncate">Developer</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">ai-dost.local</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </>
  );
}
