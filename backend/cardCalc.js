const express = require('express');
const router = express.Router();

// Robustly resolve db module in case of different working copies
let pool;
try {
  pool = require('./db');
} catch (e1) {
  try {
    pool = require('../db');
    console.warn('[cardCalc] Fallback to ../db (please update import to ./db)');
  } catch (e2) {
    console.error('[cardCalc] Failed to load db module from ./db and ../db');
    throw e2;
  }
}

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
    periodMonth: incoming.periodMonth ?? existing.periodMonth ?? null,
    periodYear: incoming.periodYear ?? existing.periodYear ?? null,
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

// ---------- helper functions for objects and codes ----------
async function getObjectById(connOrPool, id) {
  const conn = connOrPool.query ? connOrPool : connOrPool; // conn or pool both support query
  const [rows] = await conn.query('SELECT * FROM objects WHERE id = ?', [id]);
  return rows[0] || null;
}

function padCodeBase(codeBase) {
  // Левое число кода объекта должно иметь 4 знака с ведущими нулями: 0001-1
  return String(codeBase).padStart(4, '0');
}

// increment calcCount for object in transaction, return updated object row
async function incrementObjectCalcCount(conn, objectId) {
  await conn.query('UPDATE objects SET calcCount = calcCount + 1, updatedAt = NOW() WHERE id = ?', [objectId]);
  const [rows] = await conn.query('SELECT * FROM objects WHERE id = ?', [objectId]);
  return rows[0];
}

// find by name or create new object (with next codeBase). Uses connection for atomicity.
async function findOrCreateObjectByName(conn, name) {
  // trim name
  const nm = String(name || '').trim();
  if (!nm) throw new Error('empty_object_name');

  // check existing
  const [exist] = await conn.query('SELECT * FROM objects WHERE name = ?', [nm]);
  if (exist[0]) return exist[0];

  // get next codeBase
  const [[m]] = await conn.query('SELECT MAX(codeBase) AS maxCode FROM objects');
  const nextCode = (m && m.maxCode) ? (m.maxCode + 1) : 1;

  const [r] = await conn.query('INSERT INTO objects (codeBase, name, calcCount, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())', [nextCode, nm, 0]);
  const [rows] = await conn.query('SELECT * FROM objects WHERE id = ?', [r.insertId]);
  return rows[0];
}

// ---------- LIST (журнал) ----------
router.get('/', async (req, res) => {
  try {
    const raw = String(req.query.raw || '0') === '1';
    const full = String(req.query.full || '0') === '1';
    const perPage = Math.min(500, Math.max(1, parseInt(req.query.perPage || '100', 10) || 100));
    const afterStr = (req.query.after ?? '').trim();
    const after = afterStr === '' ? null : Number(afterStr);

    const selectCols = full
      ? '*'
      : [
          'id',
          'objectCode',
          'objectCodeFull',
          'objectId',
          'objectName',
          'address',
          'comment',
          'company',
          'customer',
              'periodMonth',
              'periodYear',
          'status',
          'createdAt',
          'updatedAt',
        ].join(', ');

    const whereKeys = after === null ? '' : 'WHERE objectCode > ?';
    const keysParams = after === null ? [perPage] : [after, perPage];

    let keysRows = [];
    try {
      const [k] = await pool.query(
        `SELECT objectCode FROM card_calc FORCE INDEX (idx_card_calc_objectCode) ${whereKeys} ORDER BY objectCode ASC LIMIT ?`,
        keysParams
      );
      keysRows = k;
    } catch (e1) {
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

    const [rows] = await pool.query(
      `SELECT ${selectCols} FROM card_calc WHERE objectCode IN (${placeholders})`
        + ` ORDER BY objectCode ASC`,
      codes
    );

    const data = rows.map(normalizeRow);
    const nextAfter = data.length ? data[data.length - 1].objectCode : null;

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

// ---------- DEBUG (place before dynamic ":id" routes) ----------
router.get('/_debug', async (_req, res) => {
  try {
    const [[cnt]] = await pool.query('SELECT COUNT(*) AS total FROM card_calc');
    res.json({ ok: true, router: 'cardCalc', total: cnt.total || 0, ts: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, router: 'cardCalc', error: 'DB_ERROR', details: e?.message || String(e) });
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
// Supports optional objectId or objectName in body to link card to an object.
// If object provided/exists -> increments calcCount and assigns objectCodeFull "<codeBase>-<calcCount>".
// If no object provided but objectName given -> creates object and assigns.
// If neither provided -> creates a new object with autogenerated name (Object <codeBase>) and assigns.
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      objectId: inObjectId,
      objectName: inObjectName,
      address = '',
      comment = '',
      company = '',
      customer = '',
      status = 'draft',
      periodMonth = null,
      periodYear = null,
      areaTable = [],
      approvals = [],
      sheets = {},
    } = req.body || {};

    // require existing object selection
    if (!inObjectId) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'object_required' });
    }

    // determine object row
    const objectRow = await getObjectById(conn, inObjectId);
    if (!objectRow) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'object_not_found' });
    }

    // increment calcCount and fetch updated object
    const updatedObj = await incrementObjectCalcCount(conn, objectRow.id);

    // build objectCodeFull as "<codeBase>-<calcCount>"
    const objectCodeFull = `${padCodeBase(updatedObj.codeBase)}-${updatedObj.calcCount}`;

    // determine next objectCode (legacy numeric sequence for card_calc.objectCode)
    const [last] = await conn.query('SELECT MAX(objectCode) AS maxCode FROM card_calc');
    const nextCode = (last[0].maxCode || 0) + 1;
    const createdAt = new Date();

    // default card fields from object if not provided
  const cardAddress = address || updatedObj.address || '';
  const cardCompany = company || updatedObj.clientCompany || '';
  const cardCustomer = customer || '';

    const [result] = await conn.query(
      'INSERT INTO card_calc (objectCode, objectCodeFull, objectId, objectName, address, comment, company, customer, periodMonth, periodYear, status, areaTable, approvals, sheets, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nextCode,
        objectCodeFull,
  updatedObj.id,
  updatedObj.name ?? '',
        cardAddress,
        comment,
        cardCompany,
        cardCustomer,
        periodMonth,
        periodYear,
        status,
        JSON.stringify(areaTable),
        JSON.stringify(approvals),
        JSON.stringify(sheets),
        toSqlDateTime(createdAt),
      ]
    );

    await conn.commit();
    const [newCardRows] = await pool.query('SELECT * FROM card_calc WHERE id = ?', [result.insertId]);
    conn.release();
    res.json(normalizeRow(newCardRows[0]));
  } catch (e) {
    await conn.rollback().catch(()=>{});
    conn.release();
    console.error('POST /api/card-calc error:', e);
    res.status(500).json({ error: 'POST create failed', details: e.message });
  }
});

