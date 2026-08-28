import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { Eye, Sparkles, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

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

    // 1. Capture Client-Side Screenshot Base64
    let screenshotBase64 = null;
    try {
      const canvas = await html2canvas(iframeDoc.body, {
        useCORS: true,
        logging: false,
        scale: 1
      });
      screenshotBase64 = canvas.toDataURL('image/png');
    } catch (_) {}

    // 2. Extract Layout Metrics & DOM Errors
    const computedErrors = [];
    const elements = iframeDoc.querySelectorAll('*');
    
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
      
      // Detect horizontal layout overflow
      if (parentRect && rect.right > parentRect.right + 4 && rect.width > 20) {
        computedErrors.push({
          tag: el.tagName.toLowerCase(),
          className: (el.className || '').toString().slice(0, 50),
          issue: 'Horizontal overflow / clipping detected'
        });
      }
    });

    return {
      success: true,
      screenshot: screenshotBase64,
      layoutAnomalies: computedErrors.slice(0, 5),
      domState: iframeDoc.body.innerHTML.slice(0, 1500)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default function VisualDebugger({ iframeRef, onTriggerFix, isRepairing }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);

  const handleInspect = async () => {
    setAnalyzing(true);
    const result = await capturePreviewVisualState(iframeRef?.current);
    setReport(result);
    setAnalyzing(false);
  };

  const handleFix = () => {
    if (!report || !onTriggerFix) return;
    const prompt = `Fix visual and layout anomalies in preview: ${
      report.layoutAnomalies && report.layoutAnomalies.length > 0 
        ? JSON.stringify(report.layoutAnomalies) 
        : 'Optimize responsive alignment, contrast, and spacing.'
    }`;
    onTriggerFix(prompt);
  };

  return (
    <div className="p-3 bg-[#090a0f]/90 border border-white/[0.08] rounded-xl text-xs space-y-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-neutral-200 font-medium">
          <Eye className="w-3.5 h-3.5 text-sky-400" />
          <span>Visual QA Auto-Debugger</span>
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
          {report.layoutAnomalies && report.layoutAnomalies.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-amber-400 text-[11px]">
                <AlertCircle className="w-3 h-3" />
                <span>{report.layoutAnomalies.length} layout anomalies detected:</span>
              </div>
              <ul className="text-[10.5px] font-mono text-neutral-400 bg-[#0f1117] p-2 rounded border border-white/[0.04] space-y-1 max-h-24 overflow-y-auto">
                {report.layoutAnomalies.map((a, i) => (
                  <li key={i} className="truncate">
                    <span className="text-sky-400">&lt;{a.tag}&gt;</span>: {a.issue}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleFix}
                disabled={isRepairing}
                className="w-full mt-2 px-3 py-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-1.5 shadow-glow-sm transition-all"
              >
                <Sparkles className="w-3 h-3" />
                <span>{isRepairing ? 'Synthesizing Fix...' : 'Self-Heal Visual Bugs'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Layout clean — No visual clipping or overflow detected!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
