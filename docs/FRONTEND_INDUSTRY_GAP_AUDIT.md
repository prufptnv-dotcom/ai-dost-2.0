# AI-Dost Frontend Industry-Grade Gap Audit

**Date:** 2026-09-03  
**Status:** COMPLETE (Audit Only — Zero Implementation)  
**Product Principle:** "Simple Chat Outside, Autonomous System Inside"  
**Chat UI Architecture:** FROZEN  
**Core Architecture:** FROZEN  

---

## Executive Summary

This document establishes a rigorous, industry-grade audit of all 48 UI/UX surfaces of the AI-Dost frontend codebase. The inspection covers design tokens, component architecture, layout orchestration, accessibility compliance (WCAG 2.1 AA), responsive breakpoints, state handling, and interaction fidelity against modern AI platform benchmarks.

**Issue Breakdown:**
- **P0 (Broken / Unusable):** `0`
- **P1 (Major UX Problems):** `6`
- **P2 (Noticeable Polish Problems):** `14`
- **P3 (Micro-Polish Items):** `12`
- **Total Identified Gaps:** `32`

---

## A. Current Strengths

1. **Conversation-First Architecture:** The Chat interface adheres strictly to the "Simple Chat Outside" paradigm. It cleanly abstracts complex autonomous agent pipelines, document generation, image synthesis, and coding tasks into clean natural dialogue with Hinglish intent recognition.
2. **Robust Content Sanitization & Code Highlighting:** Markdown parsing via `marked` combined with strict `DOMPurify` prevents XSS vulnerabilities across streaming AI responses. `CodeBlock.jsx` provides custom syntax tokenization, output folding, and single-click clipboard copying.
3. **High-Density Dark Bento Aesthetic:** The core dark theme tokens (`tokens.css`) provide an appealing, cyber-operational visual identity with Void Black (`#0a0a0b`), subtle card elevations, and crisp Bioluminescent Lime (`#d9ff5a`) / Cyber Rust (`#ff4d12`) accents.
4. **Autonomous Agent Transparency:** When activated, `AgentView.jsx` exposes execution state through an 8-stage autonomy pipeline, activity timelines, workspace diff panels, and role hierarchies without overwhelming the primary conversation flow.
5. **Interactive Artifact Sandboxing:** `ChatArtifactsCanvas.jsx` safely mounts generated HTML, XML, and SVG artifacts in isolated iframes, providing instant visual feedback for generated UI components.
6. **Zero-Latency Keyboard Shortcuts:** Global listeners in `dashboard.jsx` bind `Ctrl+K`, `Ctrl+N`, and `Ctrl+1..5` for rapid keyboard navigation across workspace modules.

---

## B. P0 Issues (Broken / Unusable)

*None identified.* The application builds cleanly, routes between views without unhandled runtime exceptions, and executes core flows without fatal crashes.

---

## C. P1 Issues (Major UX Problems)

### GAP-P1-01: Command Palette Lacks Up/Down Keyboard Navigation
- **File/Component:** `frontend/pages/dashboard.jsx` (lines 331–369)
- **Exact Issue:** The command palette modal binds `Enter` exclusively to `filteredActions[0].id`. There are no handlers for `ArrowDown` / `ArrowUp` to navigate list items. Users can only execute the first filtered match.
- **Why It Matters:** Users expect standard IDE/Spotlight navigation. Inability to arrow-down to select items breaks muscle memory and renders filtered choices beyond index 0 unreachable via keyboard.
- **Severity:** P1
- **Category:** INTERACTION / ACCESSIBILITY
- **Recommended Fix:** Implement active index state (`selectedIndex`), handle `ArrowUp`/`ArrowDown` with wrap-around, and auto-scroll the active option into view.
- **Affects Frozen Chat Architecture:** NO

