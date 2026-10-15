const fs = require('fs');
const path = require('path');
const logger = require('../logger');

/**
 * P2 #48: generated downloads accumulated forever inside frontend/public/
 * downloads (served statically on every page load). Sweep after writes:
 *  - delete files older than DOWNLOAD_TTL_HOURS (default 24h)
 *  - keep only the newest DOWNLOAD_MAX_FILES (default 500)
 * Non-blocking: call via setImmediate() from a request path.
 */
function sweepDownloads(dir) {
  if (!dir) return { removed: 0 };
  try {
    const ttlMs = Number(process.env.DOWNLOAD_TTL_HOURS || 24) * 3600 * 1000;
    const maxFiles = Number(process.env.DOWNLOAD_MAX_FILES || 500);
    const now = Date.now();

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        files.push({ filePath, mtime: stat.mtimeMs });
      } catch (_) { /* raced deletion */ }
    }

    let removed = 0;
    const fresh = [];
    for (const file of files) {
      if (now - file.mtime > ttlMs) {
        try { fs.unlinkSync(file.filePath); removed++; } catch (_) {}
      } else {
        fresh.push(file);
      }
    }

    fresh.sort((a, b) => b.mtime - a.mtime);
    for (const file of fresh.slice(maxFiles)) {
      try { fs.unlinkSync(file.filePath); removed++; } catch (_) {}
    }

    if (removed > 0) {
      logger.info(`[Downloads] swept ${removed} old file(s) from ${dir}`);
    }
    return { removed };
  } catch (err) {
    logger.warn(`[Downloads] sweep failed for ${dir}: ${err.message}`);
    return { removed: 0, error: err.message };
  }
}

module.exports = { sweepDownloads };
