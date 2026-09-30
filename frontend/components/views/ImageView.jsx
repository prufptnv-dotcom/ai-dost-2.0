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

export const IMAGE_CATEGORIES = [
  { id: 'all', label: 'All Presets', ratio: '1:1', sample: 'Futuristic AI assistant hologram in modern studio' },
  { id: 'logo', label: 'Logo', ratio: '1:1', sample: 'Minimalist geometric cyber emblem logo for AI startup, clean lines' },
  { id: 'youtube-banner', label: 'YouTube Banner', ratio: '16:9', sample: 'Futuristic gaming and tech studio channel art banner, 16:9' },
  { id: 'poster', label: 'Poster', ratio: '3:4', sample: 'Vertical theatrical sci-fi movie poster, dramatic key lighting, 8k' },
  { id: 'thumbnail', label: 'Thumbnail', ratio: '16:9', sample: 'High-CTR YouTube thumbnail, expressive excited face, neon rim lighting' },
  { id: 'character-design', label: 'Character Design', ratio: '3:4', sample: 'Full body futuristic cybernetic warrior, concept art turnaround' },
  { id: 'anime-artwork', label: 'Anime Artwork', ratio: '16:9', sample: 'Luminous anime city in rain, Makoto Shinkai aesthetic, vibrant sky' },
  { id: 'realistic-portrait', label: 'Realistic Portrait', ratio: '1:1', sample: '8k studio portrait photography, 85mm lens, natural skin texture' },
  { id: 'infographic', label: 'Infographic', ratio: '3:4', sample: 'Clean modern isometric 3D data pipeline workflow infographic' },
  { id: 'concept-art', label: 'Concept Art', ratio: '16:9', sample: 'Epic sci-fi planetary citadel, matte painting, Unreal Engine 5' },
  { id: 'product-mockup', label: 'Product Mockup', ratio: '1:1', sample: 'Minimalist smart device on acrylic pedestal, studio lightbox' },
  { id: 'ui-design', label: 'UI Design Concept', ratio: '16:9', sample: '2030 futuristic dashboard interface, dark glassmorphism, glowing cards' },
  { id: 'book-cover', label: 'Book Cover', ratio: '3:4', sample: 'Bestselling sci-fi novel cover, dramatic cosmic gate, room for typography' },
  { id: 'social-media-post', label: 'Social Media Post', ratio: '1:1', sample: 'Viral modern social media post, bold typography, vibrant gradients' },
  { id: 'background-change', label: 'Background Removal/Change', ratio: '1:1', sample: 'Subject with background replaced by cyberpunk neon city street' },
  { id: 'object-add-remove', label: 'Object Add/Remove', ratio: '1:1', sample: 'Modern living room with a glowing holographic AI globe added on table' },
  { id: 'style-transformation', label: 'Style Transformation', ratio: '1:1', sample: 'Urban street photograph transformed into vibrant anime cel-shading' },
  { id: 'image-enhancement', label: 'Image Enhancement', ratio: '1:1', sample: 'Remastered 8k ultra-sharp photograph, HDR dynamic range, crystal clear' },
];

