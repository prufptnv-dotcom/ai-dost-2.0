'use client';

import React, { useState } from 'react';
import {
  Compass,
  Search,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Layers,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import Button from '../ui/Button';

const DEPTH_OPTIONS = [
  { id: 'summary', label: 'Executive Brief', desc: 'Fast, high-level summary' },
  { id: 'deep', label: 'Deep Analysis', desc: 'Comprehensive multi-source report' },
  { id: 'competitive', label: 'Market & Tech Matrix', desc: 'Comparative landscape & trends' }
];

const SUGGESTED_TOPICS = [
  { title: 'Global Semiconductor Foundry Landscape 2026', query: 'Global semiconductor foundries market share 2026 advanced nodes' },
  { title: 'Autonomous AI Agents in Enterprise', query: 'Autonomous AI agents enterprise adoption trends 2026' },
  { title: 'Next-Gen Solid State Battery Commercialization', query: 'Solid state battery EV commercial rollout 2026' },
  { title: 'Post-Quantum Cryptography Migration', query: 'Post-quantum cryptography NIST standards migration timeline' }
];

export default function ResearchView({ onToast, onNavigate }) {
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState('deep');
  const [isResearching, setIsResearching] = useState(false);
  const [researchStage, setResearchStage] = useState('');
  const [result, setResult] = useState(null);
  const [isExporting, setIsExporting] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleStartResearch = async (targetQuery) => {
    const q = (targetQuery || topic).trim();
    if (!q) {
      if (onToast) onToast('Please enter a research topic', 'warning');
      return;
    }
    setTopic(q);
    setIsResearching(true);
    setResult(null);

    try {
      setResearchStage('Decomposing query into multi-angle investigations...');
      await new Promise(r => setTimeout(r, 600));

      setResearchStage('Querying web evidence & verifying domain authorities...');
      const res = await api.post('/research/run', {
        topic: q,
        depth,
        maxSources: depth === 'summary' ? 3 : 5
      });

      setResearchStage('Detecting cross-source consensus & synthesizing citations...');
      await new Promise(r => setTimeout(r, 400));

      if (res.data?.success && res.data?.data) {
        setResult(res.data.data);
        if (onToast) onToast('Research report generated with verified citations!', 'success');
      } else {
        throw new Error(res.data?.error || 'Research failed');
      }
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to complete research', 'error');
    } finally {
      setIsResearching(false);
      setResearchStage('');
    }
  };

  const handleExport = async (format) => {
    if (!result) return;
    setIsExporting(format);
    try {
      const res = await api.post('/research/export', {
        topic: result.topic,
        markdownReport: result.markdownReport,
        format
      });

      if (res.data?.success && res.data?.downloadUrl) {
        const url = res.data.downloadUrl.startsWith('http') ? res.data.downloadUrl : `${res.data.downloadUrl}`;
        window.open(url, '_blank');
        if (onToast) onToast(`Report exported as ${format.toUpperCase()}!`, 'success');
      } else {
        throw new Error(res.data?.error || 'Export failed');
      }
    } catch (err) {
      if (onToast) onToast(err.message || `Failed to export ${format.toUpperCase()}`, 'error');
    } finally {
      setIsExporting(null);
    }
  };

  const copyMarkdown = () => {
    if (!result?.markdownReport) return;
    navigator.clipboard.writeText(result.markdownReport);
    setCopied(true);
    if (onToast) onToast('Research markdown copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base text-txt-primary overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-canvas-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-sm bg-accent-primary/10 text-accent-primary">
            <Compass size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-paper-100 font-display flex items-center gap-2">
              Deep Research Agent
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary font-normal">
                P6 Web Evidence Graph
              </span>
            </h1>
            <p className="text-[11px] text-ink-muted">
              Evidence-based multi-source synthesis, consensus verification, and 1-click official documents
            </p>
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={copyMarkdown}
              title="Copy Markdown"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Markdown'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExport('docx')}
              disabled={isExporting !== null}
              title="Export as Microsoft Word document"
            >
              <FileText size={13} />
              <span>{isExporting === 'docx' ? 'Compiling...' : 'Word (.docx)'}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== null}
              title="Export as high-resolution PDF document"
            >
              <Download size={13} />
              <span>{isExporting === 'pdf' ? 'Generating...' : 'PDF Report'}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 max-w-5xl w-full mx-auto space-y-6">
        {/* Research Input Card */}
        <div className="p-4 rounded-lg border border-border bg-canvas-surface shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isResearching && handleStartResearch()}
                placeholder="Enter any topic, question, market, or technology to investigate..."
                disabled={isResearching}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-canvas-base border border-border text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent-primary transition-fast"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => handleStartResearch()}
              disabled={isResearching || !topic.trim()}
              className="gap-2"
            >
              {isResearching ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Investigating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Conduct Research</span>
                </>
              )}
            </Button>
          </div>

          {/* Depth Preset Chips */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-ink-muted font-medium mr-1">Depth:</span>
            {DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDepth(opt.id)}
                disabled={isResearching}
                className={`px-3 py-1 rounded-sm text-xs font-sans border transition-fast cursor-pointer ${
                  depth === opt.id
                    ? 'bg-accent-primary/10 border-accent-primary text-accent-primary font-medium'
                    : 'bg-canvas-base border-border text-txt-muted hover:text-txt-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Loading State */}
        {isResearching && (
          <div className="p-6 rounded-lg border border-accent-primary/20 bg-accent-primary/5 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-accent-primary/10 text-accent-primary animate-pulse">
              <RefreshCw size={24} className="animate-spin" />
            </div>
            <h3 className="text-sm font-semibold text-txt-primary">Autonomous Research Agent Running</h3>
            <p className="text-xs text-accent-primary font-mono">{researchStage}</p>
            <div className="w-48 h-1 bg-border rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-accent-primary rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Empty State / Inspiration Grid */}
        {!isResearching && !result && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">
              <TrendingUp size={14} className="text-accent-primary" />
              <span>Curated Research Topics</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SUGGESTED_TOPICS.map((t, idx) => (
                <div
                  key={idx}
                  onClick={() => handleStartResearch(t.query)}
                  className="p-3.5 rounded-lg border border-border bg-canvas-surface hover:border-accent-primary/50 hover:bg-canvas-elevated transition-fast cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-xs font-semibold text-txt-primary group-hover:text-accent-primary transition-fast">
                      {t.title}
                    </h4>
                    <Compass size={14} className="text-ink-muted group-hover:text-accent-primary transition-fast flex-shrink-0" />
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1 line-clamp-1">
                    {t.query}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Canvas */}
        {!isResearching && result && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Executive Summary Card */}
            <div className="p-5 rounded-lg border border-border bg-canvas-surface space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-txt-primary font-display flex items-center gap-2">
                  <FileText size={16} className="text-accent-primary" />
                  Executive Summary
                </h2>
                <span className="text-[11px] font-mono text-ink-muted">
                  {result.sources.length} sources analyzed · {result.depth.toUpperCase()}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-txt-primary/90 whitespace-pre-line font-sans">
                {result.summary}
              </p>
            </div>

            {/* Key Findings Grid */}
            <div className="p-5 rounded-lg border border-border bg-canvas-surface space-y-3">
              <h3 className="text-sm font-semibold text-txt-primary font-display flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Key Findings & Verified Evidence
              </h3>
              <div className="space-y-2">
                {result.keyFindings.map((finding, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-md bg-canvas-base border border-border/60 text-xs">
                    <span className="font-mono text-accent-primary font-bold text-[11px] flex-shrink-0 mt-0.5">
                      0{idx + 1}
                    </span>
                    <span className="text-txt-primary leading-normal">{finding}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consensus & Contradiction Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={14} />
                  <span>Consensus Across Sources</span>
                </div>
                <p className="text-xs text-txt-primary leading-relaxed">
                  {result.consensus}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle size={14} />
                  <span>Contradictions & Variance</span>
                </div>
                <p className="text-xs text-txt-primary leading-relaxed">
                  {result.contradictions}
                </p>
              </div>
            </div>

            {/* Evidence & Sources Table */}
            <div className="p-5 rounded-lg border border-border bg-canvas-surface space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-txt-primary font-display flex items-center gap-2">
                  <Layers size={16} className="text-accent-primary" />
                  Primary Evidence & Source Graph
                </h3>
                <span className="text-[11px] text-ink-muted">
                  Audited with Domain Authority
                </span>
              </div>
              <div className="space-y-2.5">
                {result.sources.map((src) => (
                  <div key={src.id} className="p-3 rounded-md bg-canvas-base border border-border/80 flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-accent-primary/10 text-accent-primary">
                          [{src.id}]
                        </span>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-txt-primary hover:text-accent-primary transition-fast flex items-center gap-1.5 truncate"
                        >
                          {src.title}
                          <ExternalLink size={11} className="flex-shrink-0 text-ink-muted" />
                        </a>
                      </div>
                      <p className="text-[11px] text-ink-muted line-clamp-2 pl-6">
                        {src.snippet}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                        {src.authorityScore}/100 Trust
                      </span>
                      <span className="text-[10px] text-ink-muted font-mono truncate max-w-[120px]">
                        {src.domain}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
