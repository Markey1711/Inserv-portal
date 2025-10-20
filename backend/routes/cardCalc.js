const express = require('express');
const router = express.Router();
const pool = require('../db');

// ---- helpers (JSON parse/merge) ----
const isJSONLike = (v) => typeof v === 'string' && /^[\s]*[{\[]/.test(v || '');
const tryParseJSON = (v) => { if (isJSONLike(v)) { try { return JSON.parse(v); } catch {} } return v; };
const normalizeRow = (row) => {
  if (!row) return row;
  const r = { ...row };
  if ('sheets' in r) r.sheets = tryParseJSON(r.sheets);
  if ('areaTable' in r) r.areaTable = tryParseJSON(r.areaTable);
  if ('approvals' in r) r.approvals = tryParseJSON(r.approvals);
  return r;
};

function mergeSheets(existing = {}, incoming = {}) {
  return {
    ...existing,
    ...incoming,
    staff: Array.isArray(incoming.staff) ? incoming.staff : existing.staff || [],
    tmc: Array.isArray(incoming.tmc) ? incoming.tmc : existing.tmc || [],
    amortization: Array.isArray(incoming.amortization) ? incoming.amortization : existing.amortization || [],
    extraCosts: Array.isArray(incoming.extraCosts)
      ? incoming.extraCosts
      : Array.isArray(incoming.extras)
      ? incoming.extras
      : existing.extraCosts || [],
    summary: {
      ...(existing.summary || {}),
      ...(incoming.summary || {}),
    },
  };
}

function buildNext(existingRaw, incomingRaw) {
  const existing = normalizeRow(existingRaw);
  const incoming = incomingRaw || {};
  const next = {
    ...existing,
    objectName: incoming.objectName ?? existing.objectName ?? '',
    address: incoming.address ?? existing.address ?? '',
    comment: incoming.comment ?? existing.comment ?? '',
    company: incoming.company ?? existing.company ?? '',
    customer: incoming.customer ?? existing.customer ?? '',
    status: incoming.status ?? existing.status ?? 'draft',
    areaTable: incoming.areaTable ?? existing.areaTable ?? [],
    approvals: incoming.approvals ?? existing.approvals ?? [],
    sheets: mergeSheets(existing.sheets || {}, incoming.sheets || {}),
    updatedAt: new Date(),
  };
  next.objectCode = existing.objectCode;
  return next;
}

function toSqlDateTime(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

// ---------- LIST (журнал) БЕЗ OFFSET: keyset-пагинация ----------
router.get('/', async (req, res) => {
  try {
    const raw = String(req.query.raw || '0') === '1';     // raw=1 -> массив (для журналов)
    const full = String(req.query.full || '0') === '1';   // full=1 -> SELECT *
    const perPage = Math.min(500, Math.max(1, parseInt(req.query.perPage || '100', 10) || 100));
    const afterStr = (req.query.after ?? '').trim();
    const after = afterStr === '' ? null : Number(afterStr);

    // Лёгкий набор колонок для журналов (без sheets/areaTable/approvals)
    const selectCols = full
      ? '*'
      : [
          'id',
          'objectCode',
          'objectName',
          'address',
          'comment',
          'company',
          'customer',
          'status',
          'createdAt',
          'updatedAt',
        ].join(', ');

    // 1) Берём только ключи по индексу objectCode (range scan), БЕЗ OFFSET
    const whereKeys = after === null ? '' : 'WHERE objectCode > ?';
    const keysParams = after === null ? [perPage] : [after, perPage];

    let keysRows = [];
    try {
      // Если индекс называется иначе — поправьте имя в FORCE INDEX
      const [k] = await pool.query(
        `SELECT objectCode FROM card_calc FORCE INDEX (idx_card_calc_objectCode) ${whereKeys} ORDER BY objectCode ASC LIMIT ?`,
        keysParams
      );
      keysRows = k;
    } catch (e1) {
      // если FORCE INDEX не поддерживается — без подсказки
      const [k2] = await pool.query(
        `SELECT objectCode FROM card_calc ${whereKeys} ORDER BY objectCode ASC LIMIT ?`,
        keysParams
      );
      keysRows = k2;
    }

    if (keysRows.length === 0) {
      if (raw) {
        res.setHeader('X-Next-After', '');
        return res.json([]);
      }
      return res.json({ items: [], perPage, after: after ?? null, nextAfter: null, total: null, mode: 'keyset' });
    }

    const codes = keysRows.map((r) => r.objectCode);
    const placeholders = codes.map(() => '?').join(',');

    // 2) Подтягиваем сами строки по IN (...) — тоже без OFFSET
    const [rows] = await pool.query(
      `SELECT ${selectCols} FROM card_calc WHERE objectCode IN (${placeholders})`
        + ` ORDER BY objectCode ASC`,
      codes
    );

    const data = rows.map(normalizeRow);
    const nextAfter = data.length ? data[data.length - 1].objectCode : null;

    if (raw) {
      res.setHeader('X-Next-After', nextAfter ?? '');
      return res.json(data);
    }

    let total = null;
    try {
      const [[cnt]] = await pool.query('SELECT COUNT(*) AS total FROM card_calc');
      total = cnt.total || 0;
    } catch {
      total = null;
    }

    res.json({ items: data, perPage, after: after ?? null, nextAfter, total, mode: 'keyset' });
  } catch (e) {
    console.error('GET /api/card-calc error:', e);
    res.status(500).json({ error: 'DB_ERROR', details: e?.message || String(e) });
  }
});

// ---------- GET one ----------
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT * FROM card_calc WHERE objectCode = ?', [id]);
    res.json(normalizeRow(rows[0]) || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'GET by id failed' });
  }
});

