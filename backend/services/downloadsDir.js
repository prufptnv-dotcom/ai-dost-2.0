'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * P2 FIX (#178): single source of truth for where generated documents live.
 *
 * Previously documents.js had this fallback chain but server.js, pdf.js,
 * artifactService and projectGraphService hard-coded
 * frontend/public/downloads — a path that does not exist in the backend
 * image, so every generated doc 404'd in Docker. All writers/readers now
 * resolve through here, and docker-compose sets DOWNLOADS_DIR to a mounted
 * volume so the container has one consistent, writable location.
 *
 * Order: env DOWNLOADS_DIR → frontend/public/downloads (dev) →
 * backend/data/downloads → OS temp dir.
 */
function resolveDownloadsDir() {
  const candidates = process.env.DOWNLOADS_DIR
    ? [process.env.DOWNLOADS_DIR]
    : [
        path.join(__dirname, '../../frontend/public/downloads'),
        path.join(__dirname, '../data/downloads'),
        path.join(os.tmpdir(), 'aidost-downloads'),
      ];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (_err) {
      // unwritable (e.g. container filesystem) — try next candidate
    }
  }
  return path.join(os.tmpdir(), 'aidost-downloads');
}

module.exports = { resolveDownloadsDir };
