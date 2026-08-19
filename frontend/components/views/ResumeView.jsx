import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Sparkles, X, LayoutTemplate, RefreshCw, CheckCircle2 } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import api from '../../services/api';

const TEMPLATES = {
  professional: {
    label: 'Professional',
    colors: { header: '#1c2030', accent: '#4b8bfc', bg: '#ffffff', text: '#1a1d26', muted: '#5a6273' },
  },
  modern: {
    label: 'Modern',
    colors: { header: '#a142f4', accent: '#18c2a8', bg: '#f8f9fc', text: '#151922', muted: '#5f6679' },
  },
  creative: {
    label: 'Creative',
    colors: { header: '#4b8bfc', accent: '#ff8a65', bg: '#0f1117', text: '#f4f6fb', muted: '#8b92a7' },
  },
};

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildResumeHtml(data, templateKey) {
  const t = TEMPLATES[templateKey] || TEMPLATES.professional;
  const c = t.colors;
  const exp = (data.experience || []).map(e => `
    <div class="item">
      <div class="item-head"><span class="item-title">${escapeHtml(e.role || 'Role')}</span><span class="item-sub">${escapeHtml(e.duration || '')}</span></div>
      <div class="item-company">${escapeHtml(e.company || 'Company')}</div>
      ${(e.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
    </div>`).join('');
  const edu = (data.education || []).map(e => `
    <div class="item">
      <div class="item-head"><span class="item-title">${escapeHtml(e.degree || 'Degree')}</span><span class="item-sub">${escapeHtml(e.year || '')}</span></div>
      <div class="item-company">${escapeHtml(e.institution || 'Institution')}</div>
    </div>`).join('');
  const projects = (data.projects || []).map(p => `
    <div class="item">
      <div class="item-head"><span class="item-title">${escapeHtml(p.name || 'Project')}</span></div>
      <div class="item-company" style="font-weight:400;">${escapeHtml(p.description || '')}</div>
    </div>`).join('');
  const certs = (data.certifications || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');
  const skills = (data.skills || []).map(s => `<span class="skill">${escapeHtml(s)}</span>`).join('');
  return `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: ${c.bg}; color: ${c.text}; padding: 32px; }
  .header { padding: 28px; border-radius: 14px; background: ${c.header}; color: #fff; margin-bottom: 24px;
    background: linear-gradient(135deg, ${c.header}, ${c.accent}); }
  .name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .contact { font-size: 12px; opacity: 0.85; margin-top: 6px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;
    color: ${c.accent}; border-bottom: 2px solid ${c.accent}; padding-bottom: 6px; margin-bottom: 12px; }
  .summary { font-size: 13px; line-height: 1.6; color: ${c.muted}; }
  .item { margin-bottom: 12px; }
  .item-head { display: flex; justify-content: space-between; align-items: baseline; }
  .item-title { font-size: 14px; font-weight: 700; }
  .item-sub { font-size: 11px; color: ${c.muted}; }
  .item-company { font-size: 12px; color: ${c.accent}; font-weight: 600; margin: 2px 0 4px; }
  .item li { font-size: 12px; color: ${c.muted}; margin-left: 16px; line-height: 1.5; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill { font-size: 11px; padding: 4px 10px; border-radius: 20px; background: ${c.accent}18; color: ${c.accent}; font-weight: 600; }
</style></head><body>
  <div class="header">
    <div class="name">${escapeHtml(data.fullName || 'Your Name')}</div>
    <div class="contact">${escapeHtml((data.contact && (data.contact.email + (data.contact.phone ? ' • ' + data.contact.phone : ''))) || 'email • phone')}</div>
  </div>
  <div class="section"><div class="section-title">Professional Summary</div>
    <div class="summary">${escapeHtml(data.summary || '')}</div></div>
  <div class="section"><div class="section-title">Experience</div>${exp || '<div class="summary">No experience added.</div>'}</div>
  <div class="section"><div class="section-title">Projects</div>${projects || '<div class="summary">No projects added.</div>'}</div>
  <div class="section"><div class="section-title">Education</div>${edu || '<div class="summary">No education added.</div>'}</div>
  <div class="section"><div class="section-title">Skills</div><div class="skills">${skills || '—'}</div></div>
  ${certs ? `<div class="section"><div class="section-title">Certifications</div><ul class="item">${certs}</ul></div>` : ''}
</body></html>`;
}

const renderMarkdown = (html) => DOMPurify.sanitize(html);

export default function ResumeView({
  onClose,
  initialResume = null,
  onToast,
}) {
  const [prompt, setPrompt] = useState('');
  const [data, setData] = useState(initialResume);
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState('professional');
  const [previewHtml, setPreviewHtml] = useState(null);

  const showToast = useMemo(() => onToast || ((m, t) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } })); }), [onToast]);

  const generate = useCallback(async (text) => {
    const p = (text || prompt).trim();
    if (!p || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/resume/generate', { prompt: p });
      if (res.data && !res.data.error) {
        setData(res.data);
        setPreviewHtml(buildResumeHtml(res.data, template));
        showToast('Resume generated successfully!', 'success');
      } else {
        showToast(res.data?.error || 'Generation failed', 'error');
      }
    } catch (e) {
      showToast(e?.message || 'Network error', 'error');
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, template, showToast]);

  const switchTemplate = (key) => {
    setTemplate(key);
    if (data) setPreviewHtml(buildResumeHtml(data, key));
  };

  const downloadPdf = () => {
    if (!previewHtml) return;
    const win = window.open('', '_blank');
    win.document.write(previewHtml);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8" style={{ background: 'rgba(5,6,10,0.8)', backdropFilter: 'blur(14px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--color-bg-default)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 14px var(--color-primary-glow)' }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-white">Resume Builder</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">AI se prompt me generate karo — live preview side me</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: generator */}
          <div className="w-[360px] shrink-0 flex flex-col p-5 space-y-4 overflow-y-auto" style={{ borderRight: '1px solid var(--color-border)' }}>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                Aapka prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="e.g. Full stack developer resume — 3 saal React/Node experience, Python skills, IIT graduate..."
                className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <button
              onClick={() => generate()}
              disabled={loading || !prompt.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: 'var(--gradient-primary)', color: '#fff', boxShadow: '0 4px 18px var(--color-primary-glow)' }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Generating...' : 'Generate Resume'}
            </button>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
                Template
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TEMPLATES).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => switchTemplate(key)}
                    className="py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
                    style={{
                      background: template === key ? 'rgba(75,139,252,0.12)' : 'rgba(255,255,255,0.03)',
                      border: template === key ? '1px solid rgba(75,139,252,0.4)' : '1px solid var(--color-border)',
                      color: template === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {data && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#34d399' }}>
                  <CheckCircle2 className="w-4 h-4" /> Resume ready!
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {data.fullName} • {data.skills?.length || 0} skills • {data.experience?.length || 0} jobs
                </p>
              </div>
            )}

            <button
              onClick={downloadPdf}
              disabled={!previewHtml}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <Download className="w-4 h-4" /> Download / Print PDF
            </button>

            <div className="flex items-center gap-2 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(161,66,244,0.06)', border: '1px solid rgba(161,66,244,0.2)', color: 'var(--color-text-muted)' }}>
              <LayoutTemplate className="w-3.5 h-3.5 shrink-0 text-[var(--color-secondary)]" />
              Tip: Chat me &quot;resume bana do&quot; bolo — AI-Dost khud generate karke side preview khol dega.
            </div>
          </div>

          {/* Right: live preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#14161d]">
            {previewHtml ? (
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(previewHtml) }} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(75,139,252,0.1)', border: '1px solid rgba(75,139,252,0.25)' }}>
                    <FileText className="w-8 h-8 text-[var(--color-primary)]" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">Live Preview yahan dikhega</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Prompt likho aur Generate dabao — ya chat me &quot;resume bana do&quot; bolo. AI-Dost data extract karke professional resume banayega.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}