import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PenTool, Sparkles, Copy, Check, RotateCw, Globe, CheckCircle2, 
  BookOpen, FileText, Send, Layers, Zap, AlertCircle
} from 'lucide-react';
import axios from 'axios';

const FORMATS = [
  { id: 'formal-email', name: 'Formal Email', icon: '✉️' },
  { id: 'application', name: 'Official Application', icon: '📝' },
  { id: 'letter', name: 'Business Letter', icon: '📄' },
  { id: 'resume-content', name: 'Resume Content', icon: '💼' },
  { id: 'linkedin-post', name: 'LinkedIn Post', icon: '🚀' },
  { id: 'youtube-script', name: 'YouTube Script', icon: '🎥' },
  { id: 'documentary-script', name: 'Documentary Script', icon: '🎬' },
  { id: 'blog', name: 'Blog Post', icon: '✍️' },
  { id: 'article', name: 'Analytical Article', icon: '📰' },
  { id: 'research-abstract', name: 'Research Abstract', icon: '🔬' },
  { id: 'project-description', name: 'Project Description', icon: '💻' },
  { id: 'product-description', name: 'Product Description', icon: '🛍️' },
  { id: 'social-media-caption', name: 'Social Caption', icon: '📱' },
  { id: 'hinglish-content', name: 'Hinglish Content', icon: '🇮🇳' },
  { id: 'hindi-english-translation', name: 'Translation', icon: '🌐' },
  { id: 'grammar-correction', name: 'Grammar Correction', icon: '✅' },
  { id: 'professional-rewriting', name: 'Professional Rewrite', icon: '🔄' },
];

const TONES = [
  { id: 'professional', name: 'Professional', desc: 'Crisp, corporate, results-oriented' },
  { id: 'formal', name: 'Formal', desc: 'Traditional, respectful, dignified' },
  { id: 'simple', name: 'Simple', desc: 'Plain English/Hindi, elementary vocabulary' },
  { id: 'friendly', name: 'Friendly', desc: 'Warm, approachable, empathetic' },
  { id: 'persuasive', name: 'Persuasive', desc: 'Compelling, benefit-driven CTA' },
  { id: 'academic', name: 'Academic', desc: 'Scholarly, evidence-based, rigorous' },
  { id: 'technical', name: 'Technical', desc: 'Architectural terminology, precise' },
  { id: 'short-and-direct', name: 'Short & Direct', desc: 'Ultra-concise, bullet points' },
  { id: 'detailed', name: 'Detailed', desc: 'Comprehensive, deep background' },
];

