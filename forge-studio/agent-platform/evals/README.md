# Quality benchmark

This is a proposed internal comparison harness—not a public vendor ranking. Compare provider/model/skill/MCP changes on identical briefs, repository snapshots, tool permissions, timeouts, and output requirements. Run multiple repetitions and blind-score visual/artifact quality.

## Hard gates

- No cross-user/project access, leaked secret, or unapproved destructive action.
- Build and format validators pass for any output reported as complete.
- No critical accessibility/security finding; no unsupported claim that mock UI actions ran on the backend.
- Citations are present for researched facts and point to sources that support the exact claim.

## Score dimensions

See `rubric.json`: task completion, craft, functional reliability, safe permissions, usability/accessibility, and cost/latency. Weight quality and safe success above raw speed. Track **cost per accepted, validated result**, not cost per first draft.

For each run save: prompt, repo fixture hash, provider/model/version, skill versions activated, MCP server/tool IDs and approval outcomes, input/output/cache tokens, retries, build/test/visual scores, reviewer notes, and final artifact checksum. Redact secrets and user data. Re-run the golden set before promoting a skill, provider adapter, or MCP connector.
