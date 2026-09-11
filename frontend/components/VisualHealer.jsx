// frontend/components/VisualHealer.jsx
import React, { useEffect, useRef, useCallback } from 'react';
import {
  initVisualHealer,
  captureIframeRuntimeErrors,
  getPendingSuggestions,
  getPendingEscalations,
  runSelfHealLoop,
  getMetrics,
} from '../utils/visualHealer';
import { useToast } from '../context/ToastContext';

export default function VisualHealer({ iframeRef, onFindings, onHealingComplete, projectId, viewport } = {}) {
  const { showToast } = useToast();
  const cleanupRef = useRef(null);
  const errorCleanupRef = useRef(null);
  const healingActiveRef = useRef(false);

  const rerenderPreview = useCallback(async () => {
    const iframe = iframeRef?.current;
    if (!iframe) return;
    try {
      if (iframe.src) {
        iframe.src = iframe.src.split('?')[0] + '?t=' + Date.now();
      }
    } catch (_) {}
    return new Promise(r => setTimeout(r, 300));
  }, [iframeRef]);

  useEffect(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (errorCleanupRef.current) {
      errorCleanupRef.current();
      errorCleanupRef.current = null;
    }

    if (iframeRef?.current) {
      const iframe = iframeRef.current;

      const handleLoad = () => {
        try {
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
          if (errorCleanupRef.current) {
            errorCleanupRef.current();
            errorCleanupRef.current = null;
          }
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc && iframeDoc.body) {
            cleanupRef.current = initVisualHealer(iframeDoc, (report) => {
              if (report?.findings?.length > 0) {
                const fixCount = report.autoFixes?.length || 0;
                const errCount = report.summary?.errors || 0;
                const warnCount = report.summary?.warnings || 0;
                const parts = [];
                if (errCount) parts.push(`${errCount} error${errCount > 1 ? 's' : ''}`);
                if (warnCount) parts.push(`${warnCount} warning${warnCount > 1 ? 's' : ''}`);
                if (fixCount) parts.push(`${fixCount} auto-fixed`);
                showToast({
                  type: fixCount > 0 ? 'success' : 'warning',
                  message: `Visual QA: ${parts.join(', ')}`,
                });
                if (onFindings) {
                  onFindings(report);
                }
              }
            });
            errorCleanupRef.current = captureIframeRuntimeErrors(iframe, (finding) => {
              showToast({ type: 'error', message: `Preview error: ${finding.message}` });
            });
          }
        } catch (_) {
          // Cross-origin or not yet ready
        }
      };

      if (iframe.contentDocument?.readyState === 'complete') {
        handleLoad();
      } else {
        iframe.addEventListener('load', handleLoad);
      }

      return () => {
        iframe?.removeEventListener?.('load', handleLoad);
        if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
        if (errorCleanupRef.current) { errorCleanupRef.current(); errorCleanupRef.current = null; }
      };
    }

    cleanupRef.current = initVisualHealer();
    return () => {
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    };
  }, [iframeRef, showToast, onFindings]);

  useEffect(() => {
    const interval = setInterval(() => {
      const suggestions = getPendingSuggestions();
      suggestions.forEach(s => {
        const msg = typeof s === 'string' ? s : s.message || JSON.stringify(s);
        showToast({ type: 'info', message: `Suggestion: ${msg}` });
      });
      const escalations = getPendingEscalations();
      escalations.forEach(f => {
        showToast({
          type: 'warning',
          message: `Vision escalation needed: ${f.message || f.type}`,
        });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [showToast]);

  const triggerHealing = useCallback(async (onSourceRepair) => {
    if (healingActiveRef.current) return null;
    healingActiveRef.current = true;

    try {
      const iframe = iframeRef?.current;
      if (!iframe) return null;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) return null;

      const result = await runSelfHealLoop({
        document: iframeDoc,
        onRerender: rerenderPreview,
        onSourceRepair: onSourceRepair || null,
        maxAttempts: 3,
        maxLoopMs: 15000,
        projectId,
        viewport
      });

      if (onHealingComplete) {
        onHealingComplete(result);
      }

      const metrics = getMetrics();

      // ── Phase 3: Vision escalation for uncertain findings ─────────────────────
      if (projectId && viewport && result.results) {
        const uncertainFindings = result.results.filter(r =>
          r.reason === 'UNCERTAIN_FINDING' ||
          r.reason === 'NO_SAFE_FIX_AVAILABLE' ||
          (r.state === 'STOP' && !result.success)
        );

        if (uncertainFindings.length > 0) {
          try {
            const healResp = await fetch(`http://localhost:5000/api/agent/heal`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                findings: uncertainFindings.map(f => ({
                  fingerprint: f.finding?.fingerprint || f.selector || f.type,
                  type: f.finding?.type || f.type || 'unknown',
                  selector: f.finding?.selector || f.selector || '',
                  severity: f.finding?.severity || f.severity || 'error',
                  confidence: f.finding?.confidence || f.confidence || 0,
                  geometry: f.finding?.evidence || {}
                })),
                viewport: viewport
              })
            });
            const healData = await healResp.json();

            if (healData?.phase2Outcome) {
              const outcomeMap = {
                CONFIRMED: 'Vision confirmed the issue — treat as repair candidate if safe strategy exists',
                REJECTED: 'Vision rejected the issue — do not repair; mark finding as rejected',
                UNCERTAIN: 'Vision could not confirm — stop; do not repair',
                ERROR: 'Vision analysis error — stop; use existing error handling'
              };
              showToast({
                type: 'warning',
                message: `Vision escalation: ${outcomeMap[healData.phase2Outcome] || healData.phase2Outcome}`
              });
            }

            if (healData?.screenshotBase64) {
              showToast({ type: 'info', message: 'Vision screenshot captured for review' });
            }
          } catch (err) {
            showToast({ type: 'error', message: 'Vision escalation failed' });
          }
        }
      }

      if (result.success) {
        showToast({
          type: 'success',
          message: `Self-healing complete in ${result.attempts} attempt(s) [${metrics.safeFixesVerified} verified]`
        });
      } else if (result.results?.some(r => r.reason === 'TIMEOUT' || r.reason === 'SCAN_BUDGET_EXCEEDED')) {
        showToast({ type: 'warning', message: 'Self-healing budget exceeded — manual review needed' });
      }

      return result;
    } finally {
      healingActiveRef.current = false;
    }
  }, [iframeRef, rerenderPreview, onHealingComplete, showToast, projectId, viewport]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__visualHealerTriggerHealing = triggerHealing;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__visualHealerTriggerHealing;
      }
    };
  }, [triggerHealing]);

  return null;
}