### GAP-P1-02: Native Blocking `window.confirm()` Used for Destructive Actions
- **File/Component:** `frontend/components/views/ProjectsView.jsx` (line 66), `frontend/components/views/HistoryView.jsx` (line 66), `frontend/components/views/SettingsView.jsx` (line 60)
- **Exact Issue:** Deleting projects, clearing conversation history, and resetting API settings trigger synchronous browser `window.confirm()` dialogs.
- **Why It Matters:** Browser-native dialogs block the JavaScript main thread, cannot be styled or themed, disrupt screen readers, break keyboard traps, and look unpolished in an enterprise-grade desktop app.
- **Severity:** P1
- **Category:** INTERACTION / VISUAL
- **Recommended Fix:** Replace `window.confirm()` calls with an accessible, themed confirmation modal dialog using `components/ui/Modal.jsx`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P1-03: Hardcoded Dark Colors Break Light Theme in Copilot IDE & Overlays
- **File/Component:** `frontend/components/views/IDEOverlays.jsx` (line 33, line 52), `frontend/components/views/CopilotIDE.jsx` (lines 96–100)
- **Exact Issue:** `IDEOverlays.jsx` applies hardcoded inline styles (`background: '#1c1f28'`, `border: '1px solid rgba(255,255,255,0.1)'`). `CopilotIDE.jsx` utilizes hardcoded Tailwind classes like `bg-zinc-900/90` and `border-zinc-800`.
- **Why It Matters:** When the user switches to Light Mode, these components remain dark, creating unreadable contrast, jarring borders, and broken aesthetics.
- **Severity:** P1
- **Category:** VISUAL / ACCESSIBILITY
- **Recommended Fix:** Refactor all hardcoded hex values and Tailwind zinc classes to design tokens (`var(--color-canvas-surface)`, `var(--color-border-default)`, `var(--color-text-primary)`).
- **Affects Frozen Chat Architecture:** NO

### GAP-P1-04: Duplicate Font Declarations Cause FOUT and Redundant Network Overhead
- **File/Component:** `frontend/styles/globals.css` (lines 1–2, lines 7–63)
- **Exact Issue:** `globals.css` imports Google Fonts via `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono...&family=Plus+Jakarta+Sans...')` AND defines local `@font-face` blocks for Sora, Inter, and JetBrains Mono from `/fonts/`.
- **Why It Matters:** External Google Fonts block initial stylesheet rendering, create layout shifts (FOUT/FOIT), and violate offline-first desktop resilience if internet is limited.
- **Severity:** P1
- **Category:** PERFORMANCE
- **Recommended Fix:** Remove external `@import url('https://fonts.googleapis.com...')` and rely strictly on self-hosted `/fonts/` with `font-display: swap`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P1-05: Touch Targets on Mobile Below Recommended 44×44px Minimum
- **File/Component:** `frontend/components/layout/CommandRail.jsx` (lines 58–80), `frontend/styles/chat-ux.css` (lines 17–18)
- **Exact Issue:** Bottom rail action buttons (`History`, `Settings`, `Theme Toggle`) and chat response action buttons (`Copy`, `TTS`, `Regenerate`) have touch dimensions of 30×30px or 32×32px.
- **Why It Matters:** Mobile touch targets under 44×44px (Apple HIG / WCAG 2.5.5 Target Size) cause mis-taps and frustrating mobile ergonomics.
- **Severity:** P1
- **Category:** MOBILE / ACCESSIBILITY
- **Recommended Fix:** Increase touch hit-box to minimum 44×44px on viewport `< 640px` using padding or pseudo-elements (`::after`).
- **Affects Frozen Chat Architecture:** NO

### GAP-P1-06: Missing Global Offline & Network Disconnection State Indicator
- **File/Component:** `frontend/components/layout/AppShell.jsx`, `frontend/services/api.js`
- **Exact Issue:** The frontend registers a service worker (`sw.js`) but lacks a UI banner or indicator when `navigator.onLine === false` or when the backend server (`:5000`) becomes unreachable.
- **Why It Matters:** Users attempting to chat or run agent actions during a server disconnect receive silent failures or generic raw Axios errors without clear guidance.
- **Severity:** P1
- **Category:** FUNCTIONAL / CONTENT
- **Recommended Fix:** Add a top-level subtle connectivity status bar in `AppShell` that alerts users when offline or disconnected from the backend.
- **Affects Frozen Chat Architecture:** NO

---

## D. P2 Issues (Noticeable Polish Problems)

