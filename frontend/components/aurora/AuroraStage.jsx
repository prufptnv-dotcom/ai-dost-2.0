import { useState } from 'react';
import AppIcon from '../ui/AppIcon';
import s from './Aurora.module.css';

/**
 * P11 A1 — right stage: Bolt-style preview-first panel with a changed-files tab.
 * (Real live preview wiring lands in slice A3 — this is the shell contract.)
 */
export default function AuroraStage({ files = [] }) {
  const [tab, setTab] = useState('preview');

  return (
    <section className={s.stage} data-testid="aurora-stage">
      <div className={s.tabs} role="tablist" aria-label="Stage">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={`${s.tab} ${tab === 'preview' ? s.tabOn : ''}`}
          data-testid="stage-tab-preview"
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'files'}
          className={`${s.tab} ${tab === 'files' ? s.tabOn : ''}`}
          data-testid="stage-tab-files"
          onClick={() => setTab('files')}
        >
          Files{files.length ? ` (${files.length})` : ''}
        </button>
      </div>

      <div className={s.stageBody}>
        {tab === 'preview' ? (
          <div className={s.emptyState} data-testid="aurora-preview">
            <span className={s.emptyIcon}>
              <AppIcon name="eye" size={18} />
            </span>
            <span className={s.emptyTitle}>No preview yet</span>
            <span className={s.emptyHint}>localhost:4173</span>
          </div>
        ) : (
          <div data-testid="aurora-files">
            {files.length === 0 ? (
              <div className={s.emptyState}>
                <span className={s.emptyIcon}>
                  <AppIcon name="folderTree" size={18} />
                </span>
                <span className={s.emptyTitle}>No files changed yet</span>
              </div>
            ) : (
              files.map((f) => (
                <div key={f.path} className={s.fileRow} data-testid="file-row" data-path={f.path}>
                  <AppIcon name={f.isNew ? 'file' : 'fileDiff'} size={12} />
                  <span className={s.filePath} title={f.path}>
                    {f.path}
                  </span>
                  {f.isNew && <span className={s.fileNew}>NEW</span>}
                  <span className={s.diffAdd}>+{f.add}</span>
                  {f.del > 0 && <span className={s.diffDel}>-{f.del}</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
