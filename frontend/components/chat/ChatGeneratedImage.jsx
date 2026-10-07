import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import PropTypes from 'prop-types';
import AppIcon from '../ui/AppIcon';

export function ChatGeneratedImage({ url, alt }) {
  const [status, setStatus] = useState('loading');
  const isMounted = React.useRef(true);

  useEffect(() => {
    isMounted.current = true;
    setStatus('loading');
    return () => {
      isMounted.current = false;
    };
  }, [url]);

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-canvas-elevated min-h-[120px] flex items-center justify-center relative shadow-xs">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-canvas-elevated">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-ink-muted font-medium">Generating image...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="p-6 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AppIcon name="alert" className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-xs text-ink-muted mb-2">Image load failed.</p>
          <button
            onClick={() => { if (isMounted.current) setStatus('loading'); }}
            className="text-xs text-accent hover:underline cursor-pointer font-medium"
          >
            Retry
          </button>
        </div>
      )}
      <Image
        src={url}
        alt={alt || 'Generated image'}
        width={512}
        height={256}
        unoptimized
        style={{ width: '100%', height: 'auto' }}
        className={`max-h-64 object-contain transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0 h-0'}`}
        onLoad={() => { if (isMounted.current) setStatus('loaded'); }}
        onError={() => { if (isMounted.current) setStatus('error'); }}
      />
    </div>
  );
}

ChatGeneratedImage.propTypes = {
  url: PropTypes.string.isRequired,
  alt: PropTypes.string,
};
