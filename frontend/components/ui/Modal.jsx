import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  // ESC key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-fast"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={`relative z-10 w-full ${maxWidth} bg-canvas-surface border border-border-strong rounded-xl shadow-modal overflow-hidden flex flex-col max-h-[90vh] transition-normal animate-in fade-in zoom-in-95 ${className}`}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between p-5 border-b border-border bg-canvas-subtle">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-txt-primary font-display tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-txt-muted mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <IconButton
              icon={X}
              size="sm"
              variant="ghost"
              onClick={onClose}
              title="Close modal"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 text-sm text-txt-primary">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;
