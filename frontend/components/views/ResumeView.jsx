import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle, Copy, Download, X, Loader2, Plus, TrendingUp, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useToast } from '../../context/ToastContext';

export default function ResumeView({
  initialResume,
  onToast,
  onClose
}) {
  const [selectedResume, setSelectedResume] = useState(initialResume || null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingSection, setIsRegeneratingSection] = useState({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState('split');
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'ats'
  const [jobDescription, setJobDescription] = useState('');
  const [atsResult, setAtsResult] = useState(null);
  const [isAnalyzingAts, setIsAnalyzingAts] = useState(false);
  
  const { showToast } = useToast();

  const renderMarkdown = useCallback((html) => DOMPurify.sanitize(html), []);

  const [selectedTemplate, setSelectedTemplate] = useState('professional');

  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushToHistory = useCallback((newResumeData) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newResumeData)));
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSelectedResume(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSelectedResume(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const templates = [
    { id: 'professional', label: 'Professional', description: 'Clean corporate style' },
    { id: 'creative', label: 'Creative', description: 'Modern layout with accent colors' },
    { id: 'minimal', label: 'Minimal', description: 'Simple black & white layout' },
  ];

  const generateResumePreviewHtml = (resumeData, template = 'professional') => {
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric' }) : 'N/A';

    let themeCss = '';
    if (template === 'professional') {
      themeCss = `
        body { font-family: 'Inter', sans-serif; background: #ffffff; color: #333333; }
        .header-section { border-bottom: 2px solid #2563eb; padding-bottom: 2rem; margin-bottom: 2rem; }
        .name { color: #1e3a8a; }
        .section-title { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; text-transform: uppercase; }
        .skill-tag { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        .item-bullets li::before { background: #2563eb; }
      `;
    } else if (template === 'creative') {
      themeCss = `
        body { font-family: 'Poppins', sans-serif; background: #fafafa; color: #1f2937; }
        .resume-container { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; }
        .header-section { grid-column: 1 / -1; background: #06b6d4; color: white; padding: 2rem; border-radius: 12px; margin-bottom: 1rem; text-align: left; }
        .name { color: white; }
        .tagline, .contact { color: #cffafe; }
        .section-title { color: #0891b2; font-size: 1.3rem; margin-bottom: 1.2rem; }
        .skill-tag { background: #06b6d4; color: white; border-radius: 20px; }
        .item-bullets li::before { background: #06b6d4; }
      `;
    } else if (template === 'minimal') {
      themeCss = `
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #ffffff; color: #000000; }
        .header-section { text-align: left; border-bottom: 1px solid #000000; padding-bottom: 1.5rem; margin-bottom: 2.5rem; }
        .name { font-weight: 700; letter-spacing: -0.05em; text-transform: uppercase; }
        .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.9rem; border: none; }
        .skill-tag { background: transparent; border: 1px solid #000; color: #000; border-radius: 0; }
        .item-bullets li::before { background: #000; border-radius: 0; width: 3px; height: 3px; }
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume Preview - Waaw</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      padding: 2rem;
      margin: 0;
      line-height: 1.5;
    }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .header-section { text-align: center; margin-bottom: 3rem; }
    .name { font-size: 2.5rem; font-weight: 600; margin-bottom: 0.25rem; margin-top: 0; }
    .tagline { font-size: 1rem; margin-bottom: 0.5rem; margin-top: 0; }
    .contact { font-size: 0.9rem; margin: 0; }
    .section { margin-bottom: 2.5rem; }
    .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; margin-top: 0; }
    .subsection { margin-bottom: 1.5rem; }
    .item-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.15rem; }
    .item-subtitle { font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.8; }
    .item-bullets { margin: 0; padding: 0; list-style: none; }
    .item-bullets li { margin-bottom: 0.4rem; padding-left: 1.2rem; position: relative; font-size: 0.9rem; }
    .item-bullets li::before { content: ''; position: absolute; left: 0; top: 0.5rem; width: 4px; height: 4px; }
    .skills-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .skill-tag { padding: 0.25rem 0.75rem; font-size: 0.8rem; font-weight: 500; }
    ${themeCss}
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="header-section">
      <h1 class="name">${resumeData?.fullName || 'Your Name'}</h1>
      <p class="tagline">${resumeData?.summary ? 'Experienced Professional' : 'Resume generated with AI'}</p>
      <p class="contact">${resumeData?.contact?.email || 'email@example.com'}</p>
    </header>
    <div class="resume-content">
      <section class="section">
        <h2 class="section-title">Professional Summary</h2>
        <p style="font-size: 0.95rem;">${resumeData?.summary || 'Your professional summary will appear here.'}</p>
      </section>
      <section class="section">
        <h2 class="section-title">Professional Experience</h2>
        ${resumeData?.experience?.length ? resumeData.experience.map(exp => `
          <div class="subsection">
            <div class="item-title">${exp.company || 'Company Name'}</div>
            <div class="item-subtitle">${exp.role || 'Role'} • ${exp.duration || 'Duration'}</div>
            <ul class="item-bullets">
              ${(exp.bullets || []).map(bullet => `<li>${bullet}</li>`).join('')}
            </ul>
          </div>
        `).join('') : '<p style="font-size: 0.9rem; opacity: 0.7;">No experience listed.</p>'}
      </section>
      <section class="section">
        <h2 class="section-title">Education</h2>
        ${resumeData?.education?.length ? resumeData.education.map(edu => `
          <div class="subsection">
            <div class="item-title">${edu.institution || 'Institution'}</div>
            <div class="item-subtitle">${edu.degree || 'Degree'} • ${edu.year || ''}</div>
          </div>
        `).join('') : '<p style="font-size: 0.9rem; opacity: 0.7;">No education listed.</p>'}
      </section>
      <section class="section">
        <h2 class="section-title">Skills</h2>
        <div class="skills-list">
          ${resumeData?.skills?.length ? resumeData.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') : '<span class="skill-tag">No skills listed</span>'}
        </div>
      </section>
    </div>
  </div>
</body>
</html>`;
  };

  const regenerateSection = async (sectionName) => {
    if (!selectedResume) return;
    setIsRegeneratingSection(prev => ({ ...prev, [sectionName]: true }));
    
    try {
      const currentData = selectedResume[sectionName];
      const res = await fetch('/api/v1/resume/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionName, currentData })
      });

      if (!res.ok) throw new Error('Failed to regenerate section');
      
      const { newSectionData } = await res.json();
      const updatedResume = { ...selectedResume, [sectionName]: newSectionData };
      setSelectedResume(updatedResume);
      pushToHistory(updatedResume);
      showToast({ type: 'success', message: `${sectionName} regenerated!` });
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: err.message });
    } finally {
      setIsRegeneratingSection(prev => ({ ...prev, [sectionName]: false }));
    }
  };

  const analyzeAts = async () => {
    if (!selectedResume || !jobDescription.trim()) return;
    setIsAnalyzingAts(true);
    
    try {
      const res = await fetch('/api/v1/resume/ats-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: selectedResume, jobDescription: jobDescription.trim() })
      });

      if (!res.ok) throw new Error('Failed to analyze ATS score');
      
      const analysis = await res.json();
      setAtsResult(analysis);
      showToast({ type: 'success', message: 'ATS Analysis complete!' });
    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: err.message });
    } finally {
      setIsAnalyzingAts(false);
    }
  };

  const [isTailoring, setIsTailoring] = useState(false);

  const autoTailor = async () => {
    if (!selectedResume || !jobDescription.trim() || !atsResult) return;
    setIsTailoring(true);
    
    try {
      const res = await fetch('/api/v1/resume/auto-tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeData: selectedResume, 
          jobDescription: jobDescription.trim(),
          missingKeywords: atsResult.missingKeywords
        })
      });

      if (!res.ok) throw new Error('Failed to auto-tailor resume');
      
      const { tailoredResume } = await res.json();
      setSelectedResume(tailoredResume);
      pushToHistory(tailoredResume);
      showToast({ type: 'success', message: 'Resume auto-tailored successfully!' });
      
      // Re-run ATS match to show the new 95+ score
      setAtsResult(null); // Clear old result briefly
      setIsAnalyzingAts(true);
      const atsRes = await fetch('/api/v1/resume/ats-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: tailoredResume, jobDescription: jobDescription.trim() })
      });
      if (atsRes.ok) {
        setAtsResult(await atsRes.json());
      }
      setIsAnalyzingAts(false);

    } catch (err) {
      console.error(err);
      showToast({ type: 'error', message: err.message });
    } finally {
      setIsTailoring(false);
    }
  };

  const updateField = (field, value) => {
    const updated = { ...selectedResume, [field]: value };
    setSelectedResume(updated);
  };
  
  const updateNestedField = (parent, field, value) => {
    const updated = { ...selectedResume, [parent]: { ...selectedResume[parent], [field]: value } };
    setSelectedResume(updated);
  };

  const generateResume = useCallback(async (userPrompt) => {
    if (!userPrompt?.trim()) return;
    setIsGenerating(true);
    setPrompt(userPrompt.trim());

    try {
      const res = await fetch('/api/v1/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt.trim() })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Resume generation failed');
      }

      const data = await res.json();
      setSelectedResume(data);
      setHistory([JSON.parse(JSON.stringify(data))]);
      setHistoryIndex(0);
      
      // Auto-switch to preview mode
      setShowPreview(true);

      const previewHtml = generateResumePreviewHtml(data, selectedTemplate);
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

    } catch (err) {
      console.error('Resume generation error:', err);
      showToast({ type: 'error', message: `Resume generation failed: ${err.message}` });
    } finally {
      setIsGenerating(false);
    }
  }, [setSelectedResume, showToast, selectedTemplate]);

  // Autosave to localStorage
  useEffect(() => {
    if (selectedResume) {
      localStorage.setItem('waaw_autosave_resume', JSON.stringify(selectedResume));
    }
  }, [selectedResume]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!selectedResume) {
      try {
        const saved = localStorage.getItem('waaw_autosave_resume');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSelectedResume(parsed);
          setHistory([JSON.parse(saved)]);
          setHistoryIndex(0);
          setShowPreview(true);
        }
      } catch(e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#0a0b12] overflow-y-auto custom-scrollbar">
      <div className="relative w-full max-w-7xl mx-auto flex-1 flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(20,22,29,0.97)',
          border: '1px solid rgba(6,182,212,0.15)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.06)',
        }}
      >
          <div className="absolute top-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #f59e0b)' }} />

          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="text-2xl font-bold text-white"
              >
                Resume Builder
              </motion.h1>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors text-[#64748b] hover:text-white"
                aria-label="Close resume builder"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Undo/Redo Buttons */}
              <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-1">
                <button 
                  onClick={undo} disabled={historyIndex <= 0}
                  className="px-2 py-1 text-xs font-medium text-white disabled:opacity-30 hover:bg-white/10 rounded transition-colors"
                >↩ Undo</button>
                <div className="w-px h-4 bg-white/10 mx-1"></div>
                <button 
                  onClick={redo} disabled={historyIndex >= history.length - 1}
                  className="px-2 py-1 text-xs font-medium text-white disabled:opacity-30 hover:bg-white/10 rounded transition-colors"
                >↪ Redo</button>
              </div>

              <button
                onClick={() => generateResume(prompt)}
                disabled={isGenerating || !prompt?.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                  color: 'white',
                  border: 'none',
                  cursor: isGenerating || !prompt?.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || !prompt?.trim() ? 0.6 : 1,
                }}
                aria-label="Generate resume"
              >
                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                {!isGenerating && <Plus className="w-4 h-4" />}
                <span>{isGenerating ? 'Generating...' : 'New Resume'}</span>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 flex-1 flex flex-col min-h-0">
            {!isGenerating && (
              <div className="shrink-0">
                <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
                  Tell the AI what kind of resume you need
                </p>
                <textarea
                  placeholder="e.g. Create a resume for a React developer with 3 years experience"
                  rows={2}
                  className="w-full px-3.5 py-3 rounded-xl text-sm text-white placeholder-[#334155] focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    resize: 'none',
                  }}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      generateResume(e.target.value);
                    }
                  }}
                />
              </div>
            )}

            {showPreview && selectedResume && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-sm font-medium text-white">Preview Mode</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setPreviewMode('full')}
                      className={`text-xs transition-colors cursor-pointer ${previewMode === 'full' ? 'text-[#06b6d4]' : 'text-[#64748b] hover:text-white'}`}
                      title="Full preview"
                    >
                      ▄️
                    </button>
                    <button
                      onClick={() => setPreviewMode('split')}
                      className={`text-xs transition-colors cursor-pointer ${previewMode === 'split' ? 'text-[#06b6d4]' : 'text-[#64748b] hover:text-white'}`}
                      title="Split preview"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={() => setPreviewMode('preview')}
                      className={`text-xs transition-colors cursor-pointer ${previewMode === 'preview' ? 'text-[#06b6d4]' : 'text-[#64748b] hover:text-white'}`}
                      title="Compact preview"
                    >
                      👁️
                    </button>
                  </div>
                </div>
                {previewMode === 'split' && (
                  <div className="split-view flex gap-4 flex-1 min-h-[520px]">
                    <div className="panel flex-1 bg-[#0f111a] rounded-xl border border-white/10 p-4 overflow-y-auto custom-scrollbar">
                      {selectedResume && (
                        <div className="space-y-6 text-sm">
                          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4 relative">
                            <div className="flex gap-4">
                              <button 
                                onClick={() => setActiveTab('edit')} 
                                className={`font-semibold text-base pb-2 -mb-[11px] border-b-2 transition-colors ${activeTab === 'edit' ? 'text-white border-[#06b6d4]' : 'text-gray-400 border-transparent hover:text-gray-300'}`}
                              >Edit Details</button>
                              <button 
                                onClick={() => setActiveTab('ats')} 
                                className={`font-semibold text-base pb-2 -mb-[11px] border-b-2 transition-colors ${activeTab === 'ats' ? 'text-white border-[#06b6d4]' : 'text-gray-400 border-transparent hover:text-gray-300'}`}
                              >ATS Matcher ✨</button>
                            </div>
                            <select 
                              value={selectedTemplate}
                              onChange={e => setSelectedTemplate(e.target.value)}
                              className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                            >
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          {activeTab === 'edit' && (
                            <div className="space-y-6">
                              {/* Basic Info */}
                              <div className="space-y-3">
                                <h4 className="text-[#06b6d4] font-medium">Basic Info</h4>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Full Name</label>
                                  <input 
                                    type="text" 
                                    value={selectedResume.fullName || ''} 
                                    onChange={e => {
                                      updateField('fullName', e.target.value);
                                      pushToHistory({...selectedResume, fullName: e.target.value});
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#06b6d4]"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-400 block mb-1">Email</label>
                                  <input 
                                    type="email" 
                                    value={selectedResume.contact?.email || ''} 
                                    onChange={e => {
                                      updateNestedField('contact', 'email', e.target.value);
                                      const updated = {...selectedResume, contact: {...selectedResume.contact, email: e.target.value}};
                                      pushToHistory(updated);
                                    }}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#06b6d4]"
                                  />
                                </div>
                              </div>

                              {/* Summary */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[#06b6d4] font-medium">Professional Summary</h4>
                                  <button 
                                    onClick={() => regenerateSection('summary')}
                                    disabled={isRegeneratingSection['summary']}
                                    className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {isRegeneratingSection['summary'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨ AI Rewrite</span>}
                                  </button>
                                </div>
                                <textarea 
                                  rows={4}
                                  value={selectedResume.summary || ''} 
                                  onChange={e => {
                                    updateField('summary', e.target.value);
                                    pushToHistory({...selectedResume, summary: e.target.value});
                                  }}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#06b6d4] resize-none"
                                />
                              </div>

                              {/* Experience */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[#06b6d4] font-medium flex items-center gap-3">
                                    Experience
                                    <button 
                                      onClick={() => regenerateSection('experience')}
                                      disabled={isRegeneratingSection['experience']}
                                      className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isRegeneratingSection['experience'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨ AI Rewrite</span>}
                                    </button>
                                  </h4>
                                  <button 
                                    onClick={() => {
                                      const updated = {
                                        ...selectedResume, 
                                        experience: [...(selectedResume.experience || []), { company: '', role: '', duration: '', bullets: [''] }]
                                      };
                                      setSelectedResume(updated);
                                      pushToHistory(updated);
                                    }}
                                    className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
                                  >+ Add</button>
                                </div>
                                {(selectedResume.experience || []).map((exp, i) => (
                                  <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2 relative">
                                    <button 
                                      onClick={() => {
                                        const newExp = [...selectedResume.experience];
                                        newExp.splice(i, 1);
                                        const updated = {...selectedResume, experience: newExp};
                                        setSelectedResume(updated);
                                        pushToHistory(updated);
                                      }}
                                      className="absolute top-2 right-2 text-[#ef4444] hover:text-[#f87171]"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <input 
                                      type="text" placeholder="Company" 
                                      value={exp.company || ''} 
                                      onChange={e => {
                                        const newExp = [...selectedResume.experience];
                                        newExp[i].company = e.target.value;
                                        const updated = {...selectedResume, experience: newExp};
                                        setSelectedResume(updated);
                                        pushToHistory(updated);
                                      }}
                                      className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4]"
                                    />
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" placeholder="Role" 
                                        value={exp.role || ''} 
                                        onChange={e => {
                                          const newExp = [...selectedResume.experience];
                                          newExp[i].role = e.target.value;
                                          const updated = {...selectedResume, experience: newExp};
                                          setSelectedResume(updated);
                                          pushToHistory(updated);
                                        }}
                                        className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4] text-sm"
                                      />
                                      <input 
                                        type="text" placeholder="Duration" 
                                        value={exp.duration || ''} 
                                        onChange={e => {
                                          const newExp = [...selectedResume.experience];
                                          newExp[i].duration = e.target.value;
                                          const updated = {...selectedResume, experience: newExp};
                                          setSelectedResume(updated);
                                          pushToHistory(updated);
                                        }}
                                        className="w-1/3 bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4] text-sm text-right"
                                      />
                                    </div>
                                    <textarea 
                                      rows={3} placeholder="Bullets (one per line)"
                                      value={(exp.bullets || []).join('\n')} 
                                      onChange={e => {
                                        const newExp = [...selectedResume.experience];
                                        newExp[i].bullets = e.target.value.split('\n');
                                        const updated = {...selectedResume, experience: newExp};
                                        setSelectedResume(updated);
                                        pushToHistory(updated);
                                      }}
                                      className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-[#06b6d4] text-xs resize-none"
                                    />
                                  </div>
                                ))}
                              </div>

                              {/* Education */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[#06b6d4] font-medium flex items-center gap-3">
                                    Education
                                    <button 
                                      onClick={() => regenerateSection('education')}
                                      disabled={isRegeneratingSection['education']}
                                      className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isRegeneratingSection['education'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨ AI Rewrite</span>}
                                    </button>
                                  </h4>
                                  <button 
                                    onClick={() => {
                                      const updated = {
                                        ...selectedResume, 
                                        education: [...(selectedResume.education || []), { institution: '', degree: '', year: '' }]
                                      };
                                      setSelectedResume(updated);
                                      pushToHistory(updated);
                                    }}
                                    className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
                                  >+ Add</button>
                                </div>
                                {(selectedResume.education || []).map((edu, i) => (
                                  <div key={i} className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-2 relative">
                                    <button 
                                      onClick={() => {
                                        const newEdu = [...selectedResume.education];
                                        newEdu.splice(i, 1);
                                        const updated = {...selectedResume, education: newEdu};
                                        setSelectedResume(updated);
                                        pushToHistory(updated);
                                      }}
                                      className="absolute top-2 right-2 text-[#ef4444] hover:text-[#f87171]"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                    <input 
                                      type="text" placeholder="Institution" 
                                      value={edu.institution || ''} 
                                      onChange={e => {
                                        const newEdu = [...selectedResume.education];
                                        newEdu[i].institution = e.target.value;
                                        const updated = {...selectedResume, education: newEdu};
                                        setSelectedResume(updated);
                                        pushToHistory(updated);
                                      }}
                                      className="w-full bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4]"
                                    />
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" placeholder="Degree" 
                                        value={edu.degree || ''} 
                                        onChange={e => {
                                          const newEdu = [...selectedResume.education];
                                          newEdu[i].degree = e.target.value;
                                          const updated = {...selectedResume, education: newEdu};
                                          setSelectedResume(updated);
                                          pushToHistory(updated);
                                        }}
                                        className="flex-1 bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4] text-sm"
                                      />
                                      <input 
                                        type="text" placeholder="Year" 
                                        value={edu.year || ''} 
                                        onChange={e => {
                                          const newEdu = [...selectedResume.education];
                                          newEdu[i].year = e.target.value;
                                          const updated = {...selectedResume, education: newEdu};
                                          setSelectedResume(updated);
                                          pushToHistory(updated);
                                        }}
                                        className="w-1/3 bg-transparent border-b border-white/10 px-1 py-1 text-white focus:outline-none focus:border-[#06b6d4] text-sm text-right"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Skills */}
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[#06b6d4] font-medium">Skills (comma separated)</h4>
                                  <button 
                                    onClick={() => regenerateSection('skills')}
                                    disabled={isRegeneratingSection['skills']}
                                    className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/40 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {isRegeneratingSection['skills'] ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>✨ AI Rewrite</span>}
                                  </button>
                                </div>
                                <textarea 
                                  rows={2}
                                  value={(selectedResume.skills || []).join(', ')} 
                                  onChange={e => {
                                    const updated = {
                                      ...selectedResume, 
                                      skills: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                                    };
                                    setSelectedResume(updated);
                                    pushToHistory(updated);
                                  }}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#06b6d4] resize-none"
                                />
                              </div>
                            </div>
                          )}

                          {activeTab === 'ats' && (
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-sm text-gray-300 font-medium">Paste Job Description</label>
                                <textarea 
                                  rows={6}
                                  placeholder="Paste the target JD here to see how well your resume matches..."
                                  value={jobDescription}
                                  onChange={e => setJobDescription(e.target.value)}
                                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#06b6d4] resize-none custom-scrollbar"
                                />
                                <button
                                  onClick={analyzeAts}
                                  disabled={isAnalyzingAts || !jobDescription.trim()}
                                  className="w-full py-2.5 mt-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                  {isAnalyzingAts ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                                  {isAnalyzingAts ? 'Analyzing match...' : 'Analyze ATS Match'}
                                </button>
                              </div>

                              {atsResult && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-4"
                                >
                                  <div className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
                                    <div className="relative flex items-center justify-center w-16 h-16">
                                      <svg className="w-16 h-16 transform -rotate-90">
                                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-700" />
                                        <circle 
                                          cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" 
                                          className={atsResult.score >= 80 ? 'text-green-500' : atsResult.score >= 60 ? 'text-yellow-500' : 'text-red-500'}
                                          strokeDasharray={175} strokeDashoffset={175 - (175 * atsResult.score) / 100}
                                        />
                                      </svg>
                                      <span className="absolute text-xl font-bold text-white">{atsResult.score}</span>
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-semibold text-white">ATS Match Score</h3>
                                      <p className="text-xs text-gray-400">Target a score of 80+ for better chances.</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                      <h4 className="text-xs text-green-400 font-semibold mb-2">✅ Matching Keywords</h4>
                                      <div className="flex flex-wrap gap-1">
                                        {(atsResult.matchingKeywords || []).map((kw, i) => (
                                          <span key={i} className="text-[10px] bg-green-500/20 text-green-200 px-1.5 py-0.5 rounded">{kw}</span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                      <h4 className="text-xs text-red-400 font-semibold mb-2">⚠️ Missing Keywords</h4>
                                      <div className="flex flex-wrap gap-1">
                                        {(atsResult.missingKeywords || []).map((kw, i) => (
                                          <span key={i} className="text-[10px] bg-red-500/20 text-red-200 px-1.5 py-0.5 rounded">{kw}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <h4 className="text-xs text-blue-400 font-semibold mb-1">💡 Expert Feedback</h4>
                                    <p className="text-xs text-blue-100 leading-relaxed">{atsResult.feedback}</p>
                                  </div>

                                  {atsResult.missingKeywords && atsResult.missingKeywords.length > 0 && (
                                    <button
                                      onClick={autoTailor}
                                      disabled={isTailoring}
                                      className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 mt-4"
                                    >
                                      {isTailoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                      {isTailoring ? 'Tailoring Resume...' : '✨ Auto-Tailor Resume to JD'}
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="panel flex-1 resume-preview rounded-xl overflow-hidden bg-white">
                      {selectedResume && (
                        <iframe 
                          title="Resume Preview" 
                          srcDoc={generateResumePreviewHtml(selectedResume, selectedTemplate)} 
                          className="w-full h-full border-0"
                        />
                      )}
                    </div>
                  </div>
                )}
                {previewMode === 'full' && (
                  <div className="flex justify-center flex-1 min-h-[520px] bg-white rounded-xl overflow-hidden">
                    {selectedResume && (
                      <iframe 
                        title="Resume Preview Full" 
                        srcDoc={generateResumePreviewHtml(selectedResume, selectedTemplate)} 
                        className="w-full h-full border-0 max-w-4xl shadow-2xl"
                      />
                    )}
                  </div>
                )}
                {previewMode === 'preview' && (
                  <div className="flex justify-center flex-1 min-h-[520px]">
                    <div className="panel w-2/3 max-w-xl bg-white rounded-xl overflow-hidden shadow-2xl">
                      {selectedResume && (
                        <iframe 
                          title="Resume Preview Compact" 
                          srcDoc={generateResumePreviewHtml(selectedResume, selectedTemplate)} 
                          className="w-full h-full border-0"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedResume && !showPreview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex-1 min-h-[520px] bg-white rounded-xl overflow-hidden shadow-2xl"
              >
                <iframe 
                  title="Resume Preview Inline" 
                  srcDoc={generateResumePreviewHtml(selectedResume, selectedTemplate)} 
                  className="w-full h-full border-0"
                />
              </motion.div>
            )}

            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center text-sm text-cyan-400"
              >
                Generating your resume... <span className="text-[11px] font-medium">This may take a moment</span>
              </motion.div>
            )}

            {!selectedResume && !isGenerating && prompt?.trim() && !showPreview && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm text-[#475569]"
              >
                Enter a prompt above and click Generate to create your resume preview
              </motion.div>
            )}
          </div>

          <div className="p-6 border-t border-white/5 flex justify-between items-center">
            <button
              onClick={onClose}
              className="text-sm text-[#64748b] hover:text-white transition-colors"
              aria-label="Close resume builder"
            >
              Cancel
            </button>
            {selectedResume && downloadUrl && (
              <button
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = downloadUrl;
                  a.click();
                  URL.revokeObjectUrl(downloadUrl);
                }}
                className="text-sm font-medium text-cyan-400 hover:underline"
                aria-label="Download resume"
              >
                Download
              </button>
            )}
          </div>
      </div>
    </div>
  );
};