// ---------- POST create ----------
router.post('/', async (req, res) => {
  try {
    const [last] = await pool.query('SELECT MAX(objectCode) AS maxCode FROM card_calc');
    const nextCode = (last[0].maxCode || 0) + 1;

    const {
      objectName = '',
      address = '',
      comment = '',
      company = '',
      customer = '',
      status = 'draft',
      areaTable = [],
      approvals = [],
      sheets = {},
    } = req.body || {};

    const createdAt = new Date();

    const [result] = await pool.query(
      'INSERT INTO card_calc (objectCode, objectName, address, comment, company, customer, status, areaTable, approvals, sheets, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nextCode,
        objectName,
        address,
        comment,
        company,
        customer,
        status,
        JSON.stringify(areaTable),
        JSON.stringify(approvals),
        JSON.stringify(sheets),
        toSqlDateTime(createdAt),
      ]
    );

    const [newCard] = await pool.query('SELECT * FROM card_calc WHERE id = ?', [result.insertId]);
    res.json(normalizeRow(newCard[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'POST create failed' });
  }
});

// ---------- PATCH update ----------
router.patch('/:id', async (req, res) => {
  try {
    const code = req.params.id;
    const [rows] = await pool.query('SELECT * FROM card_calc WHERE objectCode = ?', [code]);
    const existing = rows[0];
    if (!existing) return res.status(404).end();

    const existingNorm = normalizeRow(existing);
    const incoming = req.body || {};
    const next = buildNext(existingNorm, incoming);

    // Обновляем только реально существующие колонки
    const allowed = new Set(Object.keys(existing || {}));
    const fields = [];
    const values = [];
    for (const [k, v] of Object.entries(next)) {
      if (!allowed.has(k)) continue;
      if (k === 'id' || k === 'objectCode') continue;
      let val = v;
      if (val instanceof Date) val = toSqlDateTime(val);
      else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
      fields.push(`${k} = ?`);
      values.push(val);
    }
    if (fields.length) {
      values.push(existing.objectCode);
      await pool.query(`UPDATE card_calc SET ${fields.join(', ')} WHERE objectCode = ?`, values);
    }

    const [updatedRows] = await pool.query('SELECT * FROM card_calc WHERE objectCode = ?', [code]);
    res.json(normalizeRow(updatedRows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PATCH update failed' });
  }
});

// ---------- DELETE ----------
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM card_calc WHERE objectCode = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DELETE failed' });
  }
});

module.exports = router;