### GAP-P2-01: Conflicting Design Token Palettes in `globals.css` vs `tokens.css`
- **File/Component:** `frontend/styles/globals.css` (lines 71–91) vs `frontend/styles/tokens.css` (lines 20–42)
- **Exact Issue:** `globals.css` defines `--color-primary` as `#d45b3f` (terracotta rust), whereas `tokens.css` defines `--primary-lime` as `#d9ff5a` (bioluminescent lime). Depending on cascade order, accent highlights display inconsistent tints.
- **Severity:** P2 | **Category:** VISUAL
- **Recommended Fix:** Consolidate tokens into `tokens.css` as single source of truth; remove conflicting variable declarations from `globals.css`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-02: Absence of Skeleton Loaders Across Shelf & History Views
- **File/Component:** `frontend/components/views/ProjectsView.jsx` (line 78), `frontend/components/views/HistoryView.jsx` (line 58), `frontend/components/views/ArtifactsView.jsx` (line 78)
- **Exact Issue:** Initial loading states render plain text (`Loading shelf artifacts...` or `Loading...`) instead of skeleton cards or shimmering rows.
- **Severity:** P2 | **Category:** VISUAL / PERFORMANCE
- **Recommended Fix:** Create a reusable `SkeletonRow` / `SkeletonCard` component with subtle shimmer animation.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-03: Raw HTML Elements Duplicated Instead of Using Reusable UI Primitives
- **File/Component:** `frontend/pages/dashboard.jsx` (lines 401–421), `frontend/components/McpPanel.jsx`, `frontend/components/views/SettingsView.jsx`
- **Exact Issue:** Views construct ad-hoc `<input className="...">` and `<button className="...">` elements instead of consuming `components/ui/Input.jsx` and `components/ui/Button.jsx`.
- **Severity:** P2 | **Category:** CONSISTENCY
- **Recommended Fix:** Migrate ad-hoc forms to `Input` and `Button` primitives to ensure consistent focus rings, hover states, and disabled behaviors.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-04: Multi-Column Views Squish on Medium/Small Viewports
- **File/Component:** `frontend/components/views/AgentView.jsx`, `frontend/components/views/ResumeView.jsx`
- **Exact Issue:** On viewports between 640px and 1024px, 3-column splits (Agent tree, active work panel, timeline) and 2-column splits (Resume form and live preview) compress into narrow unreadable columns without wrapping or tabbed toggling.
- **Severity:** P2 | **Category:** RESPONSIVE
- **Recommended Fix:** Introduce responsive breakpoints that collapse side-by-side panels into tabs or stacked drawers below 1024px.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-05: Toast Notifications Collide with Viewports and Lack Dismiss Action
- **File/Component:** `frontend/pages/dashboard.jsx` (lines 291–311)
- **Exact Issue:** Toasts stack at `fixed bottom-4 right-4` without a close ("X") button and overlap mobile navigation bars or bottom-docked inputs.
- **Severity:** P2 | **Category:** INTERACTION / RESPONSIVE
- **Recommended Fix:** Add close button, support swipe-to-dismiss, and offset toast container above bottom mobile bars on `< 640px`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-06: VoiceView Lacks Graceful Fallback for Unsupported Speech Recognition
- **File/Component:** `frontend/components/views/VoiceView.jsx` (lines 20–35)
- **Exact Issue:** If Web Speech API is blocked or unsupported (Brave, Firefox, Safari desktop), the listening state fails silently without showing a compatibility warning.
- **Severity:** P2 | **Category:** FUNCTIONAL
- **Recommended Fix:** Detect `window.SpeechRecognition || window.webkitSpeechRecognition` on mount; display informative banner if unavailable.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-07: HistoryView Lacks Per-Session Deletion
- **File/Component:** `frontend/components/views/HistoryView.jsx` (lines 65–75)
- **Exact Issue:** Users can only clear *all* history via `clearHistory()`. There is no option to delete a single conversation thread.
- **Severity:** P2 | **Category:** FUNCTIONAL
- **Recommended Fix:** Add a per-session delete icon button with single-item deletion endpoint call.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-08: Artifact Shelf Lacks Instant In-App Modal Preview
- **File/Component:** `frontend/components/views/ArtifactsView.jsx` (lines 13–15)
- **Exact Issue:** Clicking an artifact triggers an external download or open tab rather than an in-app visual preview modal for PDFs, sheets, or code.
- **Severity:** P2 | **Category:** INTERACTION
- **Recommended Fix:** Implement an in-app preview drawer/modal displaying rendered tables for CSV/XLSX and code preview for text files.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-09: SettingsView Lacks "Test Connection" Verification for API Keys
- **File/Component:** `frontend/components/views/SettingsView.jsx` (lines 43–57)
- **Exact Issue:** API keys are saved to `localStorage` without a ping/validation check to verify if the key is active or quota-limited.
- **Severity:** P2 | **Category:** INTERACTION
- **Recommended Fix:** Add an optional "Verify Key" button that pings `/api/health` or validates Gemini/Groq credentials.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-10: Autonomous Agent Lacks Persistent Global Badge When Awaiting User Approval
- **File/Component:** `frontend/components/layout/CommandRail.jsx`, `frontend/components/views/AgentView.jsx`
- **Exact Issue:** When the agent enters `waiting_for_user` state (tool confirmation or diff review), leaving `AgentView` hides the status. CommandRail shows no alert badge.
- **Why It Matters:** Users switching back to Chat or Projects have no ambient signal that the autonomous agent is blocked waiting for user approval.
- **Severity:** P2 | **Category:** INTERACTION
- **Recommended Fix:** Expose agent status globally via `ModeContext` or custom event; render an ambient pulse dot on the Agent icon in `CommandRail`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-11: Dashboard Inline Modals Bypass Shared Modal Component & Lack Focus Trap
- **File/Component:** `frontend/pages/dashboard.jsx` (lines 388–424)
- **Exact Issue:** "New Project" modal is coded directly in `dashboard.jsx` with Framer Motion without focus trapping, while `components/ui/Modal.jsx` already provides accessible dialog structures.
- **Severity:** P2 | **Category:** ACCESSIBILITY / CONSISTENCY
- **Recommended Fix:** Refactor `dashboard.jsx` project modal to consume `components/ui/Modal.jsx`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-12: Missing `prefers-reduced-motion` Accessibility Respect
- **File/Component:** `frontend/styles/globals.css`, `frontend/components/views/ChatView.jsx`
- **Exact Issue:** Framer Motion transitions and CSS animations (`thinking-pulse`, `pulse`) trigger continuously without checking `@media (prefers-reduced-motion: reduce)`.
- **Severity:** P2 | **Category:** ACCESSIBILITY
- **Recommended Fix:** Add global CSS media query to disable transitions when user requests reduced motion; use Framer Motion's `useReducedMotion()`.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-13: McpPanel Connectors Display Hardcoded Mock Status
- **File/Component:** `frontend/components/McpPanel.jsx` (lines 21–27)
- **Exact Issue:** MCP servers default to `status: 'Connected'` in `localStorage` regardless of whether backend MCP daemon or stdio process is running.
- **Severity:** P2 | **Category:** FUNCTIONAL
- **Recommended Fix:** Connect status checks to backend `GET /api/figma/health` or MCP health route.
- **Affects Frozen Chat Architecture:** NO

