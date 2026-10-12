# Skills catalog

`bundled/` contains 23 portable Agent Skills, each with its own standards-shaped `SKILL.md`. Use `manifest.json` for UI discovery. Filter metadata deterministically by task/tags, then send only the best-matching skill's full instructions (and at most two supporting skills) to the model.

- **Tier S:** minimal-brief planner, token/context management, codebase scout, full-stack builder, UI design, debug loop, security review, release QA.
- **Tier A:** research/citations, chat, games, 3D, motion, PDF, presentations, documents, quizzes, spreadsheets, image/video, MCP authoring, skill authoring/evaluation.
- **Platform bundle:** member read-only and non-deletable. Update via reviewed, versioned admin release.
- **Admin-managed custom:** add approved organization skills here; after promotion members can use but not edit/delete them.
- **Pending:** submitted skills are quarantined here until reviewed, tested, scanned, and signed. Never execute a pending skill's scripts.

The standard uses `SKILL.md` YAML frontmatter and supports scripts/references/assets; keep the core file short and load details only when needed. [^https://agentskills.io/specification]
