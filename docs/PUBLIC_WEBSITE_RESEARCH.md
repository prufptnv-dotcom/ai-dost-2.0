# AI-Dost Public Website & Documentation Ecosystem Research

**Date:** 2026-09-03  
**Status:** COMPLETE (Architecture & Strategy Reference)  
**Product Principle:** "Simple Chat Outside. Autonomous System Inside."  

---

## 1. Research Sources & Benchmark Analysis

To build an authentic, credible, enterprise-grade public web presence for AI-Dost, we analyzed the public architecture, navigation models, positioning strategies, and trust frameworks of industry-defining AI and developer platforms:

| Company / Product | Primary Focus Analyzed | Key Architectural Takeaway |
|---|---|---|
| **OpenAI (ChatGPT / Platform)** | Capability presentation, Enterprise security, Frontier safety | Clear separation between consumer chat, platform capabilities, governance, and safety practices. Non-marketing technical documentation. |
| **Anthropic (Claude)** | Transparency, Constitutional AI, Privacy, System Cards | Prioritizes trust, alignment philosophy, model evaluation cards, and explicit data boundaries over hype. Minimalist editorial layout. |
| **Google Gemini** | Multimodal capability showcases, Workspace integration, Responsible AI | Demonstrates outcomes rather than technical plumbing. Clean white/dark neutral backdrops with high-contrast typography. |
| **Cursor** | Developer productivity, Local privacy, SOC 2 / Security FAQ | Transparent security architecture: explicitly clarifies indexed code retention, zero-data-retention agreements, and local indexing boundaries. |
| **Perplexity** | Conversational discovery, Source attribution, Clean typography | Demonstrates speed and citation integrity. Minimal chrome; the search/chat interaction is the hero. |
| **Linear** | Craft, Precision ergonomics, Keyboard-first philosophy | The gold standard for dark-mode product craft. Restrained animations, razor-sharp borders, subtle surface elevations, zero visual noise. |
| **Vercel** | Framework documentation, Edge architecture, Visual deployment flow | Documentation IA is master-class: clear sidebar hierarchy, interactive code blocks, instant search, zero-friction developer onboarding. |
| **Notion** | Outcome-driven feature pages, Team solutions, Template ecosystem | Features organized by what the user accomplishes rather than underlying software modules. |
| **Stripe** | Trust, Developer documentation, Interactive API references | Absolute benchmark for technical credibility: comprehensive guides, exhaustive parameter tables, clean code tabs, high-trust footer. |

---

## 2. Common Website Architecture Patterns Worth Adopting

1. **Editorial Restraint & Typography-First Hierarchy:**
   - Leading AI companies rely on confident, restrained typography (grotesque or geometric display headers paired with clean neutral body text and crisp mono accents) rather than flashy illustrations.
2. **Outcome-Oriented Capability Grouping:**
   - Instead of listing internal tool names (e.g. `read_file`, `grep_search`, `bash_exec`), mature products group capabilities by human goals: *Build*, *Research*, *Analyze*, *Verify*, *Create*.
3. **Transparent Execution Architecture:**
   - Explaining *how* an agent works (Intent → Context → Plan → Execution → Verification → Delivery) builds trust without exposing private chain-of-thought or raw system prompts.
4. **Dedicated Security & Privacy Substantiation:**
   - Trust pages must not be marketing fluff. They must state concrete controls: local file execution, sandbox boundaries, API credential handling, zero cloud telemetry.
5. **Separation of App Shell and Marketing Shell:**
   - The public website must have a dedicated marketing navigation and footer, never exposing the internal application CommandRail or workspace sidebars to public visitors.
6. **Documentation as a First-Class Knowledge System:**
   - Full two-column or three-column documentation layouts with clear hierarchy (Getting Started → Core Concepts → Agent Architecture → Guides → Security → Troubleshooting).

---

## 3. Patterns to Strictly Avoid (Anti-Patterns)

1. **AI Clichés & Neon Gradients:**
   - Avoid generic glowing purple/cyan nebulas, floating holographic robot heads, and random pulsating blobs that make projects look like student demo prototypes.