### GAP-P2-14: Inconsistent Visual Focus Rings Across Interactive Elements
- **File/Component:** `frontend/styles/globals.css`, `frontend/components/ui/Button.jsx`
- **Exact Issue:** Interactive elements use varying focus styles (`outline-none`, `focus:border-accent-primary`, or no focus outline). Keyboard tab navigation is hard to follow.
- **Severity:** P2 | **Category:** ACCESSIBILITY
- **Recommended Fix:** Define a unified `:focus-visible` ring token (`2px solid var(--color-border-focus)`) in `globals.css`.
- **Affects Frozen Chat Architecture:** NO

---

## E. P3 Issues (Micro-Polish Items)

1. **GAP-P3-01: Icon Sizing Inconsistency:** Lucide icon sizes range arbitrarily between 14px, 15px, 16px, 18px, and 20px across adjacent action strips. Standardize to 14px (compact), 16px (default), and 20px (prominent).
2. **GAP-P3-02: Header Action Alignment:** `ProjectsView`, `ArtifactsView`, and `HistoryView` headers vary slightly in vertical padding (`pb-4` vs `pb-3`).
3. **GAP-P3-03: Tooltip Delays in CommandRail:** CommandRail icons lack hover delay timers, causing instantaneous browser tooltips to flash during cursor pass-through.
4. **GAP-P3-04: Chat Response Action Button Visibility on Touch Devices:** Response actions (`Copy`, `TTS`, `Feedback`) rely on `.group:hover`, remaining hidden on touch screens unless tapped twice.
5. **GAP-P3-05: Missing Audio Playback State Indicators:** In `ChatView`, clicking TTS lacks an audio frequency wave or active pulse to indicate speech is playing.
6. **GAP-P3-06: VoiceView Transcript Export:** Voice studio lacks an action button to copy the whole conversation transcript with one click.
7. **GAP-P3-07: OS-Adaptive Keyboard Hints:** Command Palette shows `Ctrl K` on both macOS and Windows. Should detect `navigator.platform` and display `⌘K` on Mac.
8. **GAP-P3-08: Code Block Output Line Numbers:** The terminal/output drawer under `CodeBlock.jsx` lacks optional line numbers for long log outputs.
9. **GAP-P3-09: Typewriter Speed Tuning:** Chat response typewriter interval (7ms) is hardcoded without option for instant display in settings.
10. **GAP-P3-10: Lightbox Touch Zoom:** `ImageLightbox.jsx` handles desktop click-to-zoom but lacks pinch-to-zoom gestures on touch viewports.
11. **GAP-P3-11: Empty State Graphic Personality:** `EmptyState.jsx` renders neutral icons in dashed boxes; subtle thematic gradients would enhance delight without clutter.
12. **GAP-P3-12: Active View Indicator in CommandRail:** Active view icon in `CommandRail` lacks an active vertical bar indicator on its left edge.

