# AI-Dost Documentation Information Architecture (IA)

**Date:** 2026-09-03  
**Status:** CANONICAL DOCUMENTATION SPECIFICATION  
**Standard Page Blueprint:** Every documentation topic follows a structured pedagogy: **What**, **Why**, **When**, **How**, **Example**, **Limitations**, and **Common Mistakes**.  

---

## 1. Top-Level Documentation Hierarchy

```
/docs
├── 1. Getting Started
│   ├── Quickstart Guide (/docs/getting-started)
│   ├── Environment & Prerequisites (/docs/getting-started/environment)
│   └── Multi-Model Setup (/docs/getting-started/models)
├── 2. Core Concepts
│   ├── Architecture Overview (/docs/concepts)
│   ├── The "Simple Outside, Autonomous Inside" Model (/docs/concepts/philosophy)
│   └── Runtime Profiles: Light, Standard, Scale (/docs/concepts/profiles)
├── 3. Conversation & Chat Interface
│   ├── Natural Language Workflows (/docs/chat)
│   ├── Bilingual & Hinglish Understanding (/docs/chat/bilingual)
│   └── Context-Aware Command Dispatch (/docs/chat/commands)
├── 4. Projects & Workspaces
│   ├── Project Lifecycle & Persistence (/docs/projects)
│   ├── Workspace Filesystem Structure (/docs/projects/workspaces)
│   └── Git Versioning & Commits (/docs/projects/git)
├── 5. Autonomous Execution Engine
│   ├── The 8-Stage Execution Pipeline (/docs/agent)
│   ├── Planning, Subtasks & Checkpoints (/docs/agent/planning)
│   └── Self-Healing & Repair Loops (/docs/agent/repair)
├── 6. Tools & Capabilities
│   ├── Tool Registry & Execution Contracts (/docs/tools)
│   ├── Full-Stack Scaffolding (/docs/tools/scaffolding)
│   ├── Document Generation Engine (PDF, DOCX, PPTX, XLSX, CSV) (/docs/tools/documents)
│   └── Image Generation (/docs/tools/images)
├── 7. Knowledge & Context (RAG)
│   ├── Workspace Context Assembly (/docs/rag)
│   └── Agent Memory & Learning (/docs/rag/memory)
├── 8. Developer Studio & Copilot IDE
│   ├── Monaco Editor & Multi-file Tree (/docs/ide)
│   ├── Terminal Integration & Command Execution (/docs/ide/terminal)
│   └── Keyboard Navigation & Shortcuts (/docs/ide/shortcuts)
├── 9. Security & Governance
│   ├── Capability Policies & Role Boundaries (/docs/security)
│   ├── Sandbox Isolation & Path Traversal Guards (/docs/security/sandbox)
│   └── Safe API Credential Handling (/docs/security/credentials)
└── 10. Diagnostics & Support
    ├── Troubleshooting & Known Issues (/docs/troubleshooting)
    └── Frequently Asked Questions (/docs/faq)
```

---

## 2. Standard Page Blueprint (Template Specification)

To ensure maximum clarity and utility for developers, every topic page adheres strictly to this format:

1. **What:** Precise technical definition of the concept or component.
2. **Why:** The engineering rationale and user benefit.
3. **When:** Exact scenarios and triggers when this feature should be utilized.
4. **How:** Step-by-step instructions or architecture flow.
5. **Example:** Copy-pasteable prompts, CLI commands, or API snippets.
6. **Limitations:** Honest boundaries, timeouts, and environmental constraints.
7. **Common Mistakes:** Anti-patterns, misconfigurations, and debugging tips.

---

## 3. Detailed Page Breakdown & Content Summary

### Topic 1: Getting Started (`/docs/getting-started`)
- **What:** Onboarding guide to boot AI-Dost backend and frontend locally.
- **Why:** Get developers up and running with a single prompt in under 3 minutes.
- **When:** Initial machine setup or onboarding team members.
- **How:** Clone repository → configure `.env` with free Gemini API key → launch `node server.js` on port 5000 → launch Next.js dev server on port 3000.
- **Example:** `cd backend && node server.js` | `cd frontend && npm run dev`
- **Limitations:** Requires Node.js v18+; native `better-sqlite3` build requires Windows C++ toolchain if compiling from source.
- **Common Mistakes:** Running backend on a port other than 5000 without updating Next.js API rewrite proxies.

### Topic 2: Autonomous Execution Pipeline (`/docs/agent`)
- **What:** The 8-stage lifecycle: Intent → Context → Plan → Execute → Observe → Verify → Repair → Deliver.
- **Why:** Replaces fragile one-shot code generation with iterative, verified software construction.
- **When:** Multi-file project generation, complex bug fixing, or structured research.
- **How:** Agent decomposes prompt into task DAG, claims authorized role, runs tools, inspects outputs, and iterates up to 3 repair cycles if errors occur.
- **Example:** User asks: *"Build an authentication REST API with JWT in Express."* Agent creates 4 files, runs syntax lint, tests endpoint imports, and confirms delivery.
- **Limitations:** Maximum step ceiling is 50 steps; tool timeouts capped at 30s per invocation.
- **Common Mistakes:** Issuing vague prompts without specifying technical requirements or expected data formats.

### Topic 3: Document Generation Engine (`/docs/tools/documents`)
- **What:** Automated production of MS Office and PDF files: `.docx`, `.pptx`, `.csv`, `.xlsx`, and `.pdf`.
- **Why:** Create distributable enterprise documents directly from conversational requests.
- **When:** Generating project reports, presentations, financial sheets, or resumes.
- **How:** Natural language intent parser detects document keywords → LLM builds structured content schema → backend generator renders file into `public/downloads/`.
- **Example:** *"Generate a 5-slide presentation on cloud migration strategies."* → produces downloadable PPTX.
- **Limitations:** Complex graphical charts require external rendering; PPTX generation requires pptxgenjs v4.
- **Common Mistakes:** Asking for unsupported proprietary formats or exceeding memory limits on 10,000+ row spreadsheet generations.

### Topic 4: Security & Capability Policies (`/docs/security`)
- **What:** Strict boundary controls between agent roles, workspace file trees, and system commands.
- **Why:** Prevents rogue autonomous commands from escaping workspaces or executing unauthorized deletions.
- **When:** Always active across all agent runs.
- **How:** Capability policy evaluates each tool call; file operations outside normalized workspace are blocked with `400 Invalid Path`.
- **Example:** Agent attempt to access `../../etc/passwd` triggers immediate security rejection.
- **Limitations:** Single-user workstation focus; multi-tenant cloud IAM reserved for Scale profile.
- **Common Mistakes:** Storing plaintext credentials inside version-controlled project workspaces.