const STYLES = [
  { id: 'default', label: 'Default', suffix: '' },
  { id: 'anime-3d', label: 'Anime 3D Studio', suffix: ', 3d anime style, studio lighting, Makoto Shinkai aesthetic, octane render' },
  { id: 'cinematic-bharat', label: 'Cinematic Bharat', suffix: ', majestic Indian aesthetic, golden hour sunlight, royal heritage backdrop, 8k cinematic' },
  { id: 'photo', label: 'Photorealistic', suffix: ', photorealistic, 8k, sharp focus, professional photography' },
  { id: '3d', label: '3D Render', suffix: ', 3d render, octane render, cinematic lighting' },
  { id: 'anime', label: 'Anime / Ghibli', suffix: ', anime style, studio ghibli inspired, vibrant colors' },
  { id: 'pixel', label: 'Pixel Art', suffix: ', pixel art, 16-bit, retro game style' },
  { id: 'oil', label: 'Oil Painting', suffix: ', oil painting, renaissance style, textured brushstrokes' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square', width: 1024, height: 1024 },
  { id: '16:9', label: '16:9 Cinema / YT', width: 1280, height: 720 },
  { id: '9:16', label: '9:16 Mobile / Story', width: 720, height: 1280 },
  { id: '3:4', label: '3:4 Poster / Cover', width: 768, height: 1024 },
  { id: '4:3', label: '4:3 Classic', width: 1024, height: 768 },
];

const SUGGESTED_PROMPTS = [
  'Cyberpunk high-tech city street at night in rain',
  'Minimalist 3D isometric home office with lush plants',
  'Majestic mountain peak during golden hour sunset',
  'Futuristic AI assistant hologram in modern studio',
];

const SEED_VARIANTS = 2;

export default function ImageView({ onToast }) {
  const [prompt, setPrompt] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(IMAGE_CATEGORIES[0]);
  const [style, setStyle] = useState(STYLES[1]); // Default to Anime 3D Studio
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [isTurbo, setIsTurbo] = useState(true);
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
    setProgress(20);
    const fullPrompt = base + style.suffix;
    const newImages = [];
    try {
      if (isTurbo) {
        // Z-Image Turbo mode: Instant sub-second diffusion synthesis
        const res = await api.post('/image/turbo', {
          prompt: base,
          category: selectedCategory.id !== 'all' ? selectedCategory.id : undefined,
          style: style.id,
          width: aspectRatio.width,
          height: aspectRatio.height,
        });
        const url = res.data?.imageUrl;
        if (url) {
          newImages.push({ url, prompt: base, category: selectedCategory.id, style: style.id, seed: res.data?.seed || Date.now(), isTurbo: true });
        }
        setProgress(100);
      } else {
        for (let i = 0; i < SEED_VARIANTS; i++) {
          const res = await api.post('/image/generate', {
            prompt: fullPrompt,
            category: selectedCategory.id !== 'all' ? selectedCategory.id : undefined,
            width: aspectRatio.width,
            height: aspectRatio.height,
          });
          const url = res.data?.imageUrl;
          if (url) newImages.push({ url, prompt: base, category: selectedCategory.id, style: style.id, seed: Date.now() + i });
          setProgress(Math.round(((i + 1) / SEED_VARIANTS) * 100));
        }
      }
      if (newImages.length === 0) throw new Error('No images returned');
      setImages(newImages);
      saveHistory(newImages);
      showToast(isTurbo ? '⚡ Z-Image Turbo generated!' : `${newImages.length} images generated`, 'success');
    } catch (e) {
      showToast(`Image generation failed: ${e?.message || 'API error'}`, 'error');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    if (cat.sample && !prompt) {
      setPrompt(cat.sample);
    }
    if (cat.ratio) {
      const match = ASPECT_RATIOS.find((r) => r.id === cat.ratio);
      if (match) setAspectRatio(match);
    }
  };

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [images]);

  return (
    <div className="h-full flex flex-col bg-canvas-base overflow-hidden">
      {/* Header Strip */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-canvas-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-accent-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-paper-100 font-display">
                  Image Generator & Studio
                </h1>
                {isTurbo && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Sparkles size={11} />
                    Z-Image Turbo
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {isTurbo ? 'Sub-second real-time diffusion synthesis active.' : 'Standard high-resolution Pollinations / Gemini pipeline.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTurbo(!isTurbo)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all cursor-pointer border ${
                isTurbo 
                  ? 'bg-amber-500 text-black border-amber-400 shadow-glow-sm font-bold' 
                  : 'bg-canvas-surface border-border text-ink-muted hover:text-paper-100'
              }`}
            >
              {isTurbo ? '⚡ Turbo ON' : 'Turbo OFF'}
            </button>
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
        </div>

        {/* 17 Category Presets Selector */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider shrink-0 mr-1">Type:</span>
          {IMAGE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat)}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer border ${
                selectedCategory.id === cat.id
                  ? 'bg-accent-primary text-paper-100 font-semibold border-accent-primary shadow-glow-sm'
                  : 'bg-canvas-surface border-border text-paper-200 hover:text-paper-100 hover:border-border-hover'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Style selector chips */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider shrink-0 mr-1 self-center">Style:</span>
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s)}
              className={`shrink-0 px-2.5 py-0.5 rounded-xs text-xs font-mono transition-fast cursor-pointer ${
                style.id === s.id
                  ? 'bg-accent-secondary text-paper-100 font-medium'
                  : 'bg-canvas-surface border border-border text-paper-200 hover:text-paper-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Aspect Ratio selector chips */}
        <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider shrink-0 mr-1">Ratio:</span>
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setAspectRatio(r)}
              className={`shrink-0 px-2 py-0.5 rounded-xs text-[11px] font-mono transition-fast cursor-pointer ${
                aspectRatio.id === r.id
                  ? 'bg-accent-primary/20 border border-accent-primary text-accent-primary font-semibold'
                  : 'bg-canvas-surface border border-border text-paper-200 hover:text-paper-100'
              }`}
            >
              {r.label}
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
            <div className="space-y-6">
              <EmptyState
                icon={ImageIcon}
                title="No generated images"
                description="Type a descriptive prompt above and select style and aspect ratio presets to create visual assets."
              />

              <div className="max-w-xl mx-auto">
                <div className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-2 text-center font-mono">
                  ✨ Quick Inspiration Prompts
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED_PROMPTS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPrompt(p);
                        generate(p);
                      }}
                      className="text-left p-2.5 rounded-xs border border-border bg-canvas-surface hover:border-accent-primary/50 text-xs text-paper-100 hover:text-accent-primary transition-colors cursor-pointer group shadow-2xs"
                    >
                      <span className="line-clamp-2">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
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