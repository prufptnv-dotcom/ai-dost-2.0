import os
import re

filepath = "backend/agent/runtime/PlannerExecutionLoop.js"
with open(filepath, "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(
    r'async run\(projectId, userId, intent, maxRepairs = 3\) \{\s*const context = await this\.contextAssembler\.assemble\(projectId, userId\);',
    r'async run(projectId, userId, intent, maxRepairs = 3) {\n    const context = await this.contextAssembler.assemble(projectId, userId, intent);',
    text
)

# In resume, the code has:
# const context = await this.contextAssembler.assemble(projectId, userId);
# const run = this.agentRunDao.getById(runId);
# We want to reorder it and add intent.

text = re.sub(
    r'const context = await this\.contextAssembler\.assemble\(projectId, userId\);\s*const run = this\.agentRunDao\.getById\(runId\);',
    r'const run = this.agentRunDao.getById(runId);\n    if (!run) throw new Error(`Run ${runId} not found`);\n    const task = this.agentTaskDao.getById(run.task_id);\n    const intent = task ? task.prompt : "";\n    const context = await this.contextAssembler.assemble(projectId, userId, intent);',
    text
)

# Clean up duplicate run check
text = re.sub(
    r'if \(!run\) throw new Error\(`Run \$\{runId\} not found`\);\s*if \(!run\) throw new Error\(`Run \$\{runId\} not found`\);',
    r'if (!run) throw new Error(`Run ${runId} not found`);',
    text
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(text)
print("Patched PlannerExecutionLoop successfully")
