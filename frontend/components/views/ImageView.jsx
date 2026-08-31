import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon, Wand2, Download, Loader2,
  RefreshCw, Sparkles, Trash2, X
} from 'lucide-react';
import api from '../../services/api';
import { ImageLightbox, SmartImg } from './ImageLightbox';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

const HISTORY_KEY = 'ai_dost_images_history';

const STYLES = [
  { id: 'default', label: 'Default', suffix: '' },
  { id: 'photo', label: 'Photorealistic', suffix: ', photorealistic, 8k, sharp focus, professional photography' },
  { id: '3d', label: '3D Render', suffix: ', 3d render, octane render, cinematic lighting' },
  { id: 'anime', label: 'Anime / Ghibli', suffix: ', anime style, studio ghibli inspired, vibrant colors' },
  { id: 'pixel', label: 'Pixel Art', suffix: ', pixel art, 16-bit, retro game style' },
  { id: 'oil', label: 'Oil Painting', suffix: ', oil painting, renaissance style, textured brushstrokes' },
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  });

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      setHistory(Array.isArray(h) ? h : []);
    } catch (_) {}
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
    showToast('Image history cleared', 'success');
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
      showToast(`Image generation failed: ${e?.message || 'API error'}`, 'error');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [images]);

  return (
    <div className="h-full flex flex-col bg-canvas-base select-none overflow-hidden">
      {/* Header Strip */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-canvas-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-accent-primary" />
            <div>
              <h1 className="text-base font-semibold text-paper-100 font-display">
                Image Generator
              </h1>
              <p className="text-xs text-ink-muted mt-0.5">
                Generate high-resolution visual assets and mockups via Pollinations AI.
              </p>
            </div>
          </div>
          {history.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={clearHistory}
            >
              Clear History
            </Button>
          )}
        </div>

        {/* Style selector chips */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s)}
              className={`shrink-0 px-2.5 py-1 rounded-xs text-xs font-mono transition-fast cursor-pointer ${
                style.id === s.id
                  ? 'bg-accent-primary text-paper-100 font-medium'
                  : 'bg-canvas-surface border border-border text-paper-200 hover:text-paper-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Prompt Input Dock */}
        <div className="mt-3 flex items-center gap-2 rounded-xs p-1.5 bg-canvas-surface border border-border">
          <Wand2 className="w-4 h-4 ml-1.5 text-accent-primary shrink-0" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
            placeholder="Describe the image you want to generate..."
            className="flex-1 bg-transparent text-xs font-sans text-paper-100 placeholder:text-ink-muted focus:outline-none"
          />
          <Button
            variant="primary"
            size="sm"
            icon={loading ? Loader2 : Sparkles}
            onClick={() => generate()}
            disabled={!prompt.trim() || loading}
          >
            {loading ? 'Generating...' : 'Generate'}
          </Button>
        </div>

        {loading && (
          <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-ink-muted">
            <div className="flex-1 h-1 rounded-full overflow-hidden bg-canvas-elevated">
              <div
                className="h-full bg-accent-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{progress}% — rendering {SEED_VARIANTS} variants</span>
          </div>
        )}
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-5xl mx-auto px-6 py-6">
          {images.length === 0 && history.length === 0 && !loading && (
            <EmptyState
              icon={ImageIcon}
              title="No generated images"
              description="Type a descriptive prompt above and select a style preset to create visual assets."
            />
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div
                  key={img.seed}
                  className="group relative rounded-sm border border-border overflow-hidden bg-canvas-surface cursor-pointer shadow-xs"
                  onClick={() => setLightboxUrl(img.url)}
                >
                  <SmartImg
                    src={img.url}
                    alt={img.prompt}
                    delay={i * 800}
                    className="w-full aspect-[3/2] object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-mono text-paper-100 truncate max-w-[70%]">
                      Variant {i + 1}
                    </span>
                    <a
                      href={img.url}
                      download={`ai-dost-${i + 1}.png`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-xs bg-white/10 hover:bg-white/20 text-white text-[10px] font-medium"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && images.length === 0 && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-muted font-semibold">
                <RefreshCw className="w-3.5 h-3.5" /> Recent Generations
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {history.slice(0, 8).map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxUrl(h.url)}
                    className="group relative rounded-sm border border-border overflow-hidden bg-canvas-surface cursor-pointer text-left shadow-xs"
                  >
                    <SmartImg
                      src={h.url}
                      alt={h.prompt}
                      delay={i * 600}
                      className="w-full aspect-[3/2] object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="block text-[10px] font-sans text-paper-100 truncate">
                        {h.prompt}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}