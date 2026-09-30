import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Search, Copy, Check, Code2, Bot, Brain, Database,
  Globe, Smartphone, Cloud, ShieldCheck, Cpu, Network, GraduationCap,
  Atom, Variable, Cog, Workflow, BookOpenCheck, FileText, BarChart3,
  PenTool, Mic, Video, Palette, Layout, Binary, Briefcase, Rocket,
  Kanban, Receipt, Landmark, Languages, BrainCircuit, Leaf,
  UtensilsCrossed, Home, Car, Plane, FlaskConical, ClipboardCheck,
  UserCheck, Zap, SearchCheck, FolderKanban, GitPullRequest,
  CheckCircle2, Gauge, Wrench, Gamepad2, Newspaper, ArrowRight,
  Info, X, Layers, Filter
} from 'lucide-react';
import axios from 'axios';

const ICON_MAP = {
  Code2, Bot, Brain, Database, Globe, Smartphone, Cloud, ShieldCheck,
  Cpu, Network, GraduationCap, Atom, Variable, Cog, Workflow,
  BookOpenCheck, FileText, BarChart3, PenTool, Mic, Video, Palette,
  Layout, Binary, Briefcase, Rocket, Kanban, Receipt, Landmark,
  Languages, BrainCircuit, Leaf, UtensilsCrossed, Home, Car, Plane,
  FlaskConical, ClipboardCheck, UserCheck, Zap, SearchCheck,
  FolderKanban, GitPullRequest, CheckCircle2, Gauge, Wrench,
  Gamepad2, Newspaper, Sparkles
};

const CLUSTER_COLORS = {
  'Engineering & Software': 'from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-400',
  'AI, Data & Intelligence': 'from-purple-500/20 to-pink-500/20 border-pink-500/30 text-pink-400',
  'Science, Math & Academia': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
  'Design, Media & Content': 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
  'Business, Product & Leadership': 'from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-400',
  'Real-World, Society & Life': 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-400',
};

