import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileText, Download, Copy, Undo2, Redo2, Eye, EyeOff,
  Sparkles, Check, Plus, Trash2, ChevronRight, X, Printer,
  Briefcase, GraduationCap, Award, User, RefreshCw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

const DEFAULT_RESUME = {
  fullName: 'Alex Morgan',
  title: 'Full Stack Engineer & AI Systems Architect',
  contact: {
    email: 'alex.morgan@example.com',
    phone: '+1 (555) 019-2834',
    location: 'San Francisco, CA',
    website: 'github.com/alexmorgan',
  },
  summary: 'Full-stack developer with 6+ years of experience engineering high-concurrency microservices, autonomous agent runtimes, and verified web architectures.',
  experience: [
    {
      company: 'Antigravity Labs',
      role: 'Staff Software Engineer',
      duration: '2024 - Present',
      bullets: [
        'Architected autonomous agent orchestration pipeline with deterministic rollback capabilities.',
        'Engineered SQLite universal state layer reducing query latencies by 42%.',
      ],
    },
    {
      company: 'Nexus Cloud Systems',
      role: 'Senior Frontend Engineer',
      duration: '2021 - 2024',
      bullets: [
        'Built real-time collaborative code editor with Monaco and WebContainers.',
        'Designed high-density developer design system adopted by 12+ internal products.',
      ],
    },
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'B.S. in Computer Science',
      year: '2017 - 2021',
    },
  ],
  skills: [
    'TypeScript', 'React', 'Node.js', 'Python', 'SQLite', 'Docker',
    'Tailwind CSS', 'Agent Orchestration', 'Distributed Systems'
  ],
};

const TEMPLATES = [
  { id: 'professional', label: 'Editorial Classic', desc: 'Serif headings, high-density print grid' },
  { id: 'modern', label: 'Technical Modern', desc: 'Monospace metadata, clean divider rules' },
  { id: 'minimal', label: 'Minimalist Clean', desc: 'Pure black & paper typography' },
];

