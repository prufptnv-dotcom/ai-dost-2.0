import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Bot, Sparkles, History, Settings,
  FolderOpen, Plus, ChevronRight, ChevronLeft,
  MessageSquare, Terminal, Brain, Mic, Music,
  FileText, Code, GitBranch, LayoutDashboard
} from 'lucide-react';

const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_WIDTH_EXPANDED = 280;
const SIDEBAR_ANIMATION = { type: 'spring', stiffness: 300, damping: 30 };

const navItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, badge: null },
  { id: 'projects', label: 'Projects', icon: FolderOpen, badge: null },
  { id: 'agent', label: 'Agent', icon: Bot, badge: 'Beta' },
  { id: 'voice', label: 'Voice', icon: Mic, badge: 'Live' },
  { id: 'resume', label: 'Resume', icon: FileText, badge: null },
  { id: 'terminal', label: 'Terminal', icon: Terminal, badge: null },
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

  return (
    <>
      {/* Overlay for mobile */}
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

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 z-50 h-full flex flex-col overflow-hidden"
        style={{
          background: 'rgba(10, 11, 18, 0.95)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          boxShadow: '4px 0 30px rgba(0,0,0,0.4)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Top: Logo & Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/5 relative">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -20 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg truncate">Waaw</span>
          </motion.div>

          <button
            onClick={onToggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:bg-white/5"
            style={{
              background: isOpen ? 'rgba(6,182,212,0.1)' : 'transparent',
              border: isOpen ? '1px solid rgba(6,182,212,0.2)' : 'none',
            }}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={isOpen}
          >
            <motion.span
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {isOpen ? <ChevronLeft className="w-4 h-4 text-cyan-400" /> : <ChevronRight className="w-4 h-4 text-[#64748b]" />}
            </motion.span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1" role="navigation" aria-label="Main menu">
          {/* Primary Actions */}
          <div className="space-y-1">
            {['chat', 'agent', 'voice', 'resume'].map((itemId) => {
              const item = navItems.find(n => n.id === itemId);
              const Icon = item.icon;
              const isActive = activeItem === itemId;
              return (
                <button
                  key={itemId}
                  onClick={() => onItemClick(itemId)}
                  onMouseEnter={() => setHoveredItem(itemId)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 relative overflow-hidden group
                    ${isActive
                      ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 text-white border border-cyan-500/20'
                      : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                    }
                  `}
                  style={{
                    borderLeft: isActive ? '3px solid #06b6d4' : 'none',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: hoveredItem === itemId || isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isActive
                        ? 'rgba(6,182,212,0.2)'
                        : 'rgba(255,255,255,0.04)',
                      border: isActive
                        ? '1px solid rgba(6,182,212,0.3)'
                        : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-[#94a3b8]'}`}
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
                        background: item.badge === 'Live' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)',
                        color: item.badge === 'Live' ? '#10b981' : '#8b5cf6',
                        border: item.badge === 'Live' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(139,92,246,0.3)',
                      }}
                    >
                      {item.badge}
                    </motion.span>
                  )}

                  {isActive && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      exit={{ width: 0 }}
                      className="absolute left-0 top-0 bottom-0"
                      style={{ background: 'linear-gradient(90deg, rgba(6,182,212,0.08), transparent)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isOpen ? 1 : 0 }}
            className="my-4 border-t border-white/5"
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
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">Projects</span>
                  <button
                    onClick={onNewProject}
                    className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-cyan-400"
                    aria-label="Create new project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {userProjects.map((project, index) => {
                const projectId = project.project_id || project.id;
                const projectKey = `project-${projectId}`;
                const isActive = activeItem === projectKey;
                return (
                  <button
                    key={projectId}
                    onClick={() => onItemClick(projectKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm truncate
                      ${isActive
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
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
                  className="px-3 py-4 text-center text-[#475569] text-sm"
                >
                  No projects yet. Click + to create one.
                </motion.div>
              )}
            </div>
          </div>
        </nav>

        {/* Bottom: New Chat + User Info */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(139,92,246,0.2) 100%)',
              border: '1px solid rgba(6,182,212,0.3)',
              color: '#06b6d4',
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
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white text-sm truncate">Developer</p>
                  <p className="text-[11px] text-[#64748b] truncate">waaw.local</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </>
  );
}