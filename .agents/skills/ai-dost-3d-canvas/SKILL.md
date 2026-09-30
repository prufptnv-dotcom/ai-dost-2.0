---
name: ai-dost-3d-canvas
description: >-
  Use this skill when you need to add or modify 3D WebGL animations and interactive canvas presets for the AI-Dost Animation Studio.
---

# 3D Animation & WebGL Guide

AI-Dost uses Three.js and Anime.js to render 3D scenes directly in the browser.

## Adding a New 3D Preset
1. Open `frontend/lib/threeJsTemplates.js`.
2. Create a new function (e.g. `get3DWormholeHtml()`) that returns the HTML/JS string containing a complete Three.js scene setup.
3. Add a regex matcher in the main exported function (e.g. `getFuturistic2030Html()`) to map user keywords (e.g., "wormhole") to your new function.
4. Open `frontend/components/views/AnimationStudioView.jsx`.
5. Add your new function to the imports and append an object describing your preset to the `PRESETS` array.
