import React, { useEffect, useState } from 'react';
import { Eye, Wrench, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { analyzeDocument, formatVisualRepairPrompt, initVisualHealer } from '../../utils/visualHealer';

/**
 * Capture visual DOM screenshot and analyze layout anomalies
 */
export async function capturePreviewVisualState(iframeElement) {
  try {
    if (!iframeElement) {
      return { success: false, error: 'Iframe element not found' };
    }
    const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow?.document;
    if (!iframeDoc || !iframeDoc.body) {
      return { success: false, error: 'Preview document not accessible' };
    }

    const domReport = analyzeDocument(iframeDoc);

    return {
      ...domReport,
      layoutAnomalies: domReport.findings || [],
      domState: iframeDoc.body.innerHTML.slice(0, 1500),
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default function VisualDebugger({ iframeRef, onTriggerFix, isRepairing }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const iframe = iframeRef?.current;
    if (!iframe) return undefined;
    let cleanup;
    const attach = () => {
      cleanup?.();
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc?.body) return;
      cleanup = initVisualHealer(iframeDoc, setReport);
    };
    if (iframe.contentDocument?.body) attach();
    iframe.addEventListener('load', attach);
    return () => {
      iframe.removeEventListener('load', attach);
      cleanup?.();
    };
  }, [iframeRef]);

  const handleInspect = async () => {
    setAnalyzing(true);
    const result = await capturePreviewVisualState(iframeRef?.current);
    setReport(result);
    setAnalyzing(false);
  };

  const handleFix = () => {
    if (!report || !onTriggerFix) return;
    onTriggerFix(formatVisualRepairPrompt(report));
  };

  return (
    <div className="p-3 bg-[#090a0f]/90 border border-white/[0.08] rounded-xl text-xs space-y-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-neutral-200 font-medium">
          <Eye className="w-3.5 h-3.5 text-sky-400" />
          <span>Zero-Token Visual QA</span>
        </div>
        <button
          onClick={handleInspect}
          disabled={analyzing}
          className="px-2 py-1 bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 rounded border border-white/[0.08] flex items-center gap-1 transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${analyzing ? 'animate-spin text-sky-400' : ''}`} />
          <span>{analyzing ? 'Scanning...' : 'Inspect UI'}</span>
        </button>
      </div>

      {report && (
        <div className="space-y-2 pt-1 border-t border-white/[0.06]">
          {report.findings && report.findings.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-amber-400 text-[11px]">
                <AlertCircle className="w-3 h-3" />
                <span>{report.findings.length} DOM anomalies detected:</span>
              </div>
              <ul className="text-[10.5px] font-mono text-neutral-400 bg-[#0f1117] p-2 rounded border border-white/[0.04] space-y-1 max-h-24 overflow-y-auto">
                {report.findings.map((a, i) => (
                  <li key={i} className="truncate">
                    <span className="text-sky-400">{a.type}</span>: {a.message}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleFix}
                disabled={isRepairing}
                className="w-full mt-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wrench className="w-3 h-3" />
                <span>{isRepairing ? 'Repairing preview...' : 'Repair preview issues'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>DOM clean — No deterministic layout issues detected.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
