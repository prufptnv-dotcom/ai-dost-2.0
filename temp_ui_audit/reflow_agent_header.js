// Reflow the Copilot agent-panel header into two compact, non-overflowing rows.
// The single-row version needed ~430px inside a 390px pane, so its controls
// bled over the file-explorer column. Pure structural/class rewrite — no logic.
const fs = require('fs');
const p = 'C:\\Users\\vikash kumar\\Pictures\\ai dost 3.0\\frontend\\components\\views\\CopilotIDE.jsx';
const lines = fs.readFileSync(p, 'utf8').split('\n');

const startIdx = lines.findIndex((l) => l.includes('<aside className="w-[390px]'));
if (startIdx < 0) { console.error('aside not found'); process.exit(1); }

const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('<div className="flex items-center gap-1.5">'));
if (endIdx < 0) { console.error('controls row not found'); process.exit(1); }

// Find the closing of the controls group: the `</div>` that precedes the
// "Copilot Header" block's own closing wrapper.
let closeIdx = -1;
for (let i = endIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '</div>' && lines[i + 1] === '' && lines[i + 2]?.trim()?.startsWith('{/*')) { closeIdx = i; break; }
}
if (closeIdx < 0) { console.error('header close not found'); process.exit(1); }

console.log('replacing lines', startIdx + 1, '..', closeIdx + 1);
console.log('FIRST:', lines[startIdx].trim().slice(0, 70));
console.log('LAST :', lines[closeIdx].trim().slice(0, 70));

fs.writeFileSync(p + '.bak', lines.join('\n'), 'utf8');

