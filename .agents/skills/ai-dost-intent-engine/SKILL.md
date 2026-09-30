---
name: ai-dost-intent-engine
description: >-
  Use this skill to update the Universal Intent Engine for voice commands, navigation shortcuts, and theme switching in AI-Dost.
---

# Universal Intent Engine Guide

AI-Dost parses incoming natural language to automatically route the user to the correct UI View or trigger a system action (like toggling Dark Mode).

## Modifying Intents
1. Open `frontend/components/chat/universalIntent.js`.
2. You will find a constant array `VIEW_ALIASES` mapping internal `view` IDs to arrays of `words` (nouns) and `actions` (verbs).
3. Add your new view or modify existing keywords.
4. For deeper system commands (like Dark Mode), scroll down to the `classifyUniversalIntent(input)` function and add your Regex matching logic.
5. Always ensure your Regex is case-insensitive `/i` and uses proper boundary markers `\b`.
