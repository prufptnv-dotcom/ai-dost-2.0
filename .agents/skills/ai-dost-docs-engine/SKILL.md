---
name: ai-dost-docs-engine
description: >-
  Use this skill to update or debug the Document Engine which generates PDF, DOCX, PPTX, CSV, and XLSX files in AI-Dost.
---

# Document Engine Guide

The document generator is responsible for serving files based on user prompts.

## Key Files
- `backend/routes/documents.js`: Contains all generation logic, fallback templates, and keyword matchers.
- `frontend/public/downloads/`: Output directory where files are served from.

## Updating `DOC_KEYWORDS`
If you need to add a new document type (e.g. `.md`), you must:
1. Update `DOC_KEYWORDS` or Regex logic in the frontend (`frontend/components/views/ChatView.jsx` or similar).
2. Add a generation endpoint/handler in `backend/routes/documents.js`.

## Validation
Always ensure that generated documents are saved in the `downloads/` directory and that the API returns a valid URL starting with `/downloads/`.
