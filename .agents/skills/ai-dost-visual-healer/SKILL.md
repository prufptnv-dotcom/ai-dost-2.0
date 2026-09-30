---
name: ai-dost-visual-healer
description: >-
  Use this skill to debug or expand the autonomous Visual Healer capabilities and DOM anomaly detection within the AI-Dost IDE.
---

# Visual Healer Guide

The Visual Healer runs inside the `VisualDebugger.jsx` and `VisualHealer.jsx` components, capturing DOM errors and layout anomalies from the sandboxed iframe preview.

## Architecture
1. **Telemetry Capture:** `captureIframeRuntimeErrors` hooks into `window.onerror`.
2. **DOM Scan:** Searches for elements overflowing the viewport or buttons with zero opacity.
3. **Healing Loop:** `runSelfHealLoop` communicates with the backend `visualRepair.js` to patch source files automatically.

## Debugging
If the Visual Healer is stuck in an infinite loop, check the `maxAttempts` configuration. To add new visual checks, append logic to the layout scanning utility functions.
