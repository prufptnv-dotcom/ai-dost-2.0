import { useEffect, useState } from 'react';
import { FileText, ListChecks, X, ArrowUpRight } from 'lucide-react';
import { clearWorkspaceState, readWorkspaceState, CHAT_WORKSPACE_KEY } from './chatWorkspaceState';

function getPayloadItems(state) {
  if (state?.type === 'files') return Array.isArray(state.payload?.attachments) ? state.payload.attachments : [];
  if (state?.type === 'artifact') return Array.isArray(state.payload?.plan?.steps) ? state.payload.plan.steps : [];
  return [];
}

export default function ChatWorkspacePanel({ onClose, onOpenInCopilot }) {
  const [state, setState] = useState(() => readWorkspaceState());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = (event) => setState(event?.detail || readWorkspaceState());
    window.addEventListener('ai_dost_chat_workspace', sync);
    const handleStorage = (event) => {
      if (event.key === CHAT_WORKSPACE_KEY) setState(readWorkspaceState());
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('ai_dost_chat_workspace', sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  if (!state?.open) return null;

  const plan = state.payload?.plan;
  const steps = getPayloadItems(state);
  const artifact = state.type === 'artifact' && state.source === 'chat-response' ? state.payload : null;

  const close = () => {
    clearWorkspaceState();
    onClose?.();
  };

  return (
    <aside
      className="w-full lg:w-[380px] xl:w-[430px] h-full shrink-0 border-l border-border bg-canvas-surface flex flex-col overflow-hidden"
      aria-label="AI-Dost workspace"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">Workspace</div>
          <h2 className="text-sm font-semibold text-paper-100 truncate">{state.title || 'AI-Dost Workspace'}</h2>
        </div>
        <button type="button" onClick={close} className="p-1.5 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated" aria-label="Close workspace">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {plan && (
          <section className="rounded-xl border border-border bg-canvas-elevated p-3">
            <div className="flex items-center gap-2 mb-2 text-paper-100">
              <ListChecks className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold">Task plan</span>
            </div>
            <p className="text-sm text-paper-100 leading-relaxed">{plan.intent?.label || plan.intent?.target || 'Planned task'}</p>
            {steps.length > 0 && (
              <ol className="mt-3 space-y-2">
                {steps.map((step, index) => (
                  <li key={`${index}-${step}`} className="flex gap-2 text-xs text-ink-muted">
                    <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center shrink-0 text-[10px] text-accent">{index + 1}</span>
                    <span className="pt-0.5">{step?.label || step?.title || step}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {state.type === 'files' && (
          <section className="rounded-xl border border-border bg-canvas-elevated p-3">
            <div className="flex items-center gap-2 mb-3 text-paper-100">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold">Files in context</span>
            </div>
            <div className="text-xs text-ink-muted">{state.payload?.count || 0} selected file(s) are available to the current task.</div>
          </section>
        )}

        {artifact && (
          <section className="rounded-xl border border-border bg-canvas-elevated p-3">
            <div className="text-xs font-semibold text-paper-100">Artifact ready</div>
            <div className="mt-1 text-xs text-ink-muted">{artifact.language?.toUpperCase() || 'FILE'} • {artifact.code?.length || 0} characters</div>
            {onOpenInCopilot && (
              <button type="button" onClick={() => onOpenInCopilot(artifact)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black">
                Open in Copilot <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