---

## F. Missing Micro-Interactions

- **Hover Micro-Lifts:** Cards in `ProjectsView` and `ArtifactsView` lack subtle `translateY(-1px)` lift transitions on hover.
- **Button Press Feedback:** Several buttons lack active press scale-down (`active:scale-[0.98]`).
- **Smooth Tab Transitions:** Switching between Workbench, Kanban, and Spec Wizard in `AgentView` occurs instantly without layout fade.
- **Copy Success Micro-Confirmation:** While code blocks show checkmarks, some action buttons lack smooth icon morphing.

---

## G. Missing States

- **Network Offline Banner:** No persistent banner when internet drops.
- **Session Loading Shimmer:** History list shows raw "Loading..." instead of animated rows.
- **Form Validation States:** Project creation and MCP form inputs lack inline validation error text (e.g. "Project name cannot contain special characters").
- **Agent Stalled State:** If an agent run exceeds timeout without SSE events, it remains in "working" state rather than signaling a warning.

---

## H. Accessibility Gaps (WCAG 2.1 AA)

- **Focus Trapping:** Custom modals in `dashboard.jsx` and `CopilotIDE.jsx` do not trap focus within dialog boundaries.
- **ARIA Live Regions:** AI streaming responses lack `aria-live="polite"` for screen readers to announce progressive completions.
- **Color-Only Error Indicators:** Some form validation or signal badges rely purely on color (orange/red) without accompanying text or icons.
- **Keyboard Tab Index:** File tree items in `CopilotIDE` lack proper `role="tree"` and `role="treeitem"` ARIA attributes.

---

## I. Responsive Gaps

- **Narrow Mobile (<380px):** Chat composer button strip wraps awkwardly if multiple action icons are rendered.
- **Tablet Split-Pane (768px - 1024px):** Agent Workbench 3-pane layout becomes too narrow to read file diffs.
- **Landscape Phone (640px height):** Modals exceed vertical viewport height because max-height is set to 90vh without internal scroll constraints.

---

## J. Theme Gaps

- Hardcoded colors in `IDEOverlays.jsx` (`#1c1f28`, `rgba(255,255,255,0.1)`).
- Hardcoded Tailwind zinc classes in `CopilotIDE.jsx`.
- Conflicting `--color-primary` values between `globals.css` and `tokens.css`.

---

## K. Performance UX Gaps

- Redundant Google Fonts external network fetch in `globals.css`.
- Missing debounce on search inputs in `HistoryView` and `QuickOpen`.
- Monaco Editor re-mounts on view switches instead of preserving instance state in background.

---

## L. Mobile UX Gaps

- Minimum touch target sizing (<44px) on CommandRail bottom icons and chat action buttons.
- Mobile drawer in AppShell has basic slide-in; swipe-to-close gesture is missing.
- Toast notifications collide with the virtual keyboard on mobile devices.

---

## M. Consistency Gaps

- Mixed usage of shared UI components (`Button`, `Input`, `Modal`) vs raw HTML tags.
- Inconsistent modal backdrops (`bg-black/60` vs `bg-black/70` vs `bg-black/50`).
- Divergent border radius standards (`rounded-xs` vs `rounded-sm` vs `rounded-xl`).

---

## N. Recommended Implementation Order

To execute the polish systematically without destabilizing core or chat architectures, work must proceed across 7 disciplined phases:

```
[Phase F1: Foundations]   ──> Clean tokens, fix fonts, unify focus rings
       │
[Phase F2: States]        ──> Skeleton loaders, offline banner, error boundaries
       │
[Phase F3: A11y]          ──> Command palette keyboard navigation, focus traps, aria-live
       │
[Phase F4: Mobile]        ──> 44px touch targets, mobile drawer gesture, toast repositioning
       │
[Phase F5: Surfaces]      ──> Replace window.confirm, theme fixes in IDE overlays, in-app preview
       │
[Phase F6: Micro-Polish]  ──> Active rail indicators, button press scales, OS-adaptive kbd
       │
[Phase F7: Visual QA]     ──> Cross-theme audit (Dark/Light), viewport stress-test (320px to 4K)
```
