import React from 'react';
import AppIcon from '../ui/AppIcon';
import { Button } from '../ui/Button';

const TYPE_CONFIG = {
  pdf: { icon: 'file', label: 'PDF Document', color: 'text-red-400' },
  docx: { icon: 'file', label: 'Word Document', color: 'text-accent' },
  xlsx: { icon: 'fileSpreadsheet', label: 'Excel Spreadsheet', color: 'text-emerald-400' },
  csv: { icon: 'fileSpreadsheet', label: 'CSV Data Sheet', color: 'text-emerald-400' },
  pptx: { icon: 'presentation', label: 'Presentation Deck', color: 'text-amber-400' },
  html: { icon: 'fileCode', label: 'Interactive Artifact', color: 'text-accent' },
  svg: { icon: 'fileCode', label: 'SVG Vector Graphics', color: 'text-accent' },
  default: { icon: 'file', label: 'Document Artifact', color: 'text-paper-100' },
};

export function ArtifactCard({
  type = 'pdf',
  title = 'Generated Artifact',
  downloadUrl,
  onOpenCanvas,
  size,
  className = '',
}) {
  const config = TYPE_CONFIG[type.toLowerCase()] || TYPE_CONFIG.default;

  return (
    <div
      className={`my-3 p-3.5 rounded-xl border border-border bg-canvas-surface flex items-center justify-between gap-3 shadow-xs ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-canvas-elevated border border-border flex items-center justify-center flex-shrink-0">
          <AppIcon name={config.icon} size={16} className={config.color} />
        </div>
        <div className="min-w-0">
          <h4 className="font-medium text-paper-100 truncate">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-ink-muted mt-0.5">
            <span className="font-mono uppercase">{type}</span>
            {size && <span>• {size}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {onOpenCanvas && (
          <Button
            variant="secondary"
            size="sm"
            icon="play"
            onClick={onOpenCanvas}
          >
            Preview
          </Button>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hover text-white transition-fast focus-ring"
          >
            <AppIcon name="download" size={14} className="mr-1" /> Download
          </a>
        )}
      </div>
    </div>
  );
}

export default ArtifactCard;
