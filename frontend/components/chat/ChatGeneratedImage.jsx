import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import PropTypes from 'prop-types';

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
    <div className="rounded-lg overflow-hidden border border-secondary/20 bg-black/20 min-h-[120px] flex items-center justify-center relative">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">Generating image...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="p-4 text-center">
          <div className="text-2xl mb-1">⚠️</div>
          <p className="text-xs text-text-secondary">Image load failed.</p>
          <button
            onClick={() => { if (isMounted.current) setStatus('loading'); }}
            className="mt-2 text-xs text-primary underline cursor-pointer"
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
