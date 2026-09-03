import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Modern themed confirmation dialog to replace browser-native window.confirm()
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // 'danger' | 'primary'
  loading = false,
}) {
  const isDanger = variant === 'danger';

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      maxWidth="max-w-md"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                : 'bg-accent/10 text-accent border border-accent/20'
            }`}
          >
            {isDanger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-paper-100 font-display tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            className={isDanger ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