export default function MasterCapabilitiesView({ onToast, onNavigate }) {
  const [capabilities, setCapabilities] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCluster, setSelectedCluster] = useState('All');
  const [selectedCapability, setSelectedCapability] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchCapabilities() {
      try {
        const res = await axios.get('/api/catalog/capabilities');
        if (isMounted && res.data && res.data.capabilities) {
          setCapabilities(res.data.capabilities);
          setClusters(res.data.clusters || []);
        }
      } catch (err) {
        console.warn('Could not fetch capabilities from API, loading catalog fallback:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchCapabilities();
    return () => { isMounted = false; };
  }, []);

  const filteredCapabilities = useMemo(() => {
    return capabilities.filter(cap => {
      const matchCluster = selectedCluster === 'All' || cap.cluster === selectedCluster;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchCluster;
      const matchText =
        cap.title.toLowerCase().includes(query) ||
        cap.description.toLowerCase().includes(query) ||
        cap.slug.toLowerCase().includes(query) ||
        (cap.tags && cap.tags.some(t => t.toLowerCase().includes(query)));
      return matchCluster && matchText;
    });
  }, [capabilities, selectedCluster, searchQuery]);

  const handleCopyPrompt = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (onToast) onToast('Sample prompt copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLaunchPrompt = (prompt) => {
    if (onNavigate) {
      onNavigate('chat', { initialPrompt: prompt });
    } else {
      handleCopyPrompt(prompt, 'launch');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-canvas-base text-fg-primary">
      {/* Top Glassmorphic Header */}
      <div className="p-6 pb-4 border-b border-border bg-canvas-subtle/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-fg-primary via-fg-primary to-cyan-400 bg-clip-text text-transparent">
                50-Domain Master Capability Hub
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                50 / 50 Active
              </span>
            </div>
            <p className="text-sm text-fg-muted max-w-2xl">
              Unified polymath intelligence: programming, AI/ML, data science, databases, OS, networks, sciences, engineering, creative media, and real-world workflows.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              placeholder="Search 50 capabilities, skills, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-canvas-base/80 border border-border rounded-xl text-fg-primary placeholder:text-fg-muted focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-primary text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Cluster Filter Chips */}
        <div className="max-w-7xl mx-auto mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCluster('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCluster === 'All'
                ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                : 'bg-canvas-base/60 text-fg-muted hover:text-fg-primary border border-border'
            }`}
          >
            <Filter className="w-3 h-3" />
            All (50)
          </button>
          {clusters.map((clusterName) => (
            <button
              key={clusterName}
              onClick={() => setSelectedCluster(clusterName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedCluster === clusterName
                  ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                  : 'bg-canvas-base/60 text-fg-muted hover:text-fg-primary border border-border'
              }`}
            >
              {clusterName}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-canvas-subtle/50 animate-pulse border border-border/50" />
              ))}
            </div>
          ) : filteredCapabilities.length === 0 ? (
            <div className="text-center py-16 text-fg-muted">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-40 text-cyan-400" />
              <h3 className="text-base font-semibold text-fg-primary mb-1">No matching capabilities found</h3>
              <p className="text-xs">Try adjusting your search query or cluster filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCapabilities.map((cap) => {
                const IconComponent = ICON_MAP[cap.icon] || Sparkles;
                const clusterStyle = CLUSTER_COLORS[cap.cluster] || 'from-gray-500/20 to-slate-500/20 border-border text-fg-muted';

                return (
                  <motion.div
                    key={cap.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="group relative flex flex-col justify-between p-5 rounded-2xl bg-canvas-subtle/40 hover:bg-canvas-subtle/80 border border-border hover:border-cyan-500/40 backdrop-blur-xs transition-all duration-200 shadow-xs hover:shadow-lg hover:shadow-cyan-500/5"
                  >
                    <div>
                      {/* Top Bar: Icon + ID + Cluster */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${clusterStyle} flex items-center justify-center border transition-transform group-hover:scale-105`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-bold tracking-wider text-fg-muted group-hover:text-cyan-400 transition-colors">
                              DOMAIN #{cap.id}
                            </span>
                            <h3 className="text-sm font-bold text-fg-primary group-hover:text-cyan-300 transition-colors line-clamp-1">
                              {cap.title}
                            </h3>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedCapability(cap)}
                          title="Inspect domain directive & standards"
                          className="p-1.5 text-fg-muted hover:text-cyan-400 rounded-lg hover:bg-canvas-base transition-colors"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-fg-muted leading-relaxed line-clamp-2 mb-3">
                        {cap.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(cap.tags || []).slice(0, 4).map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2 py-0.5 text-[10px] rounded-md bg-canvas-base border border-border/80 text-fg-muted font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom: Sample Prompt & Action */}
                    <div className="pt-3 border-t border-border/60">
                      {cap.samplePrompts && cap.samplePrompts.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-fg-muted">
                            Sample Prompt:
                          </span>
                          <div className="p-2 rounded-lg bg-canvas-base/80 border border-border/60 text-xs text-fg-primary italic line-clamp-2">
                            &quot;{cap.samplePrompts[0]}&quot;
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLaunchPrompt(cap.samplePrompts?.[0] || cap.title)}
                          className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-white border border-cyan-500/30 hover:border-cyan-500 text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-xs"
                        >
                          <span>Launch in Chat</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleCopyPrompt(cap.samplePrompts?.[0] || cap.title, cap.id)}
                          title="Copy prompt"
                          className="p-2 rounded-xl bg-canvas-base hover:bg-canvas-subtle border border-border text-fg-muted hover:text-fg-primary transition-colors"
                        >
                          {copiedId === cap.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Domain Directive Modal */}
      <AnimatePresence>
        {selectedCapability && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-canvas-base border border-border shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-canvas-subtle/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">
                    #{selectedCapability.id}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-fg-primary">
                      {selectedCapability.title}
                    </h3>
                    <span className="text-xs text-cyan-400 font-medium">
                      {selectedCapability.cluster}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCapability(null)}
                  className="p-1.5 rounded-lg text-fg-muted hover:text-fg-primary hover:bg-canvas-subtle transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-fg-primary">
                <div>
                  <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">
                    Domain Overview
                  </h4>
                  <p className="text-sm text-fg-primary leading-relaxed">
                    {selectedCapability.description}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">
                    Sample Prompts (Multilingual)
                  </h4>
                  <div className="space-y-2">
                    {(selectedCapability.samplePrompts || []).map((prompt, pIdx) => (
                      <div
                        key={pIdx}
                        className="p-3 rounded-xl bg-canvas-subtle/60 border border-border flex items-center justify-between gap-3 group"
                      >
                        <span className="text-xs text-fg-primary italic">&quot;{prompt}&quot;</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleCopyPrompt(prompt, `modal-${pIdx}`)}
                            title="Copy prompt"
                            className="p-1.5 rounded-md hover:bg-canvas-base text-fg-muted hover:text-fg-primary transition-colors"
                          >
                            {copiedId === `modal-${pIdx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCapability(null);
                              handleLaunchPrompt(prompt);
                            }}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors"
                          >
                            Run
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1.5">
                    Core Technical Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedCapability.tags || []).map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="px-2.5 py-1 text-xs rounded-lg bg-canvas-subtle border border-border text-fg-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border bg-canvas-subtle/30 flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedCapability(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-fg-muted hover:text-fg-primary border border-border hover:bg-canvas-subtle transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const prompt = selectedCapability.samplePrompts?.[0] || selectedCapability.title;
                    setSelectedCapability(null);
                    handleLaunchPrompt(prompt);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all flex items-center gap-1.5"
                >
                  <span>Launch in Chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
