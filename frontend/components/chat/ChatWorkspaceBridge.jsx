import { useEffect } from 'react';
import { createWorkspaceState, clearWorkspaceState, persistWorkspaceState } from './chatWorkspaceState';

const PLAN_EVENT = 'ai_dost_intent_plan';
const ATTACHMENTS_EVENT = 'ai_dost_composer_attachments';
const ARTIFACT_EVENT = 'ai_dost_artifact_ready';
const VIEW_EVENT = 'ai_dost_chat_workspace';

function planNeedsWorkspace(plan) {
  const type = plan?.intent?.type;
  const target = String(plan?.intent?.target || '').toLowerCase();
  return type === 'task' && /build|create|generate|analy[sz]e|file|document|pdf|code|project|artifact|image/.test(target);
}

export default function ChatWorkspaceBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const openForPlan = (event) => {
      const plan = event.detail?.plan;
      if (!planNeedsWorkspace(plan)) return;
      const state = createWorkspaceState({
        type: plan.context?.hasFiles ? 'files' : 'artifact',
        title: plan.intent?.label || plan.intent?.target || 'AI-Dost workspace',
        source: 'task-plan',
        payload: { taskId: event.detail?.taskId || null, plan },
      });
      persistWorkspaceState(state);
    };

    const openForAttachments = (event) => {
      const count = Array.isArray(event.detail?.attachments) ? event.detail.attachments.length : 0;
      if (count < 1) return;
      persistWorkspaceState(createWorkspaceState({
        type: 'files',
        title: `${count} file${count === 1 ? '' : 's'} in workspace`,
        source: 'composer',
        payload: { count },
      }));
    };

    const openForArtifact = (event) => {
      const artifact = event.detail?.artifact;
      if (!artifact) return;
      persistWorkspaceState(createWorkspaceState({
        type: 'artifact',
        title: artifact.title || 'Interactive Artifact',
        source: 'chat-response',
        payload: artifact,
      }));
    };

    const handleWorkspaceEvent = (event) => {
      if (event.detail === null) return;
    };

    window.addEventListener(PLAN_EVENT, openForPlan);
    window.addEventListener(ATTACHMENTS_EVENT, openForAttachments);
    window.addEventListener(ARTIFACT_EVENT, openForArtifact);
    window.addEventListener(VIEW_EVENT, handleWorkspaceEvent);

    return () => {
      window.removeEventListener(PLAN_EVENT, openForPlan);
      window.removeEventListener(ATTACHMENTS_EVENT, openForAttachments);
      window.removeEventListener(ARTIFACT_EVENT, openForArtifact);
      window.removeEventListener(VIEW_EVENT, handleWorkspaceEvent);
    };
  }, []);

  return null;
}
