import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle, Copy, Download, X, Loader2, Plus } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ResumeBuilder = ({
  isOpen,
  onClose,
  onGenerateResume,
  selectedResume,
  setSelectedResume,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const templates = [
    { id: 'professional', label: 'Professional', description: 'Clean corporate style with section dividers' },
    { id: 'creative', label: 'Creative', description: 'Modern layout with accent colors and typography' },
    { id: 'minimal', label: 'Minimal', description: 'Simple black & white layout, text-first' },
  ];

  const generateResumePreviewHtml = (resumeData) => {
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric' }) : 'N/A';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume Preview - Waaw</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body {
      font-family: 'Inter', sans-serif;
      background: #0a0a0f;
      color: #f8fafc;
      min-height: 100vh;
      padding: 2rem;
    }
    .resume-container { max-width: 800px; margin: 0 auto; padding: 3rem 2rem; }
    @media (max-width: 640px) { .resume-container { padding: 1.5rem 1rem; } }
    .header-section { text-align: center; padding-bottom: 3rem; border-bottom: 1px solid #31363f; margin-bottom: 3rem; }
    .name { font-size: 2.5rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    .tagline { color: #64748b; font-size: 1rem; margin-bottom: 1rem; }
    .contact { color: #06b6d4; font-size: 0.9rem; }
    .section { margin-bottom: 3rem; }
    .section-title { font-size: 1.1rem; font-weight: 600; letter-spacing: 0.05em; color: #06b6d4; margin-bottom: 1rem; border-bottom: 1px solid #31363f; }
    .subsection { margin-bottom: 1.5rem; }
    .item-title { font-weight: 500; font-size: 0.95rem; margin-bottom: 0.25rem; }
    .item-subtitle { color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .item-bullets { color: #f8fafc; }
    .item-bullets li { margin-bottom: 0.5rem; padding-left: 1.2rem; position: relative; }
    .item-bullets li::before { content: ''; position: absolute; left: 0; width: 4px; height: 4px; border-radius: 50%; background: #06b6d4; }
    .skills-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .skill-tag { background: #1a202c; border: 1px solid #31363f; color: #f8fafc; padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 500; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="header-section">
      <h1 class="name">${resumeData?.fullName || 'Your Name'}</h1>
      <p class="tagline">Resume generated with Waaw AI</p>
      <p class="contact">${resumeData?.contact?.email || 'email@example.com'}</p>
    </header>
    <section class="section">
      <h2 class="section-title">Professional Summary</h2>
      <p>${resumeData?.summary || 'Your professional summary will appear here.'}</p>
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
      `).join('') : '<p>No experience listed.</p>'}
    </section>
    <section class="section">
      <h2 class="section-title">Education</h2>
      ${resumeData?.education?.length ? resumeData.education.map(edu => `
        <div class="subsection">
          <div class="item-title">${edu.institution || 'Institution'}</div>
          <div class="item-subtitle">${edu.degree || 'Degree'} • ${formatDate(edu.year)}</div>
        </div>
      `).join('') : '<p>No education listed.</p>'}
    </section>
    <section class="section">
      <h2 class="section-title">Skills</h2>
      <div class="skills-list">
        ${resumeData?.skills?.length ? resumeData.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('') : '<span class="skill-tag">No skills listed</span>'}
      </div>
    </section>
  </div>
</body>
</html>`;
  };

  const generateResume = useCallback(async (userPrompt) => {
    if (!userPrompt?.trim()) return;
    setIsGenerating(true);
    setPrompt(userPrompt.trim());

    try {
      const res = await fetch('/api/resume/generate', {
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
      setIsDownloading(true);

      const previewHtml = generateResumePreviewHtml(data);
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume-${new Date().toISOString().slice(0,10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
        setIsDownloading(false);
      }, 1000);

    } catch (err) {
      console.error('Resume generation error:', err);
      showToast({ type: 'error', message: `Resume generation failed: ${err.message}` });
    } finally {
      setIsGenerating(false);
    }
  }, [setSelectedResume]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.95 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-builder-title"
      >
        <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(10,11,18,0.97)',
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

            <button
              onClick={() => generateResume(prompt)}
              disabled={isGenerating || !prompt?.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
                color: 'white',
                border: 'none',
                marginRight: 'auto',
                cursor: isGenerating || !prompt?.trim() ? 'not-allowed' : 'pointer',
                opacity: isGenerating || !prompt?.trim() ? 0.6 : 1,
              }}
              aria-label="Generate resume"
            >
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
              {!isGenerating && <Plus className="w-4 h-4" />}
              <span>{isGenerating ? 'Generating...' : 'Generate Resume'}</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {isOpen && !isGenerating && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
                  Tell the AI what kind of resume you need
                </p>
                <textarea
                  placeholder="e.g. Create a resume for a React developer with 3 years experience"
                  rows={3}
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
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Preview Mode</span>
                  <button
                    onClick={() => setPreviewMode('full')}
                    className="text-xs text-[#64748b] hover:text-primary transition-colors cursor-pointer"
                    title="Full preview"
                  >
                    ▄️
                  </button>
                  <button
                    onClick={() => setPreviewMode('split')}
                    className="text-xs text-[#64748b] hover:text-primary transition-colors cursor-pointer"
                    title="Split preview"
                  >
                    ⧉
                  </button>
                  <button
                    onClick={() => setPreviewMode('preview')}
                    className="text-xs text-[#64748b] hover:text-primary transition-colors cursor-pointer"
                    title="Compact preview"
                  >
                    👁️
                  </button>
                </div>
                {previewMode === 'split' && (
                  <div className="split-view">
                    <div className="panel panel-header">
                      <span className="panel-title">Resume Preview</span>
                      <button className="panel-close" onClick={() => setShowPreview(false)}>&times;</button>
                    </div>
                    <div className="panel code-editor">
                      {selectedResume && (
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generateResumePreviewHtml(selectedResume)) }} />
                      )}
                    </div>
                    <div className="panel resume-preview">
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generateResumePreviewHtml(selectedResume)) }} />
                    </div>
                  </div>
                )}
                {previewMode === 'full' && (
                  <div className="flex justify-center">
                    <div className="panel code-editor w-full max-w-2xl">
                      {selectedResume && (
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generateResumePreviewHtml(selectedResume)) }} />
                      )}
                    </div>
                  </div>
                )}
                {previewMode === 'preview' && (
                  <div className="flex justify-center">
                    <div className="panel w-2/3 max-w-xl">
                      {selectedResume && (
                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(generateResumePreviewHtml(selectedResume)) }} />
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
              >
                <div
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(generateResumePreviewHtml(selectedResume)) }}
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
      </motion.div>
    </AnimatePresence>
  );
};

export default ResumeBuilder;