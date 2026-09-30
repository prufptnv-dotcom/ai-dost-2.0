---
name: ai-dost-patcher
description: >-
  Use this skill to apply automated patches, read custom patch scripts, and manage AI-Dost's self-healing patch workflows.
---

# Using AI-Dost Patcher

The project root contains several utility scripts for applying complex regex patches and AST modifications to source files automatically.

## Available Patch Utilities
- `apply_patch.js`: Applies a unified diff or targeted patch to a file.
- `patch_regex.js`: Applies a regex replacement across files.
- `patch_planner.py`: Python script used to plan complex structural refactors.

## How to use them
If you, as an agent, need to make a massive structural change that exceeds your normal output limits, you can write a patch file to `patch.txt` and execute:

```powershell
node apply_patch.js patch.txt
```

*Always review the patch utility source code before using them, as they have specific formatting requirements.*
