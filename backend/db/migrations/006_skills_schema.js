const logger = require('../../logger');

exports.up = function(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        tools TEXT,
        is_official BOOLEAN DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    
    // Seed an initial skill to show in the UI if empty
    const count = db.prepare('SELECT COUNT(*) AS cnt FROM skills').get().cnt;
    if (count === 0) {
      const now = new Date().toISOString();
      const insert = db.prepare('INSERT INTO skills (id, name, description, system_prompt, tools, is_official, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      insert.run(
        'skill_code_reviewer',
        'Senior Code Reviewer',
        'A meticulous code reviewer that analyzes code for security, performance, and best practices.',
        'You are an expert Senior Staff Software Engineer. Your sole purpose is to review the code provided by the user. Be strict, look for edge cases, memory leaks, security vulnerabilities (OWASP top 10), and suggest concrete refactors. Never write the whole application for them; only review and provide constructive feedback on their specific snippets.',
        JSON.stringify(['read_file', 'grep_search']),
        1,
        now
      );
      logger.info('[Migration] seeded initial skill (Code Reviewer)');
    }
  } catch (err) {
    logger.error('Failed to run migration 006_skills_schema', err);
    throw err;
  }
};
