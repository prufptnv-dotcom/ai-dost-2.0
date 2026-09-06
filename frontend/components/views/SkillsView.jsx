import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Puzzle, Plus, Trash2, CheckCircle, Search, Cpu, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { SkeletonTableRow } from '../ui/Skeleton';

export default function SkillsView({ onToast }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  }), [onToast]);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/skills');
      if (res.data?.skills) {
        setSkills(res.data.skills);
      }
    } catch (e) {
      showToast(e?.message || 'Failed to load skills', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const createSkill = async () => {
    if (!name.trim() || !systemPrompt.trim() || creating) return;
    setCreating(true);
    try {
      await api.post('/skills', {
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        tools: ['read_file', 'grep_search', 'run_command'] // default tools
      });
      showToast('Skill created successfully', 'success');
      setShowCreate(false);
      setName('');
      setDescription('');
      setSystemPrompt('');
      await loadSkills();
    } catch (e) {
      showToast(e?.message || 'Create failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  const deleteSkill = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom skill?')) return;
    
    try {
      await api.delete(`/skills/${id}`);
      showToast('Skill deleted', 'success');
      await loadSkills();
    } catch (error) {
      showToast(error?.response?.data?.error || 'Failed to delete skill', 'error');
    }
  };

  const filteredSkills = skills.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-var-bg relative z-0 overflow-hidden">
      {/* Header */}
      <div className="flex-none p-6 pb-2 border-b border-white/5 bg-var-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-var-primary/10 border border-var-primary/20">
              <Puzzle className="w-5 h-5 text-var-primary" />
            </div>
            <div>
              <h1 className="text-xl font-medium text-var-text">Skills Marketplace</h1>
              <p className="text-sm text-var-muted">Custom AI personalities and targeted workflows</p>
            </div>
          </div>
          
          <Button 
            onClick={() => setShowCreate(true)} 
            className="bg-var-primary hover:bg-var-primary/90 text-white font-medium shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)] transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Skill
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="relative mt-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-var-muted" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-var-surface/50 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-sm text-var-text placeholder-var-muted/50 focus:outline-none focus:border-var-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {[1, 2, 3, 4].map(i => (
               <div key={i} className="h-[200px] bg-var-surface/30 rounded-xl animate-pulse border border-white/5"></div>
             ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
               <Puzzle className="w-8 h-8 text-var-muted" />
             </div>
             <h3 className="text-lg font-medium text-var-text mb-2">No skills found</h3>
             <p className="text-var-muted text-sm max-w-sm mb-6">
               {searchQuery ? 'No skills match your search.' : 'Create a custom skill to tailor AI-Dost to your specific workflows.'}
             </p>
             {!searchQuery && (
               <Button onClick={() => setShowCreate(true)} variant="outline" className="border-white/10 hover:border-var-primary/50">
                 Create Your First Skill
               </Button>
             )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredSkills.map(skill => (
              <div 
                key={skill.id}
                className="group flex flex-col bg-var-surface/50 border border-white/5 rounded-xl p-5 hover:border-var-primary/30 hover:bg-var-surface transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-var-primary/5 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity opacity-0 group-hover:opacity-100" />
                
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-2.5 rounded-lg bg-var-surface border border-white/10 text-var-primary group-hover:bg-var-primary/10 group-hover:border-var-primary/20 transition-colors">
                    {skill.is_official ? <CheckCircle className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                  </div>
                  {!skill.is_official && (
                    <button 
                      onClick={(e) => deleteSkill(skill.id, e)}
                      className="p-1.5 rounded-md text-var-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete custom skill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="relative z-10 flex-1">
                  <h3 className="text-base font-medium text-var-text mb-1 flex items-center gap-2">
                    {skill.name}
                    {skill.is_official && <Badge variant="primary" className="text-[10px] py-0">Official</Badge>}
                  </h3>
                  <p className="text-sm text-var-muted line-clamp-2 leading-relaxed">
                    {skill.description || 'No description provided.'}
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-var-muted relative z-10">
                  <span className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></div>
                    Ready
                  </span>
                  <span className="text-[10px] opacity-60">
                    {new Date(skill.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Skill Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Custom Skill" size="lg">
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-medium text-var-muted mb-1.5 uppercase tracking-wider">Skill Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Code Reviewer, Python Expert..."
              className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-var-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-var-muted mb-1.5 uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this skill does"
              className="w-full bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-var-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-var-muted mb-1.5 uppercase tracking-wider">System Prompt (The Agent&apos;s Brain)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert in... Your goal is to... Never do..."
              className="w-full h-32 bg-var-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-var-text focus:outline-none focus:border-var-primary/50 transition-colors resize-none custom-scrollbar"
            />
            <p className="text-[10px] text-var-muted mt-1.5">This prompt overrides the default system personality.</p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button 
              onClick={createSkill} 
              disabled={!name.trim() || !systemPrompt.trim() || creating}
              className="bg-var-primary text-white hover:bg-var-primary/90"
            >
              {creating ? 'Creating...' : 'Create Skill'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
