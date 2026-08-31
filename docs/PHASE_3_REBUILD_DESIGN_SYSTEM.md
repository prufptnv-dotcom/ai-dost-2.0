# Phase 3 Rebuild — Editorial Workbench Design System

## 1. Design Philosophy: "Editorial Workbench"

AI-Dost v2.4 transitions away from the generic SaaS / AI-chatbot visual clichés (glowing neon bubbles, pulsing orbs, rainbow gradients, oversized rounded cards) to an **Editorial Workbench** — a personal computing workspace designed with quiet precision, technical density, and architectural confidence.

```
┌─────┬────────────────────────────────────────────────────────┐
│     │                                                        │
│  A  │                   WORKSPACE CANVAS                     │
│  I  │                                                        │
│     │            content / conversation / task               │
│─────│                                                        │
│  +  │                                                        │
│     │                                Context Inspector ───┐  │
│ nav │                                                     │  │
│     │                                                     │  │
└─────┴─────────────────────────────────────────────────────┴──┘
```

---

## 2. Semantic Color Palette

### 2.1 Dark Default (Ink & Paper)
- `--ink-950: #11100f` — Primary Canvas Background
- `--ink-900: #171614` — Subtle Surface / Code Block Background
- `--ink-850: #1e1c1a` — Interactive Surface & Cards
- `--ink-800: #262320` — Elevated Popovers & Focus States
- `--paper-100: #f4f0e8` — Primary High-Contrast Text
- `--paper-200: #ded8cc` — Secondary High-Contrast Text
- `--paper-300: #b7afa2` — Muted Metadata & Monospace Timestamps
- `--accent-primary: #d45b3f` — Signature Burnt Vermilion / Terracotta Brand Accent
- `--accent-primary-strong: #b8452f` — Active / Pressed Accent

### 2.2 Muted Signal / Status Tokens
- `--signal-success: #5c8b6b` — Verified / Passing Tests (Sage Green)
- `--signal-warning: #b78945` — Waiting for User / In-Flight Repair (Warm Amber)
- `--signal-error: #b9574e` — Test Failures / Blocked Execution (Terra Red)
- `--signal-info: #5d7895` — Codebase Search / Inspection (Steel Blue)

---

## 3. Typography Hierarchy

- **Display / Headings**: `Sora` (600/700 weight, tight tracking `-0.015em` to `-0.02em`).
- **Body & Controls**: `Inter` (400 regular, 500 medium, natural line-height).
- **Technical Data & Streams**: `JetBrains Mono` (file paths, tool outputs, execution durations, timestamps).

---

## 4. Geometry & Elevation

- **Controls & Inline Badges**: `2px - 4px` radius.
- **Panels & Textareas**: `6px` radius.
- **Modals & Command Surfaces**: `10px` radius.
- **Surfaces**: Flat surfaces separated by crisp 1px hairline dividers (`rgba(244, 240, 232, 0.09)`).
- **Shadows**: Pure physical drop shadows without colored neon glow.
