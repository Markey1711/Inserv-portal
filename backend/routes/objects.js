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

// Debug endpoint should be BEFORE '/:id'
router.get('/_debug', async (_req, res) => {
  try {
    const [[pong]] = await pool.query('SELECT 1 AS ok');
    const [cols] = await pool.query('SHOW COLUMNS FROM objects');
    res.json({ ok: true, ping: pong?.ok === 1, columns: cols.map(c => ({ Field: c.Field, Type: c.Type })) });
  } catch (e) {
    console.error('DEBUG /api/objects/_debug failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// List objects
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM objects ORDER BY codeBase ASC');
    res.json(rows);
  } catch (e) {
    console.error('GET /api/objects failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ notFound: true });
    res.json(rows[0]);
  } catch (e) {
    console.error('GET /api/objects/:id failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// Create new object (requires name unique)
router.post('/', async (req, res) => {
  try {
    const { name, address = null, contacts = null, clientCompany = null } = req.body || {};
    if (!name || String(name).trim() === '') return res.status(400).json({ error: 'empty_name' });

    // check uniqueness
    const [exists] = await pool.query('SELECT * FROM objects WHERE name = ?', [name]);
    if (exists[0]) return res.status(409).json({ error: 'name_taken' });

    // get next codeBase
    const [[m]] = await pool.query('SELECT MAX(codeBase) AS maxCode FROM objects');
    const nextCode = (m && m.maxCode) ? (m.maxCode + 1) : 1;

    const [r] = await pool.query(
      'INSERT INTO objects (codeBase, name, address, contacts, clientCompany, calcCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [nextCode, name, address, contacts, clientCompany, 0]
    );
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [r.insertId]);
    res.json(rows[0]);
  } catch (e) {
    console.error('POST /api/objects failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// Patch update (name + client fields)
router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, contacts, clientCompany } = req.body || {};
    if (name) {
      // check uniqueness
      const [ex] = await pool.query('SELECT id FROM objects WHERE name = ? AND id <> ?', [name, id]);
      if (ex[0]) return res.status(409).json({ error: 'name_taken' });
      await pool.query('UPDATE objects SET name = ?, updatedAt = NOW() WHERE id = ?', [name, id]);
    }
    // update client fields if provided
    if (typeof address !== 'undefined') {
      await pool.query('UPDATE objects SET address = ?, updatedAt = NOW() WHERE id = ?', [address, id]);
    }
    if (typeof contacts !== 'undefined') {
      await pool.query('UPDATE objects SET contacts = ?, updatedAt = NOW() WHERE id = ?', [contacts, id]);
    }
    if (typeof clientCompany !== 'undefined') {
      await pool.query('UPDATE objects SET clientCompany = ?, updatedAt = NOW() WHERE id = ?', [clientCompany, id]);
    }
    const [rows] = await pool.query('SELECT * FROM objects WHERE id = ?', [id]);
    res.json(rows[0] || null);
  } catch (e) {
    console.error('PATCH /api/objects/:id failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// Delete object (only if not referenced by any card)
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'bad_id' });

    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM card_calc WHERE objectId = ?', [id]);
    if (cnt > 0) {
      return res.status(409).json({ error: 'object_has_cards', count: cnt });
    }

    const [del] = await pool.query('DELETE FROM objects WHERE id = ?', [id]);
    if (del.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/objects/:id failed:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e || ''), code: e?.code || null });
  }
});

// (debug route moved above)

module.exports = router;