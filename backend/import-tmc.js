/**
 * Запуск:
 *   node import-tmc.js "D:/path/Справочник.xlsx"
 * или
 *   node import-tmc.js "D:/path/data.csv"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dbFile = path.join(__dirname, 'tmc-db.json');

function loadDb() {
  if (!fs.existsSync(dbFile)) return [];
  return JSON.parse(fs.readFileSync(dbFile));
}
function saveDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

// === Копия вспомогательных функций из server.js (упрощённая) ===
function normalizeHeader(h) {
  if (!h) return "";
  return h.toString().trim().toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/ё/g, 'е');
}
const headerMapVariants = {
  code: ['код', 'id', 'артикул'],
  name: ['наименование', 'название', 'имя', 'товар'],
  group_name: ['группа'],
  category_name: ['категория'],
  unit: ['едизм', 'единицаизмерения', 'единица', 'ед', 'unit'],
  price: ['цена', 'стоимость', 'price'],
  supplier_link: ['поставщик', 'supplier', 'ссылка', 'линк', 'url'],
  comment: ['комментарий', 'примечание', 'описание', 'note'],
  photo_url: ['фото', 'изображение', 'image', 'photo', 'photourl'],
  amortization_period: ['амортизация', 'амортизациямес', 'срокамортизации', 'аморт', 'amortization', 'amortizationperiod']
};
function buildHeaderMapping(rawHeaders) {
  const mapping = {};
  rawHeaders.forEach((raw, idx) => {
    const nh = normalizeHeader(raw);
    for (const targetField of Object.keys(headerMapVariants)) {
      if (headerMapVariants[targetField].includes(nh)) {
        mapping[idx] = targetField;
        break;
      }
    }
  });
  return mapping;
}
function determineGroupId(groupName) {
  if (!groupName) return "";
  const n = groupName.toLowerCase();
  if (n.includes('расход')) return 1;
  if (n.includes('аморт') || n.includes('основ') || n.includes('средств')) return 2;
  return "";
}
function rowToCard(rowObj) {
  if (rowObj.price !== undefined && rowObj.price !== "") {
    const p = Number(rowObj.price);
    if (!isNaN(p)) rowObj.price = p;
  }
  if (rowObj.amortization_period !== undefined && rowObj.amortization_period !== "") {
    const a = Number(rowObj.amortization_period);
    if (!isNaN(a)) rowObj.amortization_period = a;
  }
  if (rowObj.code !== undefined && rowObj.code !== "") {
    const c = Number(rowObj.code);
    if (!isNaN(c)) rowObj.code = c;
  }
  if (!rowObj.group_id && rowObj.group_name) {
    rowObj.group_id = determineGroupId(rowObj.group_name);
  }
  return {
    code: rowObj.code ?? "",
    name: rowObj.name ?? "",
    group_name: rowObj.group_name ?? "",
    category_name: rowObj.category_name ?? "",
    group_id: rowObj.group_id ?? "",
    category_id: "",
    unit: rowObj.unit ?? "",
    price: rowObj.price ?? "",
    supplier_link: rowObj.supplier_link ?? "",
    comment: rowObj.comment ?? "",
    photo_url: rowObj.photo_url ?? "",
    amortization_period: rowObj.amortization_period ?? ""
  };
}

// === Основной импорт ===
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Укажи путь к Excel/CSV файлу: node import-tmc.js path/to/file.xlsx");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error("Файл не найден:", filePath);
    process.exit(1);
  }

  console.log("Импорт из:", filePath);
  const workbook = XLSX.readFile(filePath, { codepage: 65001 });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  if (rows.length === 0) {
    console.error("Файл пустой");
    process.exit(1);
  }

  const headerRow = rows[0];
  const headerMapping = buildHeaderMapping(headerRow);

  const db = loadDb();
  let created = 0;
  let updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowObj = {};
    Object.entries(headerMapping).forEach(([colIdx, fieldName]) => {
      const cellVal = row[colIdx];
      if (cellVal !== undefined && cellVal !== null && cellVal !== "") {
        rowObj[fieldName] = (typeof cellVal === 'string') ? cellVal.trim() : cellVal;
      }
    });

    if (!rowObj.name && !rowObj.code) continue;

    const card = rowToCard(rowObj);

    let idx = -1;
    if (card.code !== "" && card.code !== undefined) {
      idx = db.findIndex(x => x.code == card.code);
    }
    if (idx === -1 && card.name) {
      idx = db.findIndex(x => (x.name || "").trim().toLowerCase() === card.name.trim().toLowerCase());
    }

    if (idx > -1) {
      db[idx] = { ...db[idx], ...card };
      updated++;
    } else {
      card.id = Date.now() + r;
      db.push(card);
      created++;
    }
  }

  saveDb(db);
  console.log(`Готово. Всего: ${created + updated}. Создано: ${created}, обновлено: ${updated}. В базе теперь: ${db.length}`);
}

main();