2. **Fabricated Certifications & False Metrics:**
   - Never claim "SOC 2 Type II Certified", "HIPAA Compliant", "Used by 500+ Fortune 500 Companies", or fake employee/funding statistics. Authenticity and transparency command respect.
3. **Feature Marketplace Clutter:**
   - Avoid presenting the product as 25 disconnected tools in a noisy dashboard grid. AI-Dost is *one unified autonomous agent* accessed through natural language.
4. **Exposing Chain-of-Thought:**
   - Public demos and architectural diagrams should illustrate the high-level autonomy pipeline, never internal hidden reasoning traces or raw internal prompt injections.
5. **Overwhelming Motion & Parallax:**
   - Avoid continuous infinite scroll-jacking, heavy 3D canvas libraries, or decorative animations that hurt battery life, degrade mobile performance, and violate reduced-motion preferences.

---

## 4. Recommended AI-Dost Website Architecture

```
/ (Home)                           ──> Core narrative, interactive workflow demo, outcomes, autonomy lifecycle, trust
├── /product                       ──> Deep dive into "Simple Chat Outside. Autonomous System Inside."
├── /capabilities                  ──> Outcome-driven capability matrix (Build, Analyze, Research, Create, Verify)
├── /how-it-works                  ──> Visual 8-stage autonomous execution pipeline and safety loop
├── /security                      ──> Local execution boundaries, role policies, sandbox isolation, credential safety
├── /privacy                       ──> Data retention, local SQLite storage, zero tracking, third-party LLM boundaries
├── /terms                         ──> Product terms of service, output ownership, acceptable use scaffolding
├── /policy                        ──> Responsible AI and platform safety guidelines
├── /about                         ──> Mission, engineering philosophy, open development principles
├── /changelog                     ──> Release history, architectural freeze, version progression
├── /support                       ──> Developer troubleshooting, GitHub issue routes, documentation index
└── /docs                          ──> Full documentation hub
    ├── /docs/getting-started      ──> Quickstart, prerequisites, first conversation
    ├── /docs/concepts             ──> Autonomy, workspace, context gathering, verification
    ├── /docs/agent                ──> The 8-stage execution engine and self-healing loop
    ├── /docs/projects             ──> Workspace isolation, persistent file systems, local memory
    ├── /docs/tools                ──> Tool execution rules, capabilities, and boundaries
    ├── /docs/security             ──> Capability policy, role matrix, credential defense
    └── /docs/troubleshooting      ──> Environment setup, Ollama fallback, diagnostics
```

---

## 5. Animation & Motion Principles

- **Purposeful, Not Decorative:** Motion must only exist to demonstrate system state progression (e.g. stepping through Intent → Plan → Execute → Verify) or enhance tactile feedback on user actions.
- **Micro-Durations:** UI transitions must complete between 120ms and 240ms using ease-out cubic curves.
- **Strict Reduced-Motion Respect:** Every transition must evaluate `@media (prefers-reduced-motion: reduce)` and gracefully fallback to instantaneous opacity switches.

---

## 6. Accessibility & Responsive Requirements (Target: WCAG 2.1 AA)

- **Semantic HTML5:** `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, and `<footer>` landmarks.
- **Keyboard Completeness:** Visible `:focus-visible` rings with at least 3:1 contrast against surface backgrounds.
- **Responsive Viewports:** Fluid testing matrix across 320px, 375px, 390px, 768px, 1024px, 1280px, and 1440px+.
- **Touch Target Minimums:** All interactive elements must maintain at least 44×44px touch targets on mobile viewports.

---

## 7. "Not Copied from Competitors" Design Identity

AI-Dost maintains its distinct **Bioluminescent Cyber-Editorial** identity:
- **Core Surfaces:** Void Black (`#0a0a0b`), Carbon Surface (`#151519`), Sub-surface (`#1c1c22`).
- **Accent Philosophy:** Bioluminescent Lime (`#d9ff5a`) and Cyber Rust (`#ff4d12`) used with laser discipline for active state signals and highlights only.
- **Typography:** Geometric display headings (`Sora`) paired with clean technical grotesk body text (`Inter`) and precision monospace (`JetBrains Mono`).
- **Composition:** Asymmetrical bento grids with crisp 1px borders (`rgba(255,255,255,0.08)`) and structured whitespace.
