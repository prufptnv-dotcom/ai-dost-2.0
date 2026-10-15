# AI-Dost Public Product Positioning

**Date:** 2026-09-03  
**Status:** CANONICAL REFERENCE  
**Core Maxim:** "Simple Chat Outside. Autonomous System Inside."  

---

## 1. Canonical Statements

### One-Line Positioning
> **AI-Dost is an autonomous AI workspace that turns natural language requests into planned, executed, and verified results—without exposing complexity to the user.**

### Short Elevator Pitch
> Most AI assistants simply generate text and expect you to do the rest. AI-Dost works differently: you describe your objective in plain English or Hinglish, and AI-Dost autonomously formulates a multi-step plan, assembles project context, runs authorized tools, edits files, verifies correctness, and delivers complete work within an isolated local workspace.

### Homepage Hero Statement
> **Tell AI-Dost what you need.**  
> **Let it figure out the work.**

### Supporting Hero Paragraph
> An autonomous AI developer workspace designed for outcomes. Describe a project, bug, research topic, or document in natural language. AI-Dost plans, executes, verifies, and self-heals in your local environment—while keeping your experience as simple as a conversation.

---

## 2. Key Differentiation

| Traditional Chatbots / Copilots | AI-Dost Autonomous Workspace |
|---|---|
| Generates text snippets; user must copy, paste, test, and debug manually. | Autonomously edits files, runs build scripts, verifies results, and repairs errors. |
| Ephemeral sessions with no persistent workspace awareness. | Persistent local workspace with SQLite storage, file state tracking, and git-level commits. |
| Hard-locked to a single cloud provider API key. | Cascades dynamically across free models (Gemini, Groq, OpenRouter) and local Ollama. |
| Cluttered dashboard with dozens of isolated feature buttons. | One unified conversation interface; advanced capabilities are activated contextually. |
| Unverified assumptions and hallucinated code fixes. | Automated verification step (tests, linters, visual check) before work is marked complete. |

---

## 3. Target Users

1. **Software Developers & Engineers:** Building full-stack web applications, refactoring complex codebases, writing unit tests, and debugging issues with an autonomous pair programmer.
2. **Founders & Creators:** Prototyping MVPs, generating landing pages, analyzing datasets, creating presentations, and producing technical documents from simple natural language prompts.
3. **Students & Self-Learners:** Learning programming with bilingual (English/Hinglish) explanations, instant project generation, and transparent step-by-step verification.

---

## 4. Primary Outcome Use Cases

- **Build:** "Generate a full-stack React + Express task tracking application with persistent storage."
- **Analyze:** "Inspect this codebase, identify security bottlenecks, and generate an optimization report."
- **Research:** "Research the latest advancements in local AI inference and synthesize a structured comparison."
- **Create:** "Draft a complete technical presentation on microservices architecture and export it to PPTX."
- **Fix & Repair:** "Run tests on this repository, diagnose the failing test suite, and apply the exact fix."
- **Synthesize:** "Transform these meeting notes and project requirements into a polished executive summary PDF."

---

## 5. Core Product Philosophy

1. **Conversation is Primary:** The chat interface is the command center. Users should never be forced to navigate a maze of buttons to perform work.
2. **Autonomy with Accountability:** Autonomy does not mean reckless execution. High-risk actions (file deletions, git pushes, shell operations) are bounded by capability policies and require explicit user approval.
3. **Local-First & Private:** Workspaces, project files, conversation history, and credentials reside on the user's machine in local SQLite—never uploaded to an opaque centralized cloud.
4. **Resilient & Free-Tier First:** Built from the ground up to operate reliably on free-tier APIs and offline local models, ensuring accessibility for all developers worldwide.

---

## 6. Terminology Rules

| Approved Term | Deprecated / Prohibited Term | Reason |
|---|---|---|
| **Autonomous AI Workspace** | Chatbot, ChatGPT clone | AI-Dost plans, executes, and verifies work; it is not just a text generator. |
| **Autonomous Execution Pipeline** | AI Magic, Black-box AI | Emphasizes deterministic engineering stages over vague magical promises. |
| **Workspace / Project** | Session thread | Reflects file-system persistence and contextual memory. |
| **Verification & Self-Healing** | Instant perfection | Acknowledges real engineering cycles: test, observe, repair, deliver. |
| **Local-First Architecture** | 100% cloud platform | Reflects actual architecture (runs locally on localhost:3000 / localhost:5000). |

---

## 7. Unsupported Claims That Must NEVER Be Invented

To maintain absolute credibility and enterprise trust, the public website must NEVER claim:
1. ❌ **No fabricated compliance certifications:** Never state "SOC 2 Type II Certified", "HIPAA Compliant", "ISO 27001 Certified", or "GDPR Audited" unless genuine formal audits are completed.
2. ❌ **No fake enterprise customer logos:** Never display fabricated client logos (e.g. Google, Microsoft, Netflix) or fake user counts ("1,000,000+ happy developers").
3. ❌ **No fake corporate statistics:** Never list fake venture capital funding rounds, valuation numbers, or fabricated employee headcounts.
4. ❌ **No false encryption or cloud guarantees:** Never claim "military-grade end-to-end cloud encryption" when data is stored locally in SQLite without cloud syncing.
5. ❌ **No ungrounded performance claims:** Never state "100x faster than ChatGPT" or "Zero hallucinations guaranteed". State real technical metrics: "1500 free daily Gemini requests, multi-model cascade with 30s timeouts, automated verification loop".
