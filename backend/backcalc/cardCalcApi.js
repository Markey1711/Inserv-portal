const express = require('express');
const router = express.Router();
const pool = require('../db'); // Подключение к MySQL через db.js

// Получить все карточки расчёта
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM card_calc ORDER BY objectCode');
    // Десериализация areaTable для всех карточек
    const result = rows.map(card => ({
      ...card,
      areaTable: card.areaTable ? JSON.parse(card.areaTable) : []
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Получить одну карточку по objectCode
router.get('/:id', async (req, res) => {
  try {
    const objectCode = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM card_calc WHERE objectCode = ?', [objectCode]);
    if (!rows[0]) {
      return res.status(404).json({ notFound: true });
    }
    // Десериализация areaTable
    const card = rows[0];
    card.areaTable = card.areaTable ? JSON.parse(card.areaTable) : [];
    res.json(card);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Сохранить новую карточку
router.post('/', async (req, res) => {
  try {
    const [last] = await pool.query('SELECT MAX(objectCode) AS maxCode FROM card_calc');
    const nextCode = (last[0].maxCode || 0) + 1;
    const {
      objectName,
      address,
      comment,
      company,
      customer,
      areaTable = []
    } = req.body;
    const [result] = await pool.query(
      'INSERT INTO card_calc (objectCode, objectName, address, comment, company, customer, areaTable) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nextCode, objectName, address, comment, company, customer, JSON.stringify(areaTable)]
    );
    const [newCardRows] = await pool.query('SELECT * FROM card_calc WHERE id = ?', [result.insertId]);
    const newCard = newCardRows[0];
    newCard.areaTable = newCard.areaTable ? JSON.parse(newCard.areaTable) : [];
    res.json(newCard);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Обновить карточку (PATCH)
router.patch('/:id', async (req, res) => {
  try {
    const objectCode = Number(req.params.id);
    const {
      objectName,
      address,
      comment,
      company,
      customer,
      areaTable = []
    } = req.body;

    // Обновляем все поля, кроме objectCode
    await pool.query(
      'UPDATE card_calc SET objectName=?, address=?, comment=?, company=?, customer=?, areaTable=? WHERE objectCode=?',
      [objectName, address, comment, company, customer, JSON.stringify(areaTable), objectCode]
    );
    // Возвращаем обновлённую карточку
    const [rows] = await pool.query('SELECT * FROM card_calc WHERE objectCode = ?', [objectCode]);
    if (!rows[0]) {
      return res.status(404).json({ notFound: true });
    }
    const card = rows[0];
    card.areaTable = card.areaTable ? JSON.parse(card.areaTable) : [];
    res.json(card);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Удалить карточку
router.delete('/:id', async (req, res) => {
  try {
    const objectCode = Number(req.params.id);
    await pool.query('DELETE FROM card_calc WHERE objectCode = ?', [objectCode]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;