import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import s from './Aurora.module.css';

/**
 * P11 A4 — Cmd/Ctrl+K command palette for the Aurora cockpit.
 *
 * One searchable list over two kinds of entries: commands (preview start/stop,
 * stage tabs, run stop, permission level, Classic UI) and the run's file list
 * (selecting one jumps to its diff in the Files tab). The component owns
 * focus + keyboard; ranking stays dumb-but-honest in the pure `filterActions`
 * (case-insensitive substring over label/hint/group, multi-token AND, order
 * preserved — no fuzzy scoring theater).
 */

export function filterActions(actions, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return actions;
  const tokens = q.split(/\s+/).filter(Boolean);
  return (actions || []).filter((a) => {
    const hay = `${a.label || ''} ${a.hint || ''} ${a.group || ''}`.toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}

export default function AuroraPalette({ open, onClose, actions = [] }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const shown = useMemo(() => filterActions(actions, query), [actions, query]);

  // Fresh query + focus on every open (focus after paint so the dialog exists).
  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setCursor(0);
    const t = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-on="1"]');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [cursor, open, shown.length]);

  if (!open) return null;

  function execute(idx) {
    const a = shown[idx];
    if (!a || a.disabled) return;
    onClose();
    if (typeof a.run === 'function') a.run();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(shown.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setCursor(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setCursor(Math.max(shown.length - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      execute(cursor);
    }
  }

  return (
    <div
      className={s.paletteOverlay}
      data-testid="aurora-palette"
      // click on the dimmed backdrop (not the panel) dismisses
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.palette} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className={s.paletteTop}>
          <AppIcon name="search" size={13} />
          <input
            ref={inputRef}
            className={s.paletteInput}
            data-testid="palette-input"
            value={query}
            placeholder="Type a command or file name…"
            aria-label="Command or file"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={s.kbdTag}>esc</kbd>
        </div>

        <div className={s.paletteList} ref={listRef} role="listbox" aria-label="Actions">
          {shown.length === 0 ? (
            <div className={s.paletteEmpty} data-testid="palette-empty">
              No matching command
            </div>
          ) : (
            shown.map((a, i) => (
              <button
                key={a.id}
                type="button"
                role="option"
                aria-selected={i === cursor}
                data-on={i === cursor ? '1' : '0'}
                data-testid="palette-item"
                disabled={a.disabled}
                className={`${s.paletteItem} ${i === cursor ? s.paletteItemOn : ''} ${
                  a.disabled ? s.paletteItemOff : ''
                }`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => execute(i)}
              >
                <span className={s.paletteIcon}>
                  {a.icon ? <AppIcon name={a.icon} size={12} /> : null}
                </span>
                <span className={s.paletteLabel}>{a.label}</span>
                {a.hint ? <span className={s.paletteHint}>{a.hint}</span> : null}
              </button>
            ))
          )}
        </div>

        <div className={s.paletteFoot}>
          <span>↑↓ move · ⏎ run · esc close</span>
          <span className={s.paletteFootRight}>
            Ctrl/⌘K palette · ⌥P preview · ⌥F files · ⌥S server
          </span>
        </div>
      </div>
    </div>
  );
}
