import React from 'react';
import { FileText, Download, ExternalLink, Play, FileSpreadsheet, Presentation, FileCode } from 'lucide-react';
import { Button } from '../ui/Button';

const TYPE_CONFIG = {
  pdf: { icon: FileText, label: 'PDF Document', color: 'text-status-error' },
  docx: { icon: FileText, label: 'Word Document', color: 'text-accent' },
  xlsx: { icon: FileSpreadsheet, label: 'Excel Spreadsheet', color: 'text-status-success' },
  csv: { icon: FileSpreadsheet, label: 'CSV Data Sheet', color: 'text-status-success' },
  pptx: { icon: Presentation, label: 'Presentation Deck', color: 'text-status-warning' },
  html: { icon: FileCode, label: 'Interactive Artifact', color: 'text-accent' },
  svg: { icon: FileCode, label: 'SVG Vector Graphics', color: 'text-accent' },
  default: { icon: FileText, label: 'Document Artifact', color: 'text-txt-primary' },
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
  const Icon = config.icon;

  return (
    <div
      className={`my-3 p-3.5 rounded-lg border border-border bg-canvas-surface flex items-center justify-between gap-3 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-canvas-subtle border border-border flex items-center justify-center flex-shrink-0">
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="min-w-0">
          <h4 className="text-ui-default font-medium text-txt-primary truncate">
            {title}
          </h4>
          <div className="flex items-center gap-2 text-[11px] text-txt-muted mt-0.5">
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
            icon={Play}
            onClick={onOpenCanvas}
          >
            Preview
          </Button>
        )}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium rounded-sm bg-accent hover:bg-accent-hover text-white transition-fast focus-ring"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Download
          </a>
        )}
      </div>
    </div>
  );
}

export default ArtifactCard;
