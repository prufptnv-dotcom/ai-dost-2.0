const express = require('express');
const logger = require('../logger');
const router = express.Router();
const { runInSession, runInSessionAuto } = require('../sockets/terminal');

// Execute a command in a project's live terminal session (REST fallback,
// also used by the IDE "Run" button). Streams output to any connected
// terminal sockets for that project.
router.post('/exec', async (req, res) => {
  const { command, projectId, projectPath, autoRetry, timeout } = req.body || {};
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'command is required' });
  }
  try {
    const result = autoRetry
      ? await runInSessionAuto(projectId || 'default', projectPath, command, timeout)
      : await runInSession(projectId || 'default', projectPath, command, timeout);
    res.json(result);
  } catch (e) {
    logger.error('[Terminal] exec error:', e.message || e);
    res.status(500).json({ error: e.message || 'Execution failed' });
  }
});

module.exports = router;