// ---------- POST copy (clone existing card) ----------
router.post('/:id/copy', async (req, res) => {
  // req.params.id - source objectCode (legacy numeric)
  // body: { targetObjectId, targetObjectName } - choose target object (or create)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const sourceCode = req.params.id;
    const { targetObjectId, targetObjectName } = req.body || {};

    // load source
    const [srcRows] = await conn.query('SELECT * FROM card_calc WHERE objectCode = ?', [sourceCode]);
    if (!srcRows[0]) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'source_not_found' });
    }
    const src = normalizeRow(srcRows[0]);

    // determine target object
    let objectRow = null;
    if (targetObjectId) {
      objectRow = await getObjectById(conn, targetObjectId);
      if (!objectRow) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ error: 'target_object_not_found' });
      }
    } else if (targetObjectName) {
      objectRow = await findOrCreateObjectByName(conn, targetObjectName);
    } else {
      // create new object auto-named
      const [[m]] = await conn.query('SELECT MAX(codeBase) AS maxCode FROM objects');
      const nextCode = (m && m.maxCode) ? (m.maxCode + 1) : 1;
      const autoName = `Object ${nextCode}`;
      objectRow = await findOrCreateObjectByName(conn, autoName);
    }

    // increment target object's calcCount
    const updatedObj = await incrementObjectCalcCount(conn, objectRow.id);
    const objectCodeFull = `${padCodeBase(updatedObj.codeBase)}-${updatedObj.calcCount}`;

    // create new objectCode numeric
    const [last] = await conn.query('SELECT MAX(objectCode) AS maxCode FROM card_calc');
    const nextCode = (last[0].maxCode || 0) + 1;
    const createdAt = new Date();

    // clone all fields except id and createdAt maybe update status to draft
    const insertRow = {
      objectCode: nextCode,
      objectCodeFull,
      objectId: updatedObj.id,
      objectName: updatedObj.name || src.objectName || '',
      address: src.address || updatedObj.address || '',
      comment: src.comment,
      company: src.company || updatedObj.clientCompany || '',
      customer: src.customer || '',
      periodMonth: src.periodMonth ?? null,
      periodYear: src.periodYear ?? null,
      status: 'draft',
      areaTable: JSON.stringify(src.areaTable || []),
      approvals: JSON.stringify(src.approvals || []),
      sheets: JSON.stringify(src.sheets || {}),
      createdAt: toSqlDateTime(createdAt),
      updatedAt: toSqlDateTime(new Date()),
    };

    const [r] = await conn.query(
      `INSERT INTO card_calc
      (objectCode, objectCodeFull, objectId, objectName, address, comment, company, customer, periodMonth, periodYear, status, areaTable, approvals, sheets, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertRow.objectCode,
        insertRow.objectCodeFull,
        insertRow.objectId,
        insertRow.objectName,
        insertRow.address,
        insertRow.comment,
        insertRow.company,
        insertRow.customer,
        insertRow.periodMonth,
        insertRow.periodYear,
        insertRow.status,
        insertRow.areaTable,
        insertRow.approvals,
        insertRow.sheets,
        insertRow.createdAt,
        insertRow.updatedAt
      ]
    );

    await conn.commit();
    const [newCardRows] = await pool.query('SELECT * FROM card_calc WHERE id = ?', [r.insertId]);
    conn.release();
    res.json(normalizeRow(newCardRows[0]));
  } catch (e) {
    await conn.rollback().catch(()=>{});
    conn.release();
    console.error('POST copy error:', e);
    res.status(500).json({ error: 'COPY_FAILED', details: e.message });
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

// (debug route is moved above)

module.exports = router;