export default function WritingStudioView({ onToast }) {
  const [activeMode, setActiveMode] = useState('generate'); // 'generate' | 'rewrite' | 'grammar' | 'translate'
  const [format, setFormat] = useState('formal-email');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('en'); // 'en' | 'hi' | 'hinglish'

  // Form Inputs
  const [topic, setTopic] = useState('');
  const [recipient, setRecipient] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [rawText, setRawText] = useState('');

  // Execution & Output State
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!topic.trim() && activeMode === 'generate') {
      onToast?.('Please provide a topic or purpose', 'warning');
      return;
    }
    if (!rawText.trim() && activeMode !== 'generate') {
      onToast?.('Please provide the text to process', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (activeMode === 'generate') {
        const pointsArray = keyPoints.split('\n').map(p => p.trim()).filter(Boolean);
        const res = await axios.post('/api/writing/generate', {
          format,
          tone,
          topic,
          recipient,
          keyPoints: pointsArray,
          language
        });
        if (res.data?.success) {
          setOutput(res.data.content);
          onToast?.('Content generated successfully!', 'success');
        }
      } else if (activeMode === 'rewrite') {
        const res = await axios.post('/api/writing/rewrite', {
          text: rawText,
          tone,
          targetLanguage: language === 'hi' ? 'Hindi' : (language === 'hinglish' ? 'Hinglish' : 'English')
        });
        if (res.data?.success) {
          setOutput(res.data.rewrittenText);
          onToast?.('Rewrite complete!', 'success');
        }
      } else if (activeMode === 'grammar') {
        const res = await axios.post('/api/writing/grammar', { text: rawText });
        if (res.data?.success) {
          setOutput(res.data.analysis);
          onToast?.('Grammar audit complete!', 'success');
        }
      } else if (activeMode === 'translate') {
        const res = await axios.post('/api/writing/translate', {
          text: rawText,
          targetLang: language === 'hi' ? 'Hindi (Devanagari)' : (language === 'hinglish' ? 'Hinglish' : 'English'),
          tone
        });
        if (res.data?.success) {
          setOutput(res.data.translation);
          onToast?.('Translation ready!', 'success');
        }
      }
    } catch (err) {
      onToast?.(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onToast?.('Copied to clipboard!', 'success');
  };

  const wordCount = output ? output.trim().split(/\s+/).length : 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex-1 flex flex-col h-full bg-canvas-base overflow-y-auto p-4 md:p-6 space-y-6 select-text">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-[0_0_15px_var(--color-primary-glow)]">
              <div className="w-full h-full bg-canvas-surface rounded-[10px] flex items-center justify-center">
                <PenTool className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
                Writing & Communication Studio ✍️
              </h1>
              <p className="text-xs text-text-muted">
                17 Writing Formats &bull; 9 Tones &bull; English, Shuddh Hindi & Hinglish
              </p>
            </div>
          </div>
        </div>

        {/* Studio Mode Selector */}
        <div className="flex bg-canvas-surface border border-border rounded-xl p-1 gap-1 self-start md:self-auto">
          {[
            { id: 'generate', label: 'Create Copy', icon: Sparkles },
            { id: 'rewrite', label: 'Rewrite & Polish', icon: RotateCw },
            { id: 'grammar', label: 'Grammar Audit', icon: CheckCircle2 },
            { id: 'translate', label: 'Translate', icon: Globe },
          ].map((m) => {
            const Icon = m.icon;
            const active = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMode(m.id);
                  setOutput('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  active 
                    ? 'bg-accent text-white shadow-xs' 
                    : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
        
        {/* Left Form Panel: 5 Cols */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-canvas-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
            
            {/* Tone & Language Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Tone</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full mt-1.5 h-9 px-2.5 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {TONES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full mt-1.5 h-9 px-2.5 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="en">English (Global)</option>
                  <option value="hi">Hindi (Devanagari)</option>
                  <option value="hinglish">Hinglish (Urban Indian)</option>
                </select>
              </div>
            </div>

            {/* Mode 1: Generate Form */}
            {activeMode === 'generate' && (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Writing Format</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-36 overflow-y-auto pr-1">
                    {FORMATS.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormat(f.id)}
                        className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-medium flex items-center gap-1.5 transition truncate cursor-pointer ${
                          format === f.id
                            ? 'bg-primary/10 border-primary text-primary font-bold'
                            : 'bg-canvas-default border-border text-text-secondary hover:border-text-muted'
                        }`}
                      >
                        <span>{f.icon}</span>
                        <span className="truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Topic / Core Purpose</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Requesting approval for team budget or Startup announcement"
                    className="w-full mt-1.5 h-10 px-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Recipient (Optional)</label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g. Hiring Manager"
                      className="w-full mt-1.5 h-9 px-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Selected Tone Info</label>
                    <div className="mt-1.5 h-9 px-2.5 bg-canvas-default/60 border border-border/80 rounded-lg text-[10px] text-text-muted flex items-center truncate">
                      {TONES.find(t => t.id === tone)?.desc}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Key Points to Include (One per line)</label>
                  <textarea
                    rows={3}
                    value={keyPoints}
                    onChange={(e) => setKeyPoints(e.target.value)}
                    placeholder="• Achieved 40% performance gain&#10;• Zero regressions in production"
                    className="w-full mt-1.5 p-3 bg-canvas-default border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Modes 2, 3, 4: Raw Text Processing */}
            {activeMode !== 'generate' && (
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  {activeMode === 'rewrite' ? 'Draft to Polish & Elevate' : activeMode === 'grammar' ? 'Text to Audit & Fix' : 'Source Text to Translate'}
                </label>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={
                    activeMode === 'rewrite' 
                      ? 'Paste informal or draft email, bullet points, or paragraphs here...'
                      : activeMode === 'grammar' 
                      ? 'Paste text with grammatical errors, typos, or syntax issues...'
                      : 'Type or paste Hindi or English text here...'
                  }
                  className="w-full mt-1.5 p-3 bg-canvas-default border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer bg-accent hover:bg-accent-hover text-white shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Drafting Content...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeMode === 'generate' ? 'Generate Polished Copy' : activeMode === 'rewrite' ? 'Execute Professional Rewrite' : activeMode === 'grammar' ? 'Run Grammar Audit' : 'Translate Content'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Output Panel: 7 Cols */}
        <div className="lg:col-span-7 flex flex-col bg-canvas-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Generated Output
              </span>
              {output && (
                <span className="text-[11px] text-text-muted">
                  {wordCount} words &bull; ~{readTime} min read
                </span>
              )}
            </div>

            {output && (
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-canvas-default hover:bg-canvas-hover border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 text-text-primary transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-canvas-default border border-border rounded-xl p-4 overflow-y-auto font-sans text-xs text-text-primary leading-relaxed whitespace-pre-wrap min-h-[350px]">
            {output ? (
              output
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 text-text-muted space-y-2">
                <PenTool className="w-8 h-8 text-primary/40 mb-2 stroke-[1.5]" />
                <p className="font-semibold text-xs text-text-secondary">Ready to Craft World-Class Communication</p>
                <p className="text-[11px] max-w-sm">
                  Select your format, specify your tone, and let AI-Dost generate executive-ready emails, scripts, applications, or articles.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
