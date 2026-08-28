/**
 * Backend Visual Fix Orchestrator & Layout Anomaly Analyzer
 */
function analyzeVisualBug({ userPrompt, layoutAnomalies = [], screenshotBase64 = null, currentFiles = [] }) {
  const anomaliesText = layoutAnomalies.length > 0 
    ? layoutAnomalies.map(a => `- Tag: <${a.tag}>, Class: "${a.className || ''}", Issue: ${a.issue}`).join('\n')
    : 'No structural DOM overflow; review CSS alignment, spacing tokens, and contrast.';

  const repairInstruction = `
Visual QA Inspector Report:
- Layout & Design Anomalies Detected:
${anomaliesText}

- User Prompt / Intended Design:
${userPrompt || 'Ensure clean glassmorphic dark UI with proper responsive container margins'}

Target Resolution:
1. Fix horizontal overflow by ensuring containers have proper max-w-full, overflow-x-hidden, or responsive flex-wrap.
2. Ensure consistent padding, modern font hierarchies, and Linear dark tokens (#090a0f, #161821).
3. Apply atomic surgical edits to affected component files.
`;

  return {
    action: 'apply_visual_patch',
    instruction: repairInstruction.trim(),
    anomaliesCount: layoutAnomalies.length
  };
}

module.exports = {
  analyzeVisualBug
};
