---
name: ai-dost-chat-widgets
description: >-
  Use this skill to create, modify, or inject custom interactive React components (widgets) into the AI-Dost Chat View.
---

# Chat Interactive Widgets Guide

AI-Dost can parse special JSON or Markdown blocks from the backend LLM responses and render them as interactive React components in the chat.

## How to Add a New Widget
1. Create your React component inside `frontend/components/chat/` (e.g., `ChatPollCard.jsx`).
2. Open `frontend/components/chat/ChatMessageContent.jsx`.
3. Locate the markdown block parsing logic (e.g., `if (part.language === 'quiz')`).
4. Add your new language keyword (e.g., `poll`) and instruct the parser to render your new component instead of a standard code block.
5. In the backend prompt engineering logic, instruct the LLM to output \`\`\`poll ... \`\`\` blocks when it wants to trigger your widget.
