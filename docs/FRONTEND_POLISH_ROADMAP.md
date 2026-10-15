# AI-Dost Frontend Polish Roadmap

**Date:** 2026-09-03  
**Status:** PLANNING ONLY (No Code Changes Implemented Yet)  
**Philosophy:** "Simple Chat Outside, Autonomous System Inside"  
**Chat UI Architecture:** FROZEN  
**Core Architecture:** FROZEN  

---

## Roadmap Overview

This roadmap defines the structured implementation plan for elevating the AI-Dost frontend to an industry-grade developer platform benchmark. The work is partitioned into 7 sequential, non-breaking phases.

```
PHASE F1: Interaction Foundations  ──> Design tokens, font performance, focus standards
PHASE F2: States & Feedback        ──> Skeleton loaders, offline indicator, validation feedback
PHASE F3: Accessibility            ──> Command palette keyboard navigation, focus traps, ARIA
PHASE F4: Responsive / Mobile      ──> 44px touch targets, mobile drawer polish, toast stacking
PHASE F5: Advanced Surfaces        ──> Native dialog elimination, IDE light-mode tokenization
PHASE F6: Micro-Polish             ──> Active rail indicators, button press scales, OS shortcuts
PHASE F7: Final Visual QA          ──> Comprehensive cross-theme and cross-viewport verification
```

---

## PHASE F1 — Interaction Foundations

### Focus
Unify design tokens, eliminate external font blocking, and establish unified interaction primitives without touching chat or core backend logic.

### Exact Components
- `frontend/styles/tokens.css`
- `frontend/styles/globals.css`
- `frontend/components/ui/Button.jsx`
- `frontend/components/ui/Input.jsx`

### Exact Problems
1. Divergent primary color definitions between `globals.css` (`#d45b3f`) and `tokens.css` (`#d9ff5a`).
2. External Google Fonts `@import` in `globals.css` causing network latency and FOUT.
3. Inconsistent `:focus-visible` rings across interactive controls.
4. Divergent border radius scale between components (`rounded-xs` vs `rounded-sm` vs `rounded-xl`).

### Implementation Priority: HIGH

### Acceptance Criteria
- [ ] `tokens.css` is the sole authority for color, elevation, and typography tokens.
- [ ] External font imports removed; all fonts served locally from `/fonts/` with `font-display: swap`.
- [ ] Unified `:focus-visible` styling applied globally across all focusable elements.
- [ ] No regression in ChatView or AppShell layout.

---

## PHASE F2 — States & Feedback

### Focus
Introduce shimmering skeleton loaders, ambient connectivity indicators, and robust form validation feedback.

### Exact Components
- `frontend/components/ui/Skeleton.jsx` (New primitive)
- `frontend/components/layout/AppShell.jsx`
- `frontend/components/views/ProjectsView.jsx`
- `frontend/components/views/HistoryView.jsx`
- `frontend/components/views/ArtifactsView.jsx`

### Exact Problems
1. Plain text "Loading..." placeholders in Projects, History, and Artifact views.
2. Silent failures when backend (:5000) or internet connection is lost.
3. Lack of validation error text when creating projects with empty or illegal names.
4. No background notification when an autonomous agent is blocked awaiting user input.

### Implementation Priority: HIGH

### Acceptance Criteria
- [ ] `Skeleton` component displays shimmering placeholder rows for table and card views.
- [ ] Connectivity banner displays in `AppShell` if `navigator.onLine === false` or API calls return `ECONNREFUSED`.
- [ ] Inline validation displays on project and MCP configuration forms.
- [ ] Ambient pulse badge appears on CommandRail Agent icon when agent status is `waiting_for_user`.

---

## PHASE F3 — Accessibility (a11y)

### Focus
Achieve full keyboard navigability, focus trapping within dialogs, and screen reader announcements.

### Exact Components
- `frontend/pages/dashboard.jsx` (Command Palette & Modal)
- `frontend/components/ui/Modal.jsx`
- `frontend/components/views/ChatView.jsx`
- `frontend/components/views/CopilotIDE.jsx`

### Exact Problems
1. Command Palette cannot be navigated via `ArrowUp` / `ArrowDown` keys.
2. Modals allow focus to cycle into obscured background DOM elements.
3. Chat streaming text lacks `aria-live="polite"` regions for screen readers.
4. Missing `prefers-reduced-motion` detection in Framer Motion animations.

### Implementation Priority: HIGH

### Acceptance Criteria
- [ ] Command Palette supports seamless `ArrowUp` / `ArrowDown` / `Enter` / `Escape` navigation with wrap-around.
- [ ] All modals trap keyboard Tab navigation within dialog bounds.
- [ ] Screen readers receive live status announcements during AI streaming responses.
- [ ] When `prefers-reduced-motion` is active, all transitions reduce to instantaneous opacity changes.

