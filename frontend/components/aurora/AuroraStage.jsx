import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import { generateLiveAppHtml } from '../ide/PreviewEngine';
import { diffLines } from '../../lib/lineDiff';
import s from './Aurora.module.css';

/**
 * P11 A3 — right stage, Bolt-style preview-first panel with real diffs.
 *
 * Preview: auto mode — P5 `dev_server` READY (or the mount-time status probe
 * of a P7-persisted server) renders the live app through the
 * `/api/preview/:projectId` proxy; until then the stage renders the GENERATED
 * FILES in-browser via PreviewEngine.generateLiveAppHtml (static srcdoc) — so
 * a run shows its output appearing while it writes, no server needed. FAILED
 * keeps the static fallback and says why.
 *
 * Files: click a row → inline unified diff of the run-scope change
 * (lib/lineDiff; NEW files render as full additions, oversized diffs keep
 * their stats and say so instead of dropping the row).
 */

const MAX_DIFF_LINES = 400;

function DiffPanel({ file }) {
  if (file.nodiff || file.prev === null || file.next === null || file.prev === undefined) {
    return (
      <div className={s.diffPanel} data-testid="diff-panel" data-mode="too-large">
        <span className={s.diffMore}>
          diff too large to render — stats only ({file.add} added / {file.del} removed)
        </span>
      </div>
    );
  }
  const ops = diffLines(file.prev, file.next);
  const shown = ops.slice(0, MAX_DIFF_LINES);
  return (
    <div className={s.diffPanel} data-testid="diff-panel">
      <div className={s.diffHead}>
        unified diff · {file.path} · {ops.length} lines · +{file.add} −{file.del}
      </div>
      {shown.map((op, i) => (
        <div
          key={i}
          data-type={op.type}
          className={`${s.diffLine} ${
            op.type === 'add' ? s.diffLineAdd : op.type === 'del' ? s.diffLineDel : ''
          }`}
        >
          <span className={s.diffSign}>{op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}</span>
          <span className={s.diffText}>{op.text || ' '}</span>
        </div>
      ))}
      {ops.length > shown.length && (
        <div className={s.diffMore}>… {ops.length - shown.length} more lines</div>
      )}
    </div>
  );
}

// P11 A3 — the director path never emits `dev_server` (ensureLivePreview only
// runs on the scaffold/ReAct routes), so the stage drives the preview lifecycle
// itself through the same preview API CopilotIDE ships with:
// POST /api/preview/:id/dev/start {projectPath:'.'} → READY, /dev/stop → STOPPED.
export default function AuroraStage({
  files = [],
  contents = {},
  projectId = 'default',
  devServer = {},
  previewBusy = false,
  onStartPreview,
  onStopPreview,
}) {
  const [tab, setTab] = useState('preview');
  const [openPath, setOpenPath] = useState(null);
  const [tick, setTick] = useState(0);

  const live = devServer.state === 'READY';

  // Bolt-style: when the dev server comes up, the preview IS the result.
  const wasLiveRef = useRef(false);
  useEffect(() => {
    if (live && !wasLiveRef.current) setTab('preview');
    wasLiveRef.current = live;
  }, [live]);

  const hasFiles = files.length > 0 || Object.keys(contents).length > 0;
  const srcDoc = useMemo(
    () => (live || !hasFiles ? null : generateLiveAppHtml(files, contents, false)),
    [live, hasFiles, files, contents]
  );

  const chipLabel = live
    ? `Live${devServer.hostPort != null ? ` · :${devServer.hostPort}` : ''}`
    : devServer.state === 'FAILED'
      ? `Preview server failed — ${devServer.reason || 'unknown reason'}`
      : devServer.state
        ? 'Booting preview…'
        : 'Static · generated files';

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
          <div className={s.previewWrap} data-testid="aurora-preview">
            {live || srcDoc ? (
              <>
                <div className={s.previewBar}>
                  <span
                    className={`${s.previewChip} ${live ? s.previewChipLive : ''} ${
                      devServer.state === 'FAILED' ? s.previewChipBad : ''
                    }`}
                    data-testid="preview-chip"
                  >
                    <span className={s.previewDot} aria-hidden="true" />
                    {chipLabel}
                  </span>
                  {live ? (
                    <button
                      type="button"
                      className={s.previewBtn}
                      data-testid="preview-stop"
                      aria-label="Stop preview server"
                      disabled={previewBusy}
                      onClick={onStopPreview}
                    >
                      <AppIcon name="square" size={10} />
                    </button>
                  ) : devServer.state !== 'STARTING' ? (
                    <button
                      type="button"
                      className={s.previewBtn}
                      data-testid="preview-start"
                      aria-label="Start preview server"
                      disabled={previewBusy}
                      onClick={onStartPreview}
                    >
                      <AppIcon name="play" size={10} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={s.previewBtn}
                    data-testid="preview-refresh"
                    aria-label="Refresh preview"
                    onClick={() => setTick((t) => t + 1)}
                  >
                    <AppIcon name="refresh" size={11} />
                  </button>
                </div>
                <iframe
                  key={tick}
                  data-testid="aurora-frame"
                  data-mode={live ? 'live' : 'static'}
                  src={live ? `/api/preview/${encodeURIComponent(projectId)}?t=${tick}` : undefined}
                  srcDoc={!live && srcDoc ? srcDoc : undefined}
                  className={s.previewFrame}
                  title="Live App"
                  // Same trade-off as classic PreviewPane (AGENTS known-benign):
                  // allow-same-origin lets Visual/QA tooling reach the frame.
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              </>
            ) : (
              <div className={s.emptyState}>
                <span className={s.emptyIcon}>
                  <AppIcon name="eye" size={18} />
                </span>
                <span className={s.emptyTitle}>No preview yet</span>
                {devServer.state === 'FAILED' ? (
                  // honest failure visibility — otherwise the reason only lives
                  // in the spine row and the empty state pretends nothing happened
                  <span className={`${s.emptyHint} ${s.previewFailText}`}>
                    preview server failed — {devServer.reason || 'unknown reason'}
                  </span>
                ) : (
                  <span className={s.emptyHint}>renders from your first written file</span>
                )}
                <button
                  type="button"
                  className={`${s.previewBtn} ${s.previewStartBtn}`}
                  data-testid="preview-start"
                  aria-label="Start preview server"
                  disabled={previewBusy}
                  onClick={onStartPreview}
                >
                  <AppIcon name="play" size={10} />
                  {previewBusy ? 'Starting…' : 'Start preview'}
                </button>
              </div>
            )}
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
              files.map((f) => {
                const open = openPath === f.path;
                return (
                  <div key={f.path}>
                    <button
                      type="button"
                      className={s.fileRow}
                      data-testid="file-row"
                      data-path={f.path}
                      aria-expanded={open}
                      onClick={() => setOpenPath(open ? null : f.path)}
                    >
                      <AppIcon name={open ? 'chevronDown' : 'chevronRight'} size={10} />
                      <AppIcon name={f.isNew ? 'file' : 'fileDiff'} size={12} />
                      <span className={s.filePath} title={f.path}>
                        {f.path}
                      </span>
                      {f.isNew && <span className={s.fileNew}>NEW</span>}
                      <span className={s.diffAdd}>+{f.add}</span>
                      {f.del > 0 && <span className={s.diffDel}>-{f.del}</span>}
                    </button>
                    {open && <DiffPanel file={f} />}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
}
