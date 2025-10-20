import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Допустимые формы оплаты
const PAYMENT_FORMS = ["С НДС 20%", "Без НДС", "Наличные"];

// Форматирование денег: разделители тысяч и 2 знака после запятой
const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
// Парсинг чисел из инпутов: допускаем запятую
const parseNum = (s) => {
  const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Форматирование даты из ISO в DD.MM.YYYY
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

/**
 * Всплывающий редактор мульти-дат для одной ячейки
 */
function MultiDateEditor({ value, onChange, onClose, anchorRect }) {
  const [dates, setDates] = useState(Array.isArray(value) ? value : []);
  const [newDate, setNewDate] = useState("");

  const add = () => {
    if (!newDate) return;
    const iso = newDate; // YYYY-MM-DD
    if (!dates.includes(iso)) setDates((a) => [...a, iso]);
    setNewDate("");
  };
  const remove = (iso) => setDates((a) => a.filter((x) => x !== iso));
  const save = () => {
    onChange(dates);
    onClose();
  };

  const style = {
    position: "fixed",
    top: Math.round(anchorRect.bottom + 4),
    left: Math.round(anchorRect.left),
    minWidth: Math.round(Math.max(280, anchorRect.width)),
    maxWidth: 440,
    maxHeight: 360,
    overflowY: "auto",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: 8,
    boxShadow: "0 12px 28px rgba(0,0,0,.2)",
    zIndex: 9999,
    padding: 12,
  };

  return createPortal(
    <div style={style}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Даты выплат</div>

      {dates.length === 0 ? (
        <div style={{ color: "#777", marginBottom: 8 }}>Нет дат</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {dates.map((iso) => (
            <div key={iso} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>{fmtDate(iso)}</div>
              <button
                type="button"
                onClick={() => remove(iso)}
                style={{ border: "none", background: "none", color: "#c00", cursor: "pointer" }}
                title="Удалить дату"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
        />
        <button
          type="button"
          onClick={add}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, background: "#f5f5f5", cursor: "pointer" }}
        >
          Добавить
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: "6px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" }}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={save}
          style={{ padding: "6px 12px", border: "1px solid #c59bff", background: "#f5efff", color: "#5427b0", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
        >
          ОК
        </button>
      </div>
    </div>,
    document.body
  );
}

/**
 * Вкладка «Доп. затраты»
 * props:
 *  - data: массив строк затрат
 *  - onChange(nextRows): сохранить массив
 */
export default function ExtrasSheet({ data, onChange }) {
  const rows = Array.isArray(data) ? data : [];

  // Пересчёт одной строки
  const recalcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const price = Number(row.price) || 0;
    const sum = round2(qty * price);
    const paid = Number(row.paid) || 0;
    const remain = round2(sum - paid);
    return { ...row, sum, remain };
  };

  const applyRow = (idx, mutator) => {
    const next = rows.map((r, i) => (i === idx ? recalcRow(mutator({ ...r })) : r));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        name: "",
        qty: 0,
        unit: "",
        price: 0,
        sum: 0, // calc
        contractor: "",
        payment_form: PAYMENT_FORMS[0],
        paid: 0,
        remain: 0, // calc
        pay_dates: [], // массив ISO-дат
      },
    ]);
  };
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  // Итоги: считаем по Сумма, Выплачено, Осталось
  const totals = useMemo(() => {
    const acc = {
      "С НДС 20%": { sum: 0, paid: 0, remain: 0 },
      "Без НДС": { sum: 0, paid: 0, remain: 0 },
      "Наличные": { sum: 0, paid: 0, remain: 0 },
      all: { sum: 0, paid: 0, remain: 0 },
    };
    for (const r of rows) {
      const s = Number(r.sum) || 0;
      const p = Number(r.paid) || 0;
      const rm = Number(r.remain) || 0;
      const key = acc[r.payment_form] ? r.payment_form : null;

      acc.all.sum += s; acc.all.paid += p; acc.all.remain += rm;
      if (key) {
        acc[key].sum += s;
        acc[key].paid += p;
        acc[key].remain += rm;
      }
    }
    const roundObj = (o) => ({
      sum: round2(o.sum),
      paid: round2(o.paid),
      remain: round2(o.remain),
    });
    return {
      vat20: roundObj(acc["С НДС 20%"]),
      noVat: roundObj(acc["Без НДС"]),
      cash: roundObj(acc["Наличные"]),
      all: roundObj(acc.all),
    };
  }, [rows]);

  // Мульти-редактор дат
  const [dateEditIdx, setDateEditIdx] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);

  const openDateEditor = (idx, el) => {
    setDateEditIdx(idx);
    if (el) setAnchorRect(el.getBoundingClientRect());
  };
  const closeDateEditor = () => {
    setDateEditIdx(null);
    setAnchorRect(null);
  };

  // Локальное состояние: какой инпут сейчас в режиме редактирования,
  // чтобы при фокусе показывать «сырой» текст, а вне фокуса — форматировать с разделителями и сотыми
  const [editing, setEditing] = useState({ idx: null, field: null });
  const isEditing = (idx, field) => editing.idx === idx && editing.field === field;

  // Стили таблицы и ячеек
  const tableStyle = { borderCollapse: "separate", borderSpacing: 0, width: "100%", tableLayout: "fixed" };
  const base = {
    border: "1px solid #ddd",
    padding: "7px 6px",
    fontSize: "1rem",
    background: "#fff",
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const th = { ...base, background: "#eee", fontWeight: "bold", textAlign: "center", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25 };
  const ro = { ...base, background: "#f5f5f5", textAlign: "left" };
  const roCenter = { ...ro, textAlign: "center" };
  const roRight = { ...ro, textAlign: "right", paddingRight: 10 };
  const edit = { ...base, background: "#fff" };
  const editCenter = { ...edit, textAlign: "center" };
  const editRight = { ...edit, textAlign: "right" };
  const input = { width: "98%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" };
  const inputCenter = { ...input, textAlign: "center" };
  const inputRight = { ...input, textAlign: "right" };
  const delBtn = { border: "none", background: "none", color: "#c00", fontSize: 18, cursor: "pointer" };

  // Цвет фона для «Осталось выплатить»
  const remainBg = (remain) => {
    const r = Number(remain) || 0;
    const eps = 0.005;
    if (r > eps) return "#ffd9d9"; // красный
    if (r < -eps) return "#ffe9cc"; // оранжевый
    return "#daf5d7"; // зелёный
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={addRow}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #c59bff", background: "#f5efff", color: "#5427b0", fontWeight: 700, cursor: "pointer" }}
        >
          + Добавить строку
        </button>
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: "5%" }} />   {/* № */}
          <col style={{ width: "24%" }} />  {/* Наименование */}
          <col style={{ width: "7%" }} />   {/* Кол-во */}
          <col style={{ width: "8%" }} />   {/* Ед. изм. */}
          <col style={{ width: "10%" }} />  {/* Цена за ед. */}
          <col style={{ width: "10%" }} />  {/* Сумма (RO) */}
          <col style={{ width: "12%" }} />  {/* Подрядчик */}
          <col style={{ width: "12%" }} />  {/* Форма оплаты */}
          <col style={{ width: "12%" }} />  {/* Выплачено */}
          <col style={{ width: "12%" }} />  {/* Осталось выплатить (RO) */}
          <col style={{ width: "12%" }} />  {/* Дата выплаты (мульти) */}
          <col style={{ width: "4%" }} />   {/* удалить */}
        </colgroup>

        <thead>
          <tr>
            <th style={th}>№</th>
            <th style={th}>Наименование</th>
            <th style={th}>Кол.-во</th>
            <th style={th}>Ед. изм.</th>
            <th style={th}>Цена за ед.</th>
            <th style={th}>Сумма</th>
            <th style={th}>Подрядчик</th>
            <th style={th}>Форма оплаты затрат</th>
            <th style={th}>Выплачено</th>
            <th style={th}>Осталось выплатить</th>
            <th style={th}>Дата выплаты</th>
            <th style={th}></th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ ...ro, textAlign: "center", color: "#999", whiteSpace: "normal" }}>
                Нет позиций. Нажмите «Добавить строку».
              </td>
            </tr>
          ) : null}

          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={roCenter}>{idx + 1}</td>

              {/* Наименование */}
              <td style={edit}>
                <input
                  type="text"
                  value={row.name ?? ""}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, name: e.target.value }))}
                  style={input}
                />
              </td>

              {/* Кол-во (формат: разделители и сотые) */}
              <td style={editCenter}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={isEditing(idx, "qty") ? String(row.qty ?? "") : fmtMoney(row.qty)}
                  onFocus={(e) => { e.target.select(); setEditing({ idx, field: "qty" }); }}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, qty: parseNum(e.target.value) }))}
                  onBlur={(e) => { applyRow(idx, (r) => ({ ...r, qty: parseNum(e.target.value) })); setEditing({ idx: null, field: null }); }}
                  style={inputCenter}
                />
              </td>

              {/* Ед. изм. */}
              <td style={editCenter}>
                <input
                  type="text"
                  value={row.unit ?? ""}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, unit: e.target.value }))}
                  style={inputCenter}
                />
              </td>

              {/* Цена за ед. (формат: разделители и сотые) */}
              <td style={editRight}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={isEditing(idx, "price") ? String(row.price ?? "") : fmtMoney(row.price)}
                  onFocus={(e) => { e.target.select(); setEditing({ idx, field: "price" }); }}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, price: parseNum(e.target.value) }))}
                  onBlur={(e) => { applyRow(idx, (r) => ({ ...r, price: parseNum(e.target.value) })); setEditing({ idx: null, field: null }); }}
                  style={inputRight}
                />
              </td>

              {/* Сумма — RO */}
              <td style={roRight}>{fmtMoney(row.sum)}</td>

              {/* Подрядчик */}
              <td style={edit}>
                <input
                  type="text"
                  value={row.contractor ?? ""}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, contractor: e.target.value }))}
                  style={input}
                />
              </td>

              {/* Форма оплаты затрат — select */}
              <td style={edit}>
                <select
                  value={row.payment_form ?? PAYMENT_FORMS[0]}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, payment_form: e.target.value }))}
                  style={{ ...input, paddingRight: 28 }}
                >
                  {PAYMENT_FORMS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </td>

              {/* Выплачено (формат: разделители и сотые) */}
              <td style={editRight}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={isEditing(idx, "paid") ? String(row.paid ?? "") : fmtMoney(row.paid)}
                  onFocus={(e) => { e.target.select(); setEditing({ idx, field: "paid" }); }}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, paid: parseNum(e.target.value) }))}
                  onBlur={(e) => { applyRow(idx, (r) => ({ ...r, paid: parseNum(e.target.value) })); setEditing({ idx: null, field: null }); }}
                  style={inputRight}
                />
              </td>

              {/* Осталось выплатить — RO + цвет */}
              <td style={{ ...roRight, background: remainBg(row.remain) }}>{fmtMoney(row.remain)}</td>

              {/* Дата выплаты — мульти даты в одной ячейке */}
              <td
                style={edit}
                onClick={(e) => openDateEditor(idx, e.currentTarget)}
                title="Кликните, чтобы указать одну или несколько дат выплат"
              >
                <div style={{ width: "100%", cursor: "pointer", minHeight: 24 }}>
                  {Array.isArray(row.pay_dates) && row.pay_dates.length > 0
                    ? row.pay_dates.map(fmtDate).join(", ")
                    : "—"}
                </div>
              </td>

              {/* Удалить строку */}
              <td style={roCenter}>
                <button type="button" onClick={() => removeRow(idx)} style={delBtn} title="Удалить строку">
                  🗑️
                </button>
              </td>
            </tr>
          ))}

          {/* Итоговые строки: выводим ИТОГО для Суммы, Выплачено и Осталось */}
          {rows.length > 0 && (
            <>
              <tr>
                <td style={ro} />
                <td style={{ ...ro, fontWeight: 800 }}>ИТОГО с НДС 20%:</td>
                <td style={ro} />
                <td style={ro} />
                <td style={ro} />
                {/* Сумма */}
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.vat20.sum)}</td>
                <td style={ro} />
                <td style={ro} />
                {/* Выплачено */}
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.vat20.paid)}</td>
                {/* Осталось */}
                <td style={{ ...roRight, fontWeight: 800, background: remainBg(totals.vat20.remain) }}>
                  {fmtMoney(totals.vat20.remain)}
                </td>
                <td style={ro} />
                <td style={ro} />
              </tr>
              <tr>
                <td style={ro} />
                <td style={{ ...ro, fontWeight: 800 }}>ИТОГО без НДС:</td>
                <td style={ro} />
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.noVat.sum)}</td>
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.noVat.paid)}</td>
                <td style={{ ...roRight, fontWeight: 800, background: remainBg(totals.noVat.remain) }}>
                  {fmtMoney(totals.noVat.remain)}
                </td>
                <td style={ro} />
                <td style={ro} />
              </tr>
              <tr>
                <td style={ro} />
                <td style={{ ...ro, fontWeight: 800 }}>ИТОГО Наличные:</td>
                <td style={ro} />
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.cash.sum)}</td>
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.cash.paid)}</td>
                <td style={{ ...roRight, fontWeight: 800, background: remainBg(totals.cash.remain) }}>
                  {fmtMoney(totals.cash.remain)}
                </td>
                <td style={ro} />
                <td style={ro} />
              </tr>
              <tr>
                <td style={ro} />
                <td style={{ ...ro, fontWeight: 800 }}>ВСЕГО по всем позициям:</td>
                <td style={ro} />
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.all.sum)}</td>
                <td style={ro} />
                <td style={ro} />
                <td style={{ ...roRight, fontWeight: 800 }}>{fmtMoney(totals.all.paid)}</td>
                <td style={{ ...roRight, fontWeight: 800, background: remainBg(totals.all.remain) }}>
                  {fmtMoney(totals.all.remain)}
                </td>
                <td style={ro} />
                <td style={ro} />
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Всплывающее окно мульти-дат */}
      {dateEditIdx != null && anchorRect && (
        <MultiDateEditor
          value={rows[dateEditIdx]?.pay_dates}
          anchorRect={anchorRect}
          onChange={(dates) => applyRow(dateEditIdx, (r) => ({ ...r, pay_dates: dates }))}
          onClose={closeDateEditor}
        />
      )}
    </div>
  );
}