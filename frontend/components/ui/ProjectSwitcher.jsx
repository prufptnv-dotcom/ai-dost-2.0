import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, ChevronDown, Plus, Check, Search } from 'lucide-react';
import { Button, IconButton } from './Button';

export function ProjectSwitcher({
  projects = [],
  activeProjectId,
  onSelectProject,
  onNewProject,
  loading = false,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const activeProject = projects.find(
    (p) => (p.project_id || p.id) === activeProjectId
  ) || projects[0] || null;

  const filteredProjects = projects.filter((p) => {
    const name = (p.project_name || p.name || '').toLowerCase();
    return name.includes(query.toLowerCase());
  });

  return (
    <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-border-strong text-txt-primary transition-fast focus-ring cursor-pointer select-none max-w-[200px] sm:max-w-[240px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={activeProject ? (activeProject.project_name || activeProject.name) : 'Select Project'}
      >
        <FolderOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="text-xs font-medium truncate flex-1 text-left">
          {loading
            ? 'Loading...'
            : activeProject
            ? activeProject.project_name || activeProject.name
            : 'No project selected'}
        </span>
        <ChevronDown className={`w-3 h-3 text-txt-muted flex-shrink-0 transition-fast ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1.5 w-64 bg-canvas-surface border border-border-strong rounded-lg shadow-popover z-50 overflow-hidden animate-in fade-in zoom-in-95 transition-normal"
        >
          {/* Search Header */}
          {projects.length > 4 && (
            <div className="p-2 border-b border-border bg-canvas-subtle">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2 text-txt-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter projects..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-canvas-base text-xs text-txt-primary placeholder-txt-muted pl-7 pr-2 py-1 rounded-sm border border-border focus:border-border-focus focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Projects List */}
          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-border-subtle">
            {filteredProjects.length === 0 ? (
              <div className="p-3 text-center text-xs text-txt-muted">
                {query ? 'No matching projects' : 'No projects created yet'}
              </div>
            ) : (
              filteredProjects.map((p) => {
                const id = p.project_id || p.id;
                const name = p.project_name || p.name;
                const isSelected = id === (activeProject ? activeProject.project_id || activeProject.id : null);

                return (
                  <button
                    key={id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectProject && onSelectProject(id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs rounded-sm text-left transition-fast cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-txt-secondary hover:text-txt-primary hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* New Project Action */}
          {onNewProject && (
            <div className="p-1.5 border-t border-border bg-canvas-subtle">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNewProject();
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs font-medium text-accent hover:text-accent-hover hover:bg-accent/10 rounded-sm transition-fast cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectSwitcher;
