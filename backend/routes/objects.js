const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * Simple objects CRUD:
 * GET    /api/objects          - list all objects
 * GET    /api/objects/:id      - get one object
 * POST   /api/objects          - create (requires unique name)
 * PATCH  /api/objects/:id      - update (name unique)
 * (deleting objects is possible but will not be used by UI by default)
 */

// List objects
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM objects ORDER BY codeBase ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ notFound: true });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Create new object (requires name unique)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'empty_name' });

    // check uniqueness
    const [exists] = await pool.query('SELECT * FROM objects WHERE name = ?', [name]);
    if (exists[0]) return res.status(409).json({ error: 'name_taken' });

    // get next codeBase
    const [[m]] = await pool.query('SELECT MAX(codeBase) AS maxCode FROM objects');
    const nextCode = (m && m.maxCode) ? (m.maxCode + 1) : 1;

    const [r] = await pool.query(
      'INSERT INTO objects (codeBase, name, calcCount, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())',
      [nextCode, name, 0]
    );
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [r.insertId]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Patch update (only name allowed practically)
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body || {};
    if (name) {
      // check uniqueness
      const [ex] = await pool.query('SELECT id FROM objects WHERE name = ? AND id <> ?', [name, id]);
      if (ex[0]) return res.status(409).json({ error: 'name_taken' });
      await pool.query('UPDATE objects SET name = ?, updatedAt = NOW() WHERE id = ?', [name, id]);
    }
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [id]);
    res.json(rows[0] || null);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;