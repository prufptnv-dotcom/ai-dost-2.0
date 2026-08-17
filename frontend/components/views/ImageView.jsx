import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Wand2, Download, Loader2, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { ImageLightbox, SmartImg } from './ImageLightbox';

const HISTORY_KEY = 'ai_dost_images_history';

const STYLES = [
  { id: 'default', label: 'Default', suffix: '' },
  { id: 'photo', label: 'Realistic photo', suffix: ', photorealistic, 8k, sharp focus, professional photography' },
  { id: '3d', label: '3D render', suffix: ', 3d render, octane render, cinematic lighting' },
  { id: 'anime', label: 'Anime', suffix: ', anime style, studio ghibli inspired, vibrant colors' },
  { id: 'pixel', label: 'Pixel art', suffix: ', pixel art, 16-bit, retro game style' },
  { id: 'oil', label: 'Oil painting', suffix: ', oil painting, renaissance style, textured brushstrokes' },
];

const SEED_VARIANTS = 2;

export default function ImageView({ onToast }) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [images, setImages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const scrollRef = useRef(null);

  const showToast = onToast || ((m, t) => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
  });

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) { /* noop */ }
  }, []);

  const saveHistory = (entries) => {
    setHistory((prev) => {
      const next = [...entries, ...prev].slice(0, 8);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const generate = async (text) => {
    const base = (text || prompt).trim();
    if (!base || loading) return;
    setLoading(true);
    setProgress(0);
    const fullPrompt = base + style.suffix;
    const newImages = [];
    try {
      for (let i = 0; i < SEED_VARIANTS; i++) {
        const res = await api.post('/image/generate', { prompt: fullPrompt });
        const url = res.data?.imageUrl;
        if (url) newImages.push({ url, prompt: base, style: style.id, seed: Date.now() + i });
        setProgress(Math.round(((i + 1) / SEED_VARIANTS) * 100));
      }
      if (newImages.length === 0) throw new Error('No images returned');
      setImages(newImages);
      saveHistory(newImages);
      showToast(`${newImages.length} images generated`, 'success');
    } catch (e) {
      showToast(`Image generate failed: ${e?.message || 'API error'}`, 'error');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [images]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Image Generator</h1>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Pollinations AI — 100% free, unlimited</p>
          </div>
          {history.length > 0 && (
            <button onClick={clearHistory} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] cursor-pointer" style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              <Trash2 className="w-3.5 h-3.5" /> History clear
            </button>
          )}
        </div>

        {/* Style chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all cursor-pointer"
              style={{
                background: style.id === s.id ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.04)',
                border: '1px solid ' + (style.id === s.id ? 'transparent' : 'var(--color-border)'),
                color: style.id === s.id ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl p-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          <Wand2 className="w-4 h-4 ml-1 shrink-0" style={{ color: 'var(--color-primary)' }} />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
            placeholder="Kya banana hai? e.g. 'a robot in a futuristic city, neon lights'"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <button
            onClick={() => generate()}
            disabled={!prompt.trim() || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
        </div>
        {loading && (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--gradient-primary)' }} />
            </div>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{progress}% — {SEED_VARIANTS} variants</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          {images.length === 0 && history.length === 0 && !loading && (
            <div className="text-center pt-16">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(161,66,244,0.1)' }}>
                <ImageIcon className="w-8 h-8" style={{ color: 'var(--color-secondary)' }} />
              </div>
              <h2 className="mt-4 text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Kuch bhi banao — free me</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Logo, wallpapers, anime characters, product mockups — prompt likho aur Generate dabao.
              </p>
            </div>
          )}

          {loading && images.length === 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-[3/2] rounded-2xl skeleton" />
              ))}
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={img.seed} className="group relative rounded-2xl overflow-hidden cursor-pointer" style={{ border: '1px solid var(--color-border)' }} onClick={() => setLightboxUrl(img.url)}>
                  <SmartImg src={img.url} alt={img.prompt} delay={i * 900} className="w-full aspect-[3/2] object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                    <span className="text-[10px] truncate max-w-[70%]" style={{ color: '#e2e8f0' }}>Variant {i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={img.url} download={`ai-dost-${i + 1}.png`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                      <Download className="w-3 h-3" /> Save
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && images.length === 0 && !loading && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                <RefreshCw className="w-3.5 h-3.5" /> Recent creations
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {history.slice(0, 8).map((h, i) => (
                  <button key={i} onClick={() => setLightboxUrl(h.url)} className="group relative rounded-2xl overflow-hidden cursor-pointer" style={{ border: '1px solid var(--color-border)' }}>
                    <SmartImg src={h.url} alt={h.prompt} delay={i * 700} className="w-full aspect-[3/2] object-cover" />
                    <div className="absolute inset-x-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                      <span className="block text-[10px] truncate" style={{ color: '#e2e8f0' }}>{h.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}