---

## PHASE F4 — Responsive & Mobile

### Focus
Guarantee ergonomics and readability on touch devices and small viewports (320px – 768px).

### Exact Components
- `frontend/components/layout/CommandRail.jsx`
- `frontend/styles/chat-ux.css`
- `frontend/pages/dashboard.jsx` (Toast Container)
- `frontend/components/views/AgentView.jsx`
- `frontend/components/views/ResumeView.jsx`

### Exact Problems
1. Bottom rail buttons and chat action icons have hit targets under 44×44px.
2. Toasts at `bottom-4 right-4` collide with mobile bottom navigation bars and virtual keyboards.
3. Multi-pane layouts (Agent workbench 3-column split, Resume side-by-side) squish on mobile.
4. Mobile menu drawer lacks touch swipe gestures.

### Implementation Priority: MEDIUM

### Acceptance Criteria
- [ ] All interactive touch targets measure at least 44×44px on screens `< 640px`.
- [ ] Toasts offset above bottom navigation and support swipe-to-dismiss.
- [ ] Multi-column layouts in Agent and Resume collapse cleanly into segmented tabs on mobile viewports.
- [ ] Mobile navigation drawer closes cleanly with backdrop tap or escape key.

---

## PHASE F5 — Advanced Surfaces & Visual Consistency

### Focus
Eliminate unstyled browser-native dialogs, fix Light Theme contrast in developer views, and enable in-app document previews.

### Exact Components
- `frontend/components/views/ProjectsView.jsx`
- `frontend/components/views/HistoryView.jsx`
- `frontend/components/views/SettingsView.jsx`
- `frontend/components/views/IDEOverlays.jsx`
- `frontend/components/views/CopilotIDE.jsx`
- `frontend/components/views/ArtifactsView.jsx`

### Exact Problems
1. `window.confirm()` used for project deletion, history wiping, and settings reset.
2. Hardcoded dark colors (`#1c1f28`, `bg-zinc-900`) render IDE overlays illegible in Light Theme.
3. Artifact shelf requires external download to view generated sheets or documents.
4. History view lacks individual conversation thread deletion.

### Implementation Priority: MEDIUM

### Acceptance Criteria
- [ ] All destructive confirmations use an accessible, themed confirmation modal dialog.
- [ ] `CopilotIDE` and `IDEOverlays` switch seamlessly between Dark and Light token palettes.
- [ ] Artifact shelf allows immediate in-app modal preview for text, tables, and code.
- [ ] Individual sessions can be deleted from HistoryView.

---

## PHASE F6 — Micro-Polish

### Focus
Add subtle high-craft details, tactile feedback, and OS-native affordances.

### Exact Components
- `frontend/components/layout/CommandRail.jsx`
- `frontend/components/ui/Button.jsx`
- `frontend/pages/dashboard.jsx`
- `frontend/components/views/ImageView.jsx`
- `frontend/components/chat/CodeBlock.jsx`

### Exact Problems
1. Active view icon in CommandRail lacks a distinct indicator bar.
2. Interactive buttons lack tactile scale-down on click (`active:scale-[0.98]`).
3. Shortcut hints display `Ctrl K` on Mac instead of `⌘K`.
4. Image lightbox lacks pinch gestures on mobile.
5. Code block terminal output lacks line numbering.

### Implementation Priority: LOW

### Acceptance Criteria
- [ ] CommandRail displays a crisp accent indicator line next to the active workspace item.
- [ ] Buttons have subtle press feedback animations.
- [ ] Keyboard hints dynamically display `⌘` on macOS and `Ctrl` on Windows/Linux.
- [ ] Code block output drawer toggles line numbers for log inspection.

---

## PHASE F7 — Final Visual QA & Verification

### Focus
End-to-end multi-device and multi-theme verification across all 48 surfaces.

### Target Test Matrix
- **Themes:** Dark (Void Black Bento) and Light (Crisp Paper)
- **Viewports:**
  - Mobile (360×800, 390×844)
  - Tablet (768×1024, 820×1180)
  - Desktop (1280×800, 1920×1080, 2560×1440)
- **Browsers:** Chromium (Edge/Chrome), Gecko (Firefox), WebKit (Safari)
- **Accessibility:** Axe DevTools 0 critical/serious violations, full keyboard-only navigation pass.

### Acceptance Criteria
- [ ] Zero visual regressions in Chat, Agent, or Copilot IDE.
- [ ] Zero unhandled console warnings or accessibility violations.
- [ ] Complete architectural integrity preserved.