export default function ResumeView({ onToast, onClose }) {
  const [resumeData, setResumeData] = useState(DEFAULT_RESUME);
  const [activeSection, setActiveSection] = useState('profile');
  const [selectedTemplate, setSelectedTemplate] = useState('professional');
  const [showPreview, setShowPreview] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [downloadUrl, setDownloadUrl] = useState(null);

  // Undo / Redo
  const [history, setHistory] = useState([DEFAULT_RESUME]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((newData) => {
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.parse(JSON.stringify(newData)));
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setResumeData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setResumeData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // Load / Save
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai_dost_saved_resume');
      if (saved) {
        const parsed = JSON.parse(saved);
        setResumeData(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      }
    } catch (_) {}
  }, []);

  const saveResume = () => {
    localStorage.setItem('ai_dost_saved_resume', JSON.stringify(resumeData));
    if (onToast) onToast('Resume saved locally', 'success');
  };

  const updateField = (field, value) => {
    const updated = { ...resumeData, [field]: value };
    setResumeData(updated);
    pushHistory(updated);
  };

  const updateContact = (field, value) => {
    const updated = {
      ...resumeData,
      contact: { ...resumeData.contact, [field]: value },
    };
    setResumeData(updated);
    pushHistory(updated);
  };

  const addExperience = () => {
    const updated = {
      ...resumeData,
      experience: [
        ...resumeData.experience,
        { company: 'New Organization', role: 'Role Title', duration: '2024 - Present', bullets: ['Key accomplishment'] },
      ],
    };
    setResumeData(updated);
    pushHistory(updated);
  };

  const removeExperience = (idx) => {
    const updated = {
      ...resumeData,
      experience: resumeData.experience.filter((_, i) => i !== idx),
    };
    setResumeData(updated);
    pushHistory(updated);
  };

  const addSkill = (skill) => {
    if (!skill.trim() || resumeData.skills.includes(skill.trim())) return;
    const updated = {
      ...resumeData,
      skills: [...resumeData.skills, skill.trim()],
    };
    setResumeData(updated);
    pushHistory(updated);
  };

  const removeSkill = (skill) => {
    const updated = {
      ...resumeData,
      skills: resumeData.skills.filter((s) => s !== skill),
    };
    setResumeData(updated);
    pushHistory(updated);
  };

  // Export HTML document & Archive to Artifact Shelf
  const exportDocument = useCallback(() => {
    const docHtml = generatePreviewHtml(resumeData, selectedTemplate);
    const blob = new Blob([docHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    // Save into Document Shelf
    try {
      const now = Date.now();
      const stored = localStorage.getItem('ai_dost_generated_artifacts');
      const list = stored ? JSON.parse(stored) : [];
      const newArtifact = {
        id: `resume_${now}`,
        title: `${resumeData.fullName || 'Resume'} - CV.html`,
        type: 'HTML',
        url: url,
        created_at: now,
      };
      localStorage.setItem('ai_dost_generated_artifacts', JSON.stringify([newArtifact, ...list]));
    } catch (_) {}

    const a = document.createElement('a');
    a.href = url;
    a.download = `${(resumeData.fullName || 'Resume').replace(/\s+/g, '_')}_CV.html`;
    a.click();

    if (onToast) onToast('Resume exported & archived to Artifact Shelf', 'success');
  }, [resumeData, selectedTemplate, onToast]);

  const generatePreviewHtml = (data, tpl) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${data.fullName || 'Resume'} - Curriculum Vitae</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #11100f; line-height: 1.45; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin: 0 0 0.25rem 0; color: #11100f; }
    .title { font-size: 1rem; color: #d45b3f; font-weight: 500; margin-bottom: 0.5rem; }
    .contact { font-size: 0.8rem; color: #57534e; margin-bottom: 1.5rem; border-bottom: 1px solid #e7e5e4; padding-bottom: 0.75rem; font-family: monospace; }
    .section-title { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #11100f; border-bottom: 1px solid #11100f; padding-bottom: 0.25rem; margin: 1.25rem 0 0.75rem 0; }
    .item-header { display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; }
    .item-sub { font-size: 0.8rem; color: #78716c; margin-bottom: 0.35rem; }
    ul { margin: 0 0 0.75rem 1.25rem; padding: 0; font-size: 0.85rem; }
    li { margin-bottom: 0.25rem; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .skill-badge { font-size: 0.75rem; background: #f5f5f4; border: 1px solid #e7e5e4; padding: 0.15rem 0.5rem; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>${data.fullName}</h1>
  <div class="title">${data.title}</div>
  <div class="contact">${data.contact.email} • ${data.contact.phone} • ${data.contact.location} • ${data.contact.website}</div>

  <div class="section-title">Professional Summary</div>
  <p style="font-size: 0.85rem; margin: 0 0 1rem 0;">${data.summary}</p>

  <div class="section-title">Experience</div>
  ${data.experience.map((exp) => `
    <div style="margin-bottom: 0.75rem;">
      <div class="item-header"><span>${exp.company}</span><span>${exp.duration}</span></div>
      <div class="item-sub">${exp.role}</div>
      <ul>
        ${(exp.bullets || []).map((b) => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  `).join('')}

  <div class="section-title">Education</div>
  ${data.education.map((edu) => `
    <div style="margin-bottom: 0.5rem;">
      <div class="item-header"><span>${edu.institution}</span><span>${edu.year}</span></div>
      <div class="item-sub">${edu.degree}</div>
    </div>
  `).join('')}

  <div class="section-title">Skills & Technologies</div>
  <div class="skills-grid">
    ${data.skills.map((s) => `<span class="skill-badge">${s}</span>`).join('')}
  </div>
</body>
</html>`;
  };

  return (
    <div className="h-full flex flex-col bg-canvas-base select-none overflow-hidden">
      {/* Editorial Header Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-canvas-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-accent-primary" />
          <div>
            <h1 className="text-sm font-semibold text-paper-100 font-display">
              Resume & CV Editor
            </h1>
            <span className="text-[10px] font-mono text-ink-muted">
              {resumeData.fullName} — {selectedTemplate}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-xs text-ink-muted hover:text-paper-100 disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-xs text-ink-muted hover:text-paper-100 disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Template Selector */}
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-2 py-1 rounded-xs bg-canvas-surface border border-border text-paper-100 text-xs font-sans focus:outline-none"
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            icon={showPreview ? EyeOff : Eye}
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Download}
            onClick={exportDocument}
          >
            Export Document
          </Button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xs text-ink-muted hover:text-paper-100 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Split */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Section Navigation Rail */}
        <div className="w-48 border-r border-border bg-canvas-subtle p-3 space-y-1 flex-shrink-0 hidden md:block">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted px-2 py-1">
            Sections
          </div>
          {[
            { id: 'profile', label: 'Profile & Contact', icon: User },
            { id: 'summary', label: 'Summary', icon: FileText },
            { id: 'experience', label: 'Experience', icon: Briefcase },
            { id: 'education', label: 'Education', icon: GraduationCap },
            { id: 'skills', label: 'Skills', icon: Award },
          ].map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xs text-xs font-medium transition-fast cursor-pointer text-left ${
                  isActive
                    ? 'bg-canvas-elevated text-paper-100 border-l-2 border-accent-primary'
                    : 'text-paper-200 hover:text-paper-100 hover:bg-canvas-surface'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent-primary' : 'text-ink-muted'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Structured Document Editor Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-canvas-base">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Section 1: Profile & Contact */}
            {activeSection === 'profile' && (
              <div className="space-y-4 rounded-sm border border-border bg-canvas-surface p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-paper-100 font-display border-b border-border-subtle pb-2">
                  Profile & Contact Information
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-paper-200 mb-1">Full Name</label>
                    <input
                      value={resumeData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-sans focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-paper-200 mb-1">Headline / Role</label>
                    <input
                      value={resumeData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-sans focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-paper-200 mb-1">Email</label>
                    <input
                      value={resumeData.contact.email}
                      onChange={(e) => updateContact('email', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-paper-200 mb-1">Phone</label>
                    <input
                      value={resumeData.contact.phone}
                      onChange={(e) => updateContact('phone', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-mono focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Summary */}
            {activeSection === 'summary' && (
              <div className="space-y-4 rounded-sm border border-border bg-canvas-surface p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-paper-100 font-display border-b border-border-subtle pb-2">
                  Professional Summary
                </h2>
                <textarea
                  rows={5}
                  value={resumeData.summary}
                  onChange={(e) => updateField('summary', e.target.value)}
                  className="w-full px-3 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 text-xs font-sans leading-relaxed focus:outline-none focus:border-accent-primary"
                />
              </div>
            )}

            {/* Section 3: Experience */}
            {activeSection === 'experience' && (
              <div className="space-y-4 rounded-sm border border-border bg-canvas-surface p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                  <h2 className="text-sm font-semibold text-paper-100 font-display">
                    Professional Experience
                  </h2>
                  <Button variant="secondary" size="sm" icon={Plus} onClick={addExperience}>
                    Add Role
                  </Button>
                </div>

                <div className="space-y-4">
                  {resumeData.experience.map((exp, idx) => (
                    <div key={idx} className="p-3 rounded-xs border border-border bg-canvas-base space-y-2">
                      <div className="flex items-center justify-between">
                        <input
                          value={exp.company}
                          onChange={(e) => {
                            const next = [...resumeData.experience];
                            next[idx].company = e.target.value;
                            updateField('experience', next);
                          }}
                          className="font-medium text-xs text-paper-100 bg-transparent border-b border-transparent hover:border-border focus:border-accent-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          className="text-ink-muted hover:text-signal-error p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <input
                          value={exp.role}
                          onChange={(e) => {
                            const next = [...resumeData.experience];
                            next[idx].role = e.target.value;
                            updateField('experience', next);
                          }}
                          placeholder="Role Title"
                          className="px-2 py-1 rounded-xs bg-canvas-surface border border-border text-paper-100 text-xs"
                        />
                        <input
                          value={exp.duration}
                          onChange={(e) => {
                            const next = [...resumeData.experience];
                            next[idx].duration = e.target.value;
                            updateField('experience', next);
                          }}
                          placeholder="e.g. 2022 - Present"
                          className="px-2 py-1 rounded-xs bg-canvas-surface border border-border text-paper-100 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Skills */}
            {activeSection === 'skills' && (
              <div className="space-y-4 rounded-sm border border-border bg-canvas-surface p-5 shadow-xs">
                <h2 className="text-sm font-semibold text-paper-100 font-display border-b border-border-subtle pb-2">
                  Skills & Technologies
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {resumeData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xs bg-canvas-base border border-border text-xs text-paper-100 font-mono"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="text-ink-muted hover:text-signal-error"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Print-Like Live Document Preview */}
        {showPreview && (
          <div className="w-96 lg:w-[480px] border-l border-border bg-[#181614] p-4 flex flex-col flex-shrink-0 hidden sm:flex overflow-y-auto">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-2 flex items-center justify-between">
              <span>Paper Preview</span>
              <span>100% Scale</span>
            </div>

            <div className="flex-1 bg-white text-[#11100f] rounded-xs shadow-md p-6 font-sans text-xs overflow-y-auto leading-relaxed select-text">
              <h2 className="text-lg font-bold text-[#11100f] mb-0.5">{resumeData.fullName}</h2>
              <div className="text-xs text-[#d45b3f] font-medium mb-1">{resumeData.title}</div>
              <div className="text-[10px] font-mono text-[#57534e] pb-2 mb-3 border-b border-neutral-200">
                {resumeData.contact.email} • {resumeData.contact.phone} • {resumeData.contact.location}
              </div>

              <div className="font-bold uppercase text-[10px] tracking-wider border-b border-neutral-300 pb-0.5 mb-1.5">
                Summary
              </div>
              <p className="text-[11px] text-neutral-700 mb-3">{resumeData.summary}</p>

              <div className="font-bold uppercase text-[10px] tracking-wider border-b border-neutral-300 pb-0.5 mb-1.5">
                Experience
              </div>
              {resumeData.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between font-semibold text-[11px]">
                    <span>{exp.company}</span>
                    <span className="text-[10px] text-neutral-500">{exp.duration}</span>
                  </div>
                  <div className="text-[10px] text-neutral-600 italic mb-1">{exp.role}</div>
                  <ul className="list-disc list-inside text-[10px] text-neutral-700 pl-1 space-y-0.5">
                    {(exp.bullets || []).map((b, bi) => (
                      <li key={bi}>{b}</li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="font-bold uppercase text-[10px] tracking-wider border-b border-neutral-300 pb-0.5 mb-1.5">
                Skills
              </div>
              <div className="flex flex-wrap gap-1">
                {resumeData.skills.map((s) => (
                  <span key={s} className="text-[9px] bg-neutral-100 border border-neutral-300 px-1 py-0.5 rounded-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}