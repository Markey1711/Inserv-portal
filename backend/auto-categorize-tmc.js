/**
 * Скрипт для авто-заполнения поля category_id во всех карточках tmc-db.json
 * Запуск: node auto-categorize-tmc.js
 * Файл tmc-db.json должен лежать в той же папке.
 */

const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'tmc-db.json');

const categoryDict = {
  1: 'Расходные материалы',
  2: 'Крупная техника (тракторы, погрузчики и т.д.)',
  3: 'Поломоечные аппараты',
  4: 'Мелкое оборудование (пылесосы, воздуходуйки, газонокосилки и т.д.)',
  5: 'Инвентарь'
};

// Логика для автоматического определения категории
function autoCategoryId(item) {
  const name = (item.name || "").toLowerCase();

  // Категория 3: Поломоечные аппараты
  if (name.match(/поломоечн|scrubber|аппарат/)) return 3;

  // Категория 2: Крупная техника (тракторы, погрузчики и т.д.)
  if (
    name.match(/трактор|погрузчик|комбайн|машина|техника/)
    && !name.match(/моп|швабра|ведро|флакон|аппарат|scrubber|поломоечн/)
  ) return 2;

  // Категория 4: Мелкое оборудование
  if (
    name.match(/пылесос|воздуходуй|газонокосилка|моп|держатель|насадка|швабра|ведро|флакон|инструмент|микрофибра/)
  ) return 4;

  // Категория 5: Инвентарь
  if (
    name.match(/щетка|лопата|грабли|совок|щетина|скребок|инвентарь/)
  ) return 5;

  // Категория 1: Расходные материалы
  if (
    name.match(/бумага|салфетка|мешок|моющее|чистящее|канистра|однораз|химия|рулон|полотенце|пакет/)
  ) return 1;

  // Если не распознано — пусть будет пусто
  return "";
}

function main() {
  if (!fs.existsSync(dbFile)) {
    console.error('Файл tmc-db.json не найден!');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  let updated = 0;
  let unchanged = 0;

  db.forEach(item => {
    const autoCat = autoCategoryId(item);
    if (autoCat && item.category_id !== autoCat) {
      item.category_id = autoCat;
      updated++;
    } else {
      unchanged++;
    }
  });

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  console.log(`Готово! Обновлено: ${updated} карточек, без изменений: ${unchanged}`);
}

main();