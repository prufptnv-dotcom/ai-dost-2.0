import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Loader2, Maximize2 } from 'lucide-react';

// Smart image with auto-retry — pollinations free tier sometimes 429s on first load
export function SmartImg({ src, alt = '', className, style, onLoad, onError, retries = 3, delay = 0 }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(delay === 0);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setError(false);
    if (delay > 0) {
      const t = setTimeout(() => setShow(true), delay);
      return () => clearTimeout(t);
    }
    setShow(true);
  }, [src, delay]);

  if (!show) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      key={attempt}
      src={src}
      alt={alt}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0 }}
      onLoad={() => { setLoaded(true); if (onLoad) onLoad(); }}
      onError={() => {
        if (attempt < retries) {
          setTimeout(() => setAttempt((a) => a + 1), 2500 * (attempt + 1));
        } else {
          setError(true);
          if (onError) onError();
        }
      }}
    />
  );
}

export function ImageCard({ src, alt = '', onOpen, index = 0, delay = 0 }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className="relative rounded-xl overflow-hidden group cursor-pointer"
      style={{ border: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.3)' }}
      onClick={() => onOpen && onOpen(src)}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ minHeight: 176 }}>
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      )}
      {error ? (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-[10px]" style={{ color: 'var(--color-text-muted)', minHeight: 176 }}>
          <span>Image load nahi hui</span>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
            style={{ background: 'rgba(75,139,252,0.15)', color: 'var(--color-primary)' }}
          >
            New tab me kholo
          </a>
        </div>
      ) : (
        <>
          <SmartImg
            src={src}
            alt={alt || `Image ${index + 1}`}
            delay={delay}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            retries={3}
            className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(6px)' }}>
              <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function ImageLightbox({ url, alt = '', onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-10"
      style={{ background: 'rgba(5,6,10,0.92)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer z-10"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
      >
        <X className="w-5 h-5" />
      </button>

      <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
        <div
          className="rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '50vh' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="max-w-full max-h-[75vh] object-contain" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <a
            href={url}
            download={`ai-dost-image.png`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}
          >
            <Download className="w-4 h-4" /> Download
          </a>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
          >
            <ExternalLink className="w-4 h-4" /> New tab me kholo
          </a>
        </div>
      </div>
    </div>
  );
}