const replacement = `        <aside className="w-[390px] shrink-0 flex flex-col bg-canvas-base border-r border-border z-10 overflow-hidden">

          {/* Copilot Header — identity/actions on row 1, mode + permission on row 2.
              The single-row layout needed ~430px inside a 390px pane, so the
              controls painted over the file explorer; two rows + overflow-x
              keeps every control inside this pane. */}
          <div className="shrink-0 bg-canvas-base border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,.65)]" />
              <span className="text-xs font-semibold text-paper-100 shrink-0">Copilot</span>
              <div className="relative min-w-0 shrink">
                <button
                  type="button"
                  onClick={() => setModelMenuOpen(o => !o)}
                  className="text-[10px] font-mono text-ink-muted bg-canvas-elevated pl-2 pr-1.5 py-0.5 rounded border border-border hover:border-accent/40 hover:text-paper-200 transition-colors cursor-pointer flex items-center gap-1 max-w-[120px]"
                  title="Preferred model — failure still falls back through the cascade"
                  data-testid="model-picker-btn"
                >
                  <AppIcon name="zap" size={9} className="text-accent shrink-0" />
                  <span className="truncate">{MODEL_OPTIONS.find(o => o.v === preferredModel)?.l || 'auto'}</span>
                  <AppIcon name="chevronDown" size={9} className="opacity-60 shrink-0" />
                </button>
                {modelMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setModelMenuOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-lg bg-canvas-elevated border border-border shadow-surface-card py-1" data-testid="model-menu">
                      {MODEL_OPTIONS.map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => {
                            setPreferredModel(opt.v);
                            try { window.localStorage.setItem('ai_dost_copilot_model', opt.v); } catch (_) { /* ignore */ }
                            setModelMenuOpen(false);
                            showToast(\`Model: \${opt.l}\`, 'info');
                          }}
                          className={\`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-canvas-overlay transition-colors flex items-center justify-between \${
                            preferredModel === opt.v ? 'text-accent' : 'text-paper-300'
                          }\`}
                        >
                          <span>{opt.l}</span>
                          {preferredModel === opt.v && <AppIcon name="check" size={11} />}
                        </button>
                      ))}
                      <div className="px-3 pt-1.5 pb-1 text-[9px] text-ink-muted border-t border-border-subtle mt-1">
                        Fallback cascade stays on
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="ml-auto flex items-center gap-0.5 shrink-0">
                <button
                  data-testid="watch-toggle"
                  aria-pressed={watching}
                  onClick={() => {
                    setWatching((prev) => {
                      const next = !prev;
                      try { window.localStorage.setItem('ai_dost_copilot_watch', next ? '1' : '0'); } catch (_) { /* ignore */ }
                      showToast(next ? 'Watch mode ON — live workspace updates' : 'Watch mode OFF', 'info');
                      return next;
                    });
                  }}
                  title={watching
                    ? 'Watch mode: streaming workspace file changes (click to stop)'
                    : 'Watch mode: live-refresh workspace file changes (click to start)'}
                  className={\`p-1.5 rounded-md transition-colors cursor-pointer \${
                    watching
                      ? 'bg-emerald-400/15 text-emerald-400'
                      : 'hover:bg-canvas-elevated text-ink-muted hover:text-paper-100'
                  }\`}
                >
                  <AppIcon name="eye" size={13} />
                </button>

                <button
                  data-testid="memory-btn"
                  aria-expanded={memoryOpen}
                  onClick={() => {
                    const next = !memoryOpen;
                    setMemoryOpen(next);
                    if (next) loadMemoryNotes();
                  }}
                  title={\`Self-learning notes (\${memoryCount} saved — survive project deletion)\`}
                  className={\`relative p-1.5 rounded-md transition-colors cursor-pointer \${
                    memoryOpen
                      ? 'bg-accent/15 text-accent'
                      : 'hover:bg-canvas-elevated text-ink-muted hover:text-paper-100'
                  }\`}
                >
                  <AppIcon name="brain" size={13} />
                  {memoryCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-[2px] rounded-full bg-accent/90 text-[8px] font-bold text-white flex items-center justify-center">
                      {memoryCount > 99 ? '99+' : memoryCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setCopilotMessages([]);
                    setPendingPlan(null);
                    setPlanTasks([]);
                    showToast('Chat history cleared', 'info');
                  }}
                  className="p-1.5 rounded-md hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <AppIcon name="trash" size={13} />
                </button>
              </div>
            </div>

            {/* Mode + permission — scrollable, so it can never bleed into the file tree */}
            <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
              <div
                className="flex items-center rounded-md border border-border overflow-hidden shrink-0"
                role="radiogroup"
                aria-label="Agent mode"
                data-testid="agent-mode-switch"
              >
                {[
                  { v: 'ask', l: 'Ask', t: 'Ask mode — answers only, never touches files' },
                  { v: 'plan', l: 'Plan', t: 'Plan mode — review & edit the plan, then approve' },
                  { v: 'code', l: 'Code', t: 'Code mode — autonomous execution (default)' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    role="radio"
                    aria-checked={agentMode === opt.v}
                    onClick={() => {
                      setAgentMode(opt.v);
                      try { window.localStorage.setItem('ai_dost_copilot_mode', opt.v); } catch (_) { /* ignore */ }
                      showToast(\`Mode: \${opt.l}\`, 'info');
                    }}
                    title={opt.t}
                    className={\`px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer \${
                      agentMode === opt.v
                        ? 'bg-accent/20 text-accent'
                        : 'bg-canvas-elevated text-ink-muted hover:text-paper-200'
                    }\`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>

              <div
                className="flex items-center rounded-md border border-border overflow-hidden shrink-0"
                role="radiogroup"
                aria-label="Agent permission level"
                data-testid="permission-switch"
              >
                {[
                  { v: 'ask', l: 'Ask', t: 'Ask — pause & require approval before every run' },
                  { v: 'auto', l: 'Auto', t: 'Auto — canonical safety policy decides' },
                  { v: 'turbo', l: 'Turbo', t: 'Turbo — auto-approve (hard blocks still apply)' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    role="radio"
                    aria-checked={permissionLevel === opt.v}
                    onClick={() => {
                      setPermissionLevel(opt.v);
                      try { window.localStorage.setItem('ai_dost_copilot_permissions', opt.v); } catch (_) { /* ignore */ }
                      showToast(\`Permissions: \${opt.l}\`, 'info');
                    }}
                    title={opt.t}
                    className={\`px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer \${
                      permissionLevel === opt.v
                        ? 'bg-amber-400/15 text-amber-400'
                        : 'bg-canvas-elevated text-ink-muted hover:text-paper-200'
                    }\`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>`;

const out = [...lines.slice(0, startIdx), ...replacement.split('\n'), ...lines.slice(closeIdx + 1)];
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('written. new line count:', out.length);