// server.js — backend для карточек и ТМЦ (роуты вынесены в отдельные модули)
try { require('dotenv').config(); console.log('dotenv loaded'); } catch { console.log('dotenv not found — continue'); }

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// метка версии
app.use((req, res, next) => {
  res.setHeader('X-Backend', 'cardcalc-keyset-autosafe+tmc-categories-v1');
  next();
});

// ====== JSON-справочники ТМЦ (файлы) ======
const loadJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const saveJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const groupsFile = path.join(__dirname, 'tmc-groups.json');
const categoriesFile = path.join(__dirname, 'tmc-categories.json');
const tmcDbFile = path.join(__dirname, 'tmc-db.json');

// Отдаём фото (если когда-то добавите загрузку)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Группы
app.get('/api/tmc/groups', (_req, res) => res.json(loadJson(groupsFile)));
app.post('/api/tmc/groups', (req, res) => {
  const arr = loadJson(groupsFile);
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Empty name' });
  const newId = arr.length ? Math.max(...arr.map(x => Number(x.id) || 0)) + 1 : 1;
  const rec = { id: newId, name };
  arr.push(rec);
  saveJson(groupsFile, arr);
  res.json(rec);
});
app.delete('/api/tmc/groups/:id', (req, res) => {
  const arr = loadJson(groupsFile);
  const id = String(req.params.id);
  const next = arr.filter(g => String(g.id) !== id);
  if (next.length === arr.length) return res.status(404).json({ ok: false, error: 'Not found' });
  saveJson(groupsFile, next);
  res.json({ ok: true });
});

// Категории (вернули эндпоинты)
app.get('/api/tmc/categories', (_req, res) => res.json(loadJson(categoriesFile)));
app.post('/api/tmc/categories', (req, res) => {
  const arr = loadJson(categoriesFile);
  const name = String(req.body?.name || '').trim();
  const groupId = Number(req.body?.groupId);
  if (!name || !groupId) return res.status(400).json({ error: 'name and groupId required' });
  const newId = arr.length ? Math.max(...arr.map(x => Number(x.id) || 0)) + 1 : 1;
  const rec = { id: newId, name, groupId };
  arr.push(rec);
  saveJson(categoriesFile, arr);
  res.json(rec);
});
app.delete('/api/tmc/categories/:id', (req, res) => {
  const arr = loadJson(categoriesFile);
  const id = String(req.params.id);
  const next = arr.filter(c => String(c.id) !== id);
  if (next.length === arr.length) return res.status(404).json({ ok: false, error: 'Not found' });
  saveJson(categoriesFile, next);
  res.json({ ok: true });
});

// ТМЦ записи
app.get('/api/tmc', (_req, res) => res.json(loadJson(tmcDbFile)));
app.post('/api/tmc', (req, res) => {
  const arr = loadJson(tmcDbFile);
  const item = req.body || {};
  if (item.id) {
    const idx = arr.findIndex(x => String(x.id) === String(item.id));
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], ...item };
      saveJson(tmcDbFile, arr);
      return res.json(arr[idx]);
    }
  }
  const newId = String(Date.now());
  const maxCode = arr.length ? Math.max(...arr.map(i => Number(i.code) || 0)) : 0;
  const code = item.code && !isNaN(Number(item.code)) ? item.code : maxCode + 1;
  const created = { ...item, id: newId, code };
  arr.push(created);
  saveJson(tmcDbFile, arr);
  res.json(created);
});
app.delete('/api/tmc/:id', (req, res) => {
  const arr = loadJson(tmcDbFile);
  const id = String(req.params.id);
  const next = arr.filter(i => String(i.id) !== id);
  if (next.length === arr.length) return res.status(404).json({ ok: false, error: 'Not found' });
  saveJson(tmcDbFile, next);
  res.json({ ok: true });
});

// ====== Подключаем маршруты карточек и объектов (вынесены в отдельные модули) ======
// Убедитесь, что файлы backend/cardCalc.js и backend/routes/objects.js присутствуют
try {
  const cardCalcRouter = require('./cardCalc');
  app.use('/api/card-calc', cardCalcRouter);
} catch (e) {
  console.error('Failed to mount /api/card-calc router:', e);
}

try {
  const objectsRouter = require('./routes/objects');
  app.use('/api/objects', objectsRouter);
} catch (e) {
  console.error('Failed to mount /api/objects router:', e);
}

// Дебаг и health
app.get('/api/card-calc/_debug', (_req, res) => res.json({ ok: true, msg: 'If this route is handled by cardCalc router, this will be overridden there.' }));
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});