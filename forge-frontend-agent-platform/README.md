# Forge — autonomous website builder UI

A frontend-only React workspace prototype for an AI website builder. It includes a file explorer, code/preview/terminal views, responsive website preview controls, an assistant conversation panel, build-state feedback, deploy/share affordances, and a user-selectable accent palette (Violet, Ocean, Emerald, Rose, Amber, animated RGB Flow, or custom color). Theme choice is saved locally.

## Run it

```bash
npm install
npm run build
npm run preview
```

Open `http://localhost:5173`. The preview script serves the static `dist/` build; use your existing Node backend to serve `dist/` in the main project when integrating it.

## Backend integration

This project intentionally contains no server or invented API contract. The assistant chat, build, and deploy controls are UI demos; the assistant activity timeline is simulated client-side. Connect `submitPrompt`, `runBuild`, the Deploy button, and the timeline state to your existing backend responses or event stream to show real work. The UI is kept separate from backend code.
