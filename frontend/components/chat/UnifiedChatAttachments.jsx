import { useEffect, useState } from 'react';
import { Paperclip, X } from 'lucide-react';

export const MAX_CHAT_ATTACHMENTS = 15;
export const MAX_CHAT_ATTACHMENT_CHARS = 30000;
export const MAX_CHAT_ATTACHMENT_TOTAL_CHARS = 120000;

const ATTACHMENTS_KEY = '__aiDostComposerAttachments';
const INPUT_SELECTOR = 'input[type="file"]';

const asDataUrlBase64 = (dataUrl) => {
  const value = String(dataUrl || '');
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
  reader.readAsDataURL(file);
});

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
  reader.readAsText(file);
});

async function normalizeFile(file, index) {
  const name = file?.name || `attachment-${index + 1}`;
  const mime = file?.type || 'application/octet-stream';

  if (mime.startsWith('image/')) {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      name,
      type: 'image',
      mime,
      content: `[Image attachment: ${name}]`,
      imageBase64: asDataUrlBase64(dataUrl).slice(0, 120000),
    };
  }

  const text = await readFileAsText(file);
  return {
    name,
    type: name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'text',
    mime,
    content: text.slice(0, MAX_CHAT_ATTACHMENT_CHARS),
  };
}

function setGlobalAttachments(items) {
  if (typeof window === 'undefined') return;
  window[ATTACHMENTS_KEY] = items;
  window.dispatchEvent(new CustomEvent('ai_dost_composer_attachments', {
    detail: { attachments: items },
  }));
}

export function getComposerAttachments() {
  if (typeof window === 'undefined' || !Array.isArray(window[ATTACHMENTS_KEY])) return [];
  return window[ATTACHMENTS_KEY];
}

export function clearComposerAttachments() {
  setGlobalAttachments([]);
}

export default function UnifiedChatAttachments() {
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncInput = () => {
      document.querySelectorAll(INPUT_SELECTOR).forEach((input) => {
        const accept = String(input.accept || '');
        if (accept && !accept.includes('.pdf') && !accept.includes('image/')) return;
        input.multiple = true;
        input.setAttribute('aria-label', input.getAttribute('aria-label') || 'Attach files');
      });
    };

    const handleDocumentClick = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button')) window.setTimeout(syncInput, 0);
    };

    const handleChange = async (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      if (!input.multiple || !input.files?.length) return;
      const files = Array.from(input.files).slice(0, MAX_CHAT_ATTACHMENTS);
      if (!files.length) return;

      // This bridge owns the shared file input. Prevent ChatView's legacy
      // single-attachment onChange from consuming only the first file.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const next = [];
      let totalChars = 0;
      for (let i = 0; i < files.length; i += 1) {
        try {
          const item = await normalizeFile(files[i], i);
          const contentLength = String(item.content || '').length;
          if (totalChars + contentLength > MAX_CHAT_ATTACHMENT_TOTAL_CHARS) break;
          totalChars += contentLength;
          next.push(item);
        } catch (_) {
          // Keep usable attachments when one file cannot be read.
        }
      }

      setAttachments(next);
      setGlobalAttachments(next);
      input.value = '';

      if (next.length < files.length) {
        window.dispatchEvent(new CustomEvent('ai_dost_toast', {
          detail: {
            type: 'warning',
            message: `Chat attachments limited to ${next.length} usable file${next.length === 1 ? '' : 's'}.`,
          },
        }));
      }
    };

    syncInput();
    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('change', handleChange, true);
    const onAttachmentUpdate = (event) => setAttachments(event.detail?.attachments || []);
    window.addEventListener('ai_dost_composer_attachments', onAttachmentUpdate);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('change', handleChange, true);
      window.removeEventListener('ai_dost_composer_attachments', onAttachmentUpdate);
      delete window[ATTACHMENTS_KEY];
    };
  }, []);

  if (!attachments.length) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[min(92vw,768px)] -translate-x-1/2 rounded-xl border border-border bg-canvas-surface/95 p-2.5 shadow-lg backdrop-blur" role="region" aria-label="Selected chat files">
      <div className="flex items-center gap-2 px-1 pb-2 text-[11px] font-medium text-ink-muted">
        <Paperclip className="h-3.5 w-3.5 text-accent" />
        <span>{attachments.length}/15 files ready for this chat</span>
      </div>
      <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {attachments.map((item) => (
          <span key={`${item.name}-${item.mime}`} className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-border bg-canvas-elevated px-2 py-1 text-[11px] text-paper-100">
            <span className="truncate">{item.name}</span>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-ink-muted hover:text-paper-100"
              aria-label={`Remove ${item.name}`}
              onClick={() => {
                const next = attachments.filter((file) => file !== item);
                setAttachments(next);
                setGlobalAttachments(next);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
