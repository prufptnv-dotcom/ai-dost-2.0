const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db');
const logger = require('../logger');

// GET all skills
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
    
    const skills = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      system_prompt: r.system_prompt,
      tools: r.tools ? JSON.parse(r.tools) : [],
      is_official: Boolean(r.is_official),
      created_at: r.created_at
    }));
    
    res.json({ skills });
  } catch (error) {
    logger.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// GET a single skill by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json({
      ...skill,
      tools: skill.tools ? JSON.parse(skill.tools) : [],
      is_official: Boolean(skill.is_official)
    });
  } catch (error) {
    logger.error('Error fetching skill:', error);
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

// POST a new custom skill
router.post('/', (req, res) => {
  try {
    const { name, description, system_prompt, tools } = req.body;
    
    if (!name || !system_prompt) {
      return res.status(400).json({ error: 'Name and system_prompt are required' });
    }
    
    const db = getDatabase();
    const id = 'skill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString();
    const toolsJson = JSON.stringify(tools || []);
    
    const insert = db.prepare(`
      INSERT INTO skills (id, name, description, system_prompt, tools, is_official, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(id, name, description || '', system_prompt, toolsJson, 0, now);
    
    res.status(201).json({
      success: true,
      skill: { id, name, description, system_prompt, tools: tools || [], is_official: false, created_at: now }
    });
  } catch (error) {
    logger.error('Error creating skill:', error);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

// DELETE a custom skill
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    if (skill.is_official) {
      return res.status(403).json({ error: 'Cannot delete official skills' });
    }
    
    db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Skill deleted' });
  } catch (error) {
    logger.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Failed to delete skill' });
  }
});

module.exports = router;
