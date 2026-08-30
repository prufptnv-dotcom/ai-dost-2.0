const path = require('path');
const os = require('os');
const logger = require('../logger');

class LegacyMigrator {
  constructor(db) {
    this.db = db;
  }

  migrateAll() {
    logger.info('[LegacyMigrator] Running legacy data migration...');
    const stats = {
      projectsMapped: 0,
      workspacesBound: 0,
      chatSessionsMigrated: 0,
      chatMessagesMigrated: 0,
      resumesMappedToArtifacts: 0
    };

    const runTx = this.db.transaction(() => {
      // 1. Ensure all legacy projects have workspace bindings
      try {
        const legacyProjects = this.db.prepare('SELECT * FROM projects').all();
        for (const p of legacyProjects) {
          const ws = this.db.prepare('SELECT id FROM workspaces WHERE project_id = ?').get(p.id);
          if (!ws) {
            const diskPath = path.join(os.tmpdir(), `agent-ws-${p.id}`);
            this.db.prepare(`
              INSERT INTO workspaces (id, project_id, disk_path, is_git_initialized, current_branch, last_synced_at)
              VALUES (?, ?, ?, 1, 'main', datetime('now'))
            `).run(`ws-${p.id}`, p.id, diskPath);
            stats.workspacesBound++;
          }
          stats.projectsMapped++;
        }
      } catch (err) {
        logger.warn(`[LegacyMigrator] Projects check: ${err.message}`);
      }

      // 2. Migrate legacy chat_history into conversations & messages
      try {
        const chatRows = this.db.prepare('SELECT * FROM chat_history ORDER BY id ASC').all();
        const sessions = new Map();
        for (const row of chatRows) {
          const sid = row.session_id || 'default_session';
          if (!sessions.has(sid)) sessions.set(sid, []);
          sessions.get(sid).push(row);
        }

        for (const [sid, msgs] of sessions.entries()) {
          const convId = `legacy_conv_${sid}`;
          const existingConv = this.db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
          if (!existingConv) {
            this.db.prepare(`
              INSERT INTO conversations (id, project_id, user_id, title, surface, created_at, updated_at)
              VALUES (?, 'default', 'local-user', ?, 'chat', ?, ?)
            `).run(convId, `Chat Session ${sid}`, msgs[0]?.timestamp || new Date().toISOString(), msgs[msgs.length - 1]?.timestamp || new Date().toISOString());
            stats.chatSessionsMigrated++;
          }

          for (const m of msgs) {
            const msgId = `legacy_msg_${m.id}`;
            const existingMsg = this.db.prepare('SELECT id FROM messages WHERE id = ?').get(msgId);
            if (!existingMsg) {
              this.db.prepare(`
                INSERT INTO messages (id, conversation_id, role, content, created_at)
                VALUES (?, ?, ?, ?, ?)
              `).run(msgId, convId, m.role, m.content, m.timestamp || new Date().toISOString());
              stats.chatMessagesMigrated++;
            }
          }
        }
      } catch (err) {
        logger.warn(`[LegacyMigrator] Chat history migration: ${err.message}`);
      }

      // 3. Migrate resumes into artifacts
      try {
        const resumeRows = this.db.prepare('SELECT * FROM resumes ORDER BY id ASC').all();
        for (const r of resumeRows) {
          const artId = `legacy_resume_${r.id}`;
          const existingArt = this.db.prepare('SELECT id FROM artifacts WHERE id = ?').get(artId);
          if (!existingArt) {
            this.db.prepare(`
              INSERT INTO artifacts (id, project_id, name, type, mime_type, storage_path, size_bytes, metadata, created_at)
              VALUES (?, 'default', ?, 'resume_data', 'application/json', 'db://resumes/' || ?, ?, ?, ?)
            `).run(
              artId,
              `Resume: ${(r.prompt || 'Generated Resume').slice(0, 40)}`,
              r.id,
              Buffer.from(r.json_data || '').length,
              JSON.stringify({ prompt: r.prompt, originalId: r.id }),
              r.created_at || new Date().toISOString()
            );
            stats.resumesMappedToArtifacts++;
          }
        }
      } catch (err) {
        logger.warn(`[LegacyMigrator] Resumes migration: ${err.message}`);
      }
    });

    runTx();
    logger.info('[LegacyMigrator] Migration complete:', JSON.stringify(stats));
    return stats;
  }
}

module.exports = LegacyMigrator;
