/**
 * Скрипт для авто-заполнения поля амортизации у амортизирующихся средств
 * Запуск: node auto-amortization-tmc.js
 * Файл tmc-db.json должен лежать в той же папке.
 */

const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'tmc-db.json');

// соответствие текстовых категорий и месяцев
const categoryAmortizationMap = {
  'спецодежда': 12,
  'крупная техника (тракторы, погрузчики и т.д.)': 60,
  'поломоечные аппараты': 36,
  'мелкое оборудование (пылесосы, воздуходуйки, газонокосилки и т.д.)': 24,
  'инвентарь': 6
};

function getAmortizationValue(categoryName) {
  if (!categoryName || categoryName.trim() === '') return 12;
  const normalized = categoryName.trim().toLowerCase();
  // спецодежда — тоже 12 мес
  if (normalized.includes('спецодежда')) return 12;
  if (normalized.includes('крупная техника')) return 60;
  if (normalized.includes('поломоечные аппарат')) return 36;
  if (normalized.includes('мелкое оборудование')) return 24;
  if (normalized.includes('инвентарь')) return 6;
  return 12; // если ничего не подошло, дефолт 12 мес.
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
    // Только амортизирующиеся средства
    if (String(item.group_id) === '2') {
      // Если амортизация НЕ заполнена или пустая
      if (
        item.amortization_period === undefined ||
        item.amortization_period === null ||
        String(item.amortization_period).trim() === ''
      ) {
        // Категорию ищем сначала по category_name, если нет — category_id по словарю
        let categoryName = item.category_name;
        // Если category_name пусто, можно попробовать category_id и словарь
        if ((!categoryName || categoryName.trim() === '') && item.category_id) {
          // category_id по твоему словарю
          const dict = {
            1: 'Расходные материалы',
            2: 'Крупная техника (тракторы, погрузчики и т.д.)',
            3: 'Поломоечные аппараты',
            4: 'Мелкое оборудование (пылесосы, воздуходуйки, газонокосилки и т.д.)',
            5: 'Инвентарь'
          };
          categoryName = dict[item.category_id] || '';
        }

        item.amortization_period = getAmortizationValue(categoryName);
        updated++;
      } else {
        unchanged++;
      }
    }
  });

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  console.log(`Готово! Установлено амортизацию для ${updated} позиций, не изменено: ${unchanged}`);
}

main();