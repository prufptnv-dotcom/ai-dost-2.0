const zlib = require('zlib');
const crypto = require('crypto');

class ContextCompressionStore {
  constructor(db) {
    this.db = db;
  }

  save({ projectId, sourceId, sourceType = 'unknown', content, importanceScore = 10, representation = 'full', versionHash = null }) {
    if (!projectId || !sourceId) throw new Error('projectId and sourceId are required');
    const text = String(content || '');
    const compressed = zlib.gzipSync(Buffer.from(text, 'utf8'));
    const hash = versionHash || crypto.createHash('sha256').update(text).digest('hex');
    this.db.prepare(`
      INSERT INTO context_compression_cache
        (project_id, source_id, source_type, importance_score, representation, version_hash, payload, original_bytes, compressed_bytes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(project_id, source_id, representation) DO UPDATE SET
        source_type = excluded.source_type,
        importance_score = excluded.importance_score,
        version_hash = excluded.version_hash,
        payload = excluded.payload,
        original_bytes = excluded.original_bytes,
        compressed_bytes = excluded.compressed_bytes,
        updated_at = excluded.updated_at
    `).run(projectId, sourceId, sourceType, Math.max(1, Math.min(10, Number(importanceScore) || 1)), representation, hash, compressed, Buffer.byteLength(text), compressed.length);
    return this.get({ projectId, sourceId, representation });
  }

  get({ projectId, sourceId, representation = null }) {
    let sql = 'SELECT * FROM context_compression_cache WHERE project_id = ? AND source_id = ?';
    const params = [projectId, sourceId];
    if (representation) { sql += ' AND representation = ?'; params.push(representation); }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    const row = this.db.prepare(sql).get(...params);
    if (!row) return null;
    return { ...row, content: zlib.gunzipSync(row.payload).toString('utf8'), payload: undefined };
  }
}

module.exports = ContextCompressionStore;