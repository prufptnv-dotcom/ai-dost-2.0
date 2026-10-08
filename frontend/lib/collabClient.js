/**
 * collabClient — P8 multiplayer (frontend half).
 *
 * One Y.Doc + WebsocketProvider per project, connected to the backend's
 * `/yws/:projectId` upgrade route (y-websocket wire protocol, hand-served by
 * services/collabDoc.js). Monaco editors bind to per-file Y.Text keys
 * (`file:<relativePath>`).
 *
 * Initial-sync rule (syncInitialDecision) resolves the first-touch ambiguity:
 *   - doc empty, model has text        -> 'seed'   (client fills the doc)
 *   - doc has text, differs from model -> 'replace' (doc is the live truth)
 *   - same content                     -> 'noop'
 * This runs BEFORE MonacoBinding is constructed, so the binding never starts
 * from diverged states (y-monaco does not reconcile on construction).
 *
 * Awareness doubles as the presence strip: humans publish {name,color}, the
 * SERVER publishes the agent participant {name:'AI-Dost Agent',agent:true}
 * whenever the ReAct loop writes files (see services/collabDoc.js).
 */
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

const sessions = new Map(); // projectId -> { doc, provider }
const editorBindings = new WeakMap(); // editor -> MonacoBinding (current file)

const PEER_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

/** ws://…/yws — backend upgrade route (pure, unit-tested). */
export function collabWsUrl(backendBase) {
  const base = backendBase || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  return String(base).replace(/^http/, 'ws') + '/yws';
}

/** First-touch content decision (pure, unit-tested). */
export function syncInitialDecision(ytextStr, modelStr) {
  const y = typeof ytextStr === 'string' ? ytextStr : '';
  const m = typeof modelStr === 'string' ? modelStr : '';
  if (y === m) return 'noop';
  return y ? 'replace' : 'seed';
}

/** Lazily create/keep the shared doc + provider for a project (browser only). */
export function getCollab(projectId) {
  if (!projectId || typeof window === 'undefined') return null;
  const key = String(projectId);
  let session = sessions.get(key);
  if (session) return session;
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(collabWsUrl(), key, doc, { connect: true });
  // Default identity until CopilotIDE overrides it — deterministic per doc so
  // a reconnect keeps the same name/color.
  const color = PEER_COLORS[doc.clientID % PEER_COLORS.length];
  provider.awareness.setLocalState({ name: `Guest ${doc.clientID % 1000}`, color });
  session = { doc, provider };
  sessions.set(key, session);
  return session;
}

/**
 * Bind the editor's CURRENT model to `file:<filePath>`, reconciling initial
 * content first. Disposes any previous binding for this editor (file switch).
 * Returns the MonacoBinding (or null when nothing to bind).
 */
export function bindCurrentModel(projectId, editor, filePath) {
  try {
    if (!editor || !filePath) return null;
    const model = typeof editor.getModel === 'function' ? editor.getModel() : null;
    if (!model) return null;
    unbindCurrent(editor);
    const session = getCollab(projectId);
    if (!session) return null;
    const ytext = session.doc.getText(`file:${filePath}`);
    const modelValue = model.getValue();
    const decision = syncInitialDecision(ytext.toString(), modelValue);
    if (decision === 'seed') {
      ytext.insert(0, modelValue);
    } else if (decision === 'replace') {
      model.setValue(ytext.toString());
    }
    const binding = new MonacoBinding(ytext, model, new Set([editor]), session.provider.awareness);
    editorBindings.set(editor, binding);
    return binding;
  } catch (e) {
    console.warn('[collab] bind failed:', e.message);
    return null;
  }
}

/** Dispose the editor's active binding (file switch / unmount). */
export function unbindCurrent(editor) {
  if (!editor) return null;
  const prev = editorBindings.get(editor) || null;
  if (prev) {
    try { prev.dispose(); } catch (_) { /* already gone */ }
    editorBindings.delete(editor);
  }
  return prev;
}

/**
 * Subscribe to the presence list. cb receives
 * [{clientId, name, color, agent, editing, isSelf}]. Returns unsubscribe fn.
 */
export function subscribeParticipants(projectId, cb) {
  if (typeof cb !== 'function') return () => {};
  const session = getCollab(projectId);
  if (!session) {
    cb([]);
    return () => {};
  }
  const read = () => {
    try {
      const states = session.provider.awareness.getStates();
      const out = [];
      for (const [clientId, state] of states) {
        if (!state || typeof state !== 'object') continue;
        out.push({
          clientId,
          name: typeof state.name === 'string' ? state.name : 'Guest',
          color: typeof state.color === 'string' ? state.color : '#6366f1',
          agent: Boolean(state.agent),
          editing: typeof state.editing === 'string' ? state.editing : null,
          isSelf: clientId === session.doc.clientID,
        });
      }
      cb(out);
    } catch (_) {
      cb([]);
    }
  };
  session.provider.awareness.on('change', read);
  read();
  return () => {
    try { session.provider.awareness.off('change', read); } catch (_) { /* gone */ }
  };
}

/** Merge fields into this client's local awareness state (name/color/…). */
export function setLocalPresence(projectId, presence) {
  const session = getCollab(projectId);
  if (!session || !presence || typeof presence !== 'object') return;
  const current = session.provider.awareness.getLocalState() || {};
  session.provider.awareness.setLocalState({ ...current, ...presence });
}

/** Connection lifecycle: cb('connecting'|'connected'|'disconnected'). */
export function subscribeStatus(projectId, cb) {
  if (typeof cb !== 'function') return () => {};
  const session = getCollab(projectId);
  if (!session) return () => {};
  const handler = ({ status }) => cb(status);
  session.provider.on('status', handler);
  cb(session.provider.wsconnected ? 'connected' : 'connecting');
  return () => {
    try { session.provider.off('status', handler); } catch (_) { /* gone */ }
  };
}

/** Test/HMR seam — drop a project's session (closes the socket). */
export function destroySession(projectId) {
  const session = sessions.get(String(projectId));
  if (!session) return false;
  try { session.provider.destroy(); } catch (_) { /* already dead */ }
  try { session.doc.destroy(); } catch (_) { /* already dead */ }
  sessions.delete(String(projectId));
  return true;
}
