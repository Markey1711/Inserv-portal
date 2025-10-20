const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Подключение к базе

const app = express();
app.use(cors());
app.use(express.json());

// Список всех ТМЦ
app.get('/api/tmc', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM tmc');
  res.json(rows);
});

// Получение одной карточки ТМЦ
app.get('/api/tmc/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM tmc WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// Добавление новой карточки ТМЦ
app.post('/api/tmc', async (req, res) => {
  const { name, group_id, category_id, unit, price, norma, supplier_link, comment, photo_url } = req.body;
  const [maxRows] = await pool.query('SELECT MAX(code) as maxCode FROM tmc');
  const nextCode = (maxRows[0].maxCode || 0) + 1;

  const [result] = await pool.query(
    'INSERT INTO tmc (code, name, group_id, category_id, unit, price, norma, supplier_link, comment, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [nextCode, name, group_id, category_id, unit, price, norma, supplier_link, comment, photo_url]
  );
  res.json({ id: result.insertId, code: nextCode });
});

// ...другие маршруты (редактирование, удаление, группы, категории и т.д.)

app.get('/', (req, res) => {
  res.send('Приложение работает!');
});

app.listen(3001, () => {
  console.log('Сервер запущен на порту 3001');
});