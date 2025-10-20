import React, { useEffect, useMemo, useRef, useState } from "react";

export default function StaffSheet({
  data,
  onChange,
  // по умолчанию считаем, что вы админ, пока нет системы ролей
  isAdmin = true,
  onEditPositions,
  onEditRegimes,
}) {
  const staffRows = Array.isArray(data) ? data : data?.sheets?.staff || [];

  // Справочники (можно заменить на пропсы/данные из стора)
  const [positionsList] = useState([
    "Контролер качества уборки",
    "Оператор профессиональной уборки",
    "Оператор поломоечной машины",
    "Менеджер объекта",
    "Дворник",
    "Грузчик",
    "Кладовщик",
  ]);
  const [regimesList] = useState(["5/2", "6/1", "2/2", "7/0"]);

  // Глобальный выбор даты выплаты (вне таблицы)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState("");

  // Модалка для полного редактирования комментария
  const [commentModal, setCommentModal] = useState({
    open: false,
    index: null,
    value: "",
  });

  // Формат “ДД месяц ГГГГ” (месяц словами в родительном падеже)
  function formatRuDateVerbose(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mm} ${yyyy}`;
  }

  // Надпись “ЗП выдана <дата>” — показываем, если у всех строк одна и та же дата
  const payoutBannerDate = useMemo(() => {
    if (!Array.isArray(staffRows) || staffRows.length === 0) return "";
    const allDates = staffRows.map((r) => r.date_cash || "").filter(Boolean);
    if (allDates.length === 0) return "";
    const first = allDates[0];
    const same = allDates.every((d) => d === first);
    return same ? formatRuDateVerbose(first) : "";
  }, [staffRows]);

  // Числовые utils
  const formatNum = (v) => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    if (isNaN(n)) return "";
    return n.toLocaleString("ru-RU");
  };
  const parseNum = (s, asInt = false) => {
    if (s === null || s === undefined) return 0;
    const cleaned = String(s).replace(/\s/g, "").replace(",", ".");
    const n = asInt ? parseInt(cleaned, 10) : parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // Пересчёт производных
  function recalcDerived(row) {
    const count = Number(row.count) || 0; // 5
    const salary = Number(row.salary) || 0; // 6
    const cash = Number(row.cash_salary) || 0; // 7
    const card = Number(row.salary_card) || 0; // 8

    const cash_total = cash * count; // 9
    const card_total = card * count; // 10
    const total = salary * count; // 11

    const cash_paid = Number(row.cash_paid) || 0; // 12
    const card_paid = Number(row.card_paid) || 0; // 13

    const cash_left = cash_total - cash_paid; // 14
    const card_left = card_total - card_paid; // 15

    return {
      ...row,
      cash_total,
      card_total,
      total,
      cash_left,
      card_left,
    };
  }

  // Валидация: 7 + 8 == 6
  function isSalarySplitValid(row) {
    const salary = Number(row.salary) || 0;
    const cash = Number(row.cash_salary) || 0;
    const card = Number(row.salary_card) || 0;
    return Math.abs(cash + card - salary) < 0.0001;
  }

  // Применить изменения к одной строке
  function applyRow(idx, mutator) {
    const next = staffRows.map((row, i) => {
      if (i !== idx) return row;
      const updated = mutator({ ...row });
      return recalcDerived(updated);
    });
    onChange(next);
  }

  // Применить изменения ко всем строкам
  function applyAll(mutator) {
    const next = staffRows.map((row) => recalcDerived(mutator({ ...row })));
    onChange(next);
  }

  // Добавление НОВОЙ строки (кнопка)
  function makeEmptyRow() {
    return {
      position: "",
      regime: "",
      time_from: "",
      time_to: "",
      count: 1,
      salary: 0,
      cash_salary: 0,
      salary_card: 0,
      cash_total: 0,
      card_total: 0,
      total: 0,
      cash_paid: 0,
      card_paid: 0,
      cash_left: 0,
      card_left: 0,
      comment: "",
      date_cash: "",
    };
  }
  function handleAddRow() {
    const row = recalcDerived(makeEmptyRow());
    onChange([...(staffRows || []), row]);
  }

  // Обработчики

  // 5. Кол-во
  function handleCountChange(idx, valStr) {
    const val = Math.max(0, parseNum(valStr, true));
    applyRow(idx, (row) => ({ ...row, count: val }));
  }

  // 6. З/П на руки: автосплит 70/30, если 7 и 8 не вводились руками
  function handleSalaryChange(idx, valStr) {
    const salary = Math.max(0, parseNum(valStr));
    applyRow(idx, (row) => {
      let cash = Number(row.cash_salary) || 0;
      let card = Number(row.salary_card) || 0;

      const cashManual = !!row._cashManual;
      const cardManual = !!row._cardManual;

      if (!cashManual && !cardManual) {
        cash = round2(salary * 0.7);
        card = round2(salary - cash);
      } else if (cashManual && !cardManual) {
        card = Math.max(0, round2(salary - cash));
      } else if (!cashManual && cardManual) {
        cash = Math.max(0, round2(salary - card));
      }
      return { ...row, salary, cash_salary: cash, salary_card: card };
    });
  }

  // 7. Нал на 1 чел.
  function handleCashChange(idx, valStr) {
    const cash = Math.max(0, parseNum(valStr));
    applyRow(idx, (row) => {
      let card = Number(row.salary_card) || 0;
      const salary = Number(row.salary) || 0;
      if (!row._cardManual) {
        card = Math.max(0, round2(salary - cash));
      }
      return { ...row, cash_salary: cash, salary_card: card, _cashManual: true };
    });
  }

  // 8. На карту на 1 чел.
  function handleCardChange(idx, valStr) {
    const card = Math.max(0, parseNum(valStr));
    applyRow(idx, (row) => {
      let cash = Number(row.cash_salary) || 0;
      const salary = Number(row.salary) || 0;
      if (!row._cashManual) {
        cash = Math.max(0, round2(salary - card));
      }
      return { ...row, salary_card: card, cash_salary: cash, _cardManual: true };
    });
  }

  // 12. Выплачено наличный ФОТ (до подтверждения даты — редактируемое; после — блокируем)
  function handlePaidCashChange(idx, valStr) {
    const cash_paid = Math.max(0, parseNum(valStr));
    applyRow(idx, (row) => ({ ...row, cash_paid }));
  }

  // 13. Выплачено на карту ФОТ
  function handlePaidCardChange(idx, valStr) {
    const card_paid = Math.max(0, parseNum(valStr));
    applyRow(idx, (row) => ({ ...row, card_paid }));
  }

  function handleSimpleChange(idx, field, value) {
    applyRow(idx, (row) => ({ ...row, [field]: value }));
  }

  function handleDeleteRow(idx) {
    const next = staffRows.filter((_, i) => i !== idx);
    onChange(next);
  }

  // Кнопка “Дата выдачи зп.” (вне таблицы)
  function openGlobalPicker() {
    setPickerDate(pickerDate || new Date().toISOString().slice(0, 10));
    setPickerOpen(true);
  }
  function cancelGlobalPicker() {
    setPickerOpen(false);
  }
  function confirmGlobalPicker() {
    const chosen = pickerDate || new Date().toISOString().slice(0, 10);
    // Проставляем всем строкам и блокируем редактирование "Выплачено"
    applyAll((row) => ({
      ...row,
      date_cash: chosen,
      cash_paid: row.cash_total || 0,
      card_paid: row.card_total || 0,
      _payoutLocked: true,
    }));
    setPickerOpen(false);
  }

  // Видна ли надпись “ЗП выдана ...”
  const payoutLockedAll =
    staffRows.length > 0 && staffRows.every((r) => !!r._payoutLocked);

  // ====== ИТОГИ (№6 и №10–16) ======
  const isManagerRow = (row) =>
    String(row?.position || "").toLowerCase().includes("менедж");

  function computeTotals(rows, { excludeManagers = false } = {}) {
    const filtered = Array.isArray(rows)
      ? rows.filter((r) => (excludeManagers ? !isManagerRow(r) : true))
      : [];

    const sums = {
      count: 0,         // №6
      cash_total: 0,    // №10
      card_total: 0,    // №11
      total: 0,         // №12
      cash_paid: 0,     // №13
      card_paid: 0,     // №14
      cash_left: 0,     // №15
      card_left: 0,     // №16
    };

    for (const r of filtered) {
      sums.count      += Number(r.count) || 0;
      sums.cash_total += Number(r.cash_total) || 0;
      sums.card_total += Number(r.card_total) || 0;
      sums.total      += Number(r.total) || 0;
      sums.cash_paid  += Number(r.cash_paid) || 0;
      sums.card_paid  += Number(r.card_paid) || 0;
      sums.cash_left  += Number(r.cash_left) || 0;
      sums.card_left  += Number(r.card_left) || 0;
    }
    // округление до 2 знаков
    Object.keys(sums).forEach((k) => (sums[k] = round2(sums[k])));
    return sums;
  }

  const sumsNoMgr = useMemo(
    () => computeTotals(staffRows, { excludeManagers: true }),
    [staffRows]
  );
  const sumsAll = useMemo(
    () => computeTotals(staffRows, { excludeManagers: false }),
    [staffRows]
  );

  // ====== UI: стили ======
  const wrapperStyle = { width: "100%", margin: 0, padding: 0 };

  // Верхняя панель: слева — действия; справа — дата выдачи ЗП
  const toolbarRow = {
    width: "100%",
    marginBottom: 8,
    minHeight: 36,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };
  const leftActions = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  };
  const dateRight = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const badge = {
    padding: "6px 10px",
    background: "#e7f6d4",
    border: "1px solid #8bc34a",
    borderRadius: 6,
    fontWeight: "bold",
    color: "#2e7d32",
    whiteSpace: "nowrap",
  };

  const cellStyle = {
    border: "1px solid #ddd",
    padding: "7px 6px",
    fontSize: "1rem",
    textAlign: "center",
    background: "#fff",
    verticalAlign: "top",
  };
  const cellGray = { ...cellStyle, background: "#eee", fontWeight: "bold" };

  // Фикс «наезжания» числовых ячеек: nowrap + скрытие переполнения
  const editableRight = {
    ...cellStyle,
    textAlign: "right",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const editableLeft = { ...cellStyle, textAlign: "left" };
  const readOnlyBox = {
    ...cellGray,
    textAlign: "right",
    paddingRight: 10,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const inputNum = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    textAlign: "right",
    boxSizing: "border-box",
  };
  const inputText = {
    width: "95%",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 4,
    textAlign: "left",
  };
  const disabledInput = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ddd",
    borderRadius: 4,
    textAlign: "right",
    background: "#eee",
    color: "#555",
    cursor: "not-allowed",
    boxSizing: "border-box",
  };

  const btn = {
    padding: "6px 10px",
    border: "1px solid #8bc34a",
    background: "#e7f6d4",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  };
  const btnSecondary = {
    padding: "6px 10px",
    border: "1px solid #ccc",
    background: "#f5f5f5",
    borderRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  // Итого: стили футера
  const footNum = { ...readOnlyBox, background: "#f5f5f5", fontWeight: 700 };
  const footLabel = {
    ...cellGray,
    background: "#f5f5f5",
    fontWeight: 800,
    textAlign: "left",
  };
  const footEmpty = { background: "#f5f5f5", border: "1px solid #ddd" };

  // ====== Кастомный выпадающий список для Должности ======
  function PositionSelect({ value, onChange, options }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      function onDocClick(e) {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const selectedLabel = value || "";

    return (
      <div ref={containerRef} style={{ position: "relative", width: "98%" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={selectedLabel}
          style={{
            width: "100%",
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 4,
            textAlign: "left",
            background: "#fff",
            cursor: "pointer",
            minHeight: 36,
          }}
        >
          <div
            style={{
              whiteSpace: "normal",
              wordBreak: "break-word",
              lineHeight: 1.25,
            }}
          >
            {selectedLabel || "— выберите должность —"}
          </div>
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              zIndex: 10,
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: 240,
              overflowY: "auto",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              boxShadow: "0 6px 16px rgba(0,0,0,.15)",
              marginTop: 4,
            }}
          >
            <div
              style={{
                padding: 6,
                borderBottom: "1px solid #eee",
                fontSize: 12,
                color: "#666",
              }}
            >
              Справочник должностей
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 10px",
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#666",
              }}
            >
              — очистить —
            </button>
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  textAlign: "left",
                  border: "none",
                  background: opt === value ? "#e7f6d4" : "transparent",
                  cursor: "pointer",
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  lineHeight: 1.25,
                }}
                title={opt}
              >
                {opt}
              </button>
            ))}
            {isAdmin && (
              <div style={{ padding: 8, borderTop: "1px solid #eee" }}>
                <button
                  type="button"
                  style={btn}
                  onClick={() =>
                    onEditPositions
                      ? onEditPositions()
                      : alert("Редактирование справочника должностей")
                  }
                >
                  Редактировать справочник Должностей
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ====== Компонент модалки для комментария ======
  function openCommentModal(idx) {
    setCommentModal({
      open: true,
      index: idx,
      value: staffRows[idx]?.comment || "",
    });
  }
  function closeCommentModal() {
    setCommentModal({ open: false, index: null, value: "" });
  }
  function saveCommentModal() {
    if (commentModal.index === null) return closeCommentModal();
    applyRow(commentModal.index, (row) => ({ ...row, comment: commentModal.value }));
    closeCommentModal();
  }

  // Рендер строки итогов на всю ширину таблицы (18 колонок)
  const COLS_COUNT = 18;
  const LABEL_COL = 2; // колонка "Должность" — сюда пишем «Итого ...»
  function renderTotalsRow(label, sums) {
    const cells = [];
    for (let col = 1; col <= COLS_COUNT; col++) {
      if (col === LABEL_COL) {
        cells.push(
          <td key={`l-${col}`} style={footLabel}>{label}</td>
        );
        continue;
      }
      switch (col) {
        case 6:  cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.count)}</td>); break;
        case 10: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.cash_total)}</td>); break;
        case 11: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.card_total)}</td>); break;
        case 12: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.total)}</td>); break;
        case 13: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.cash_paid)}</td>); break;
        case 14: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.card_paid)}</td>); break;
        case 15: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.cash_left)}</td>); break;
        case 16: cells.push(<td key={`c-${col}`} style={footNum}>{formatNum(sums.card_left)}</td>); break;
        default:
          cells.push(<td key={`e-${col}`} style={footEmpty} />);
      }
    }
    return <tr>{cells}</tr>;
  }

  return (
    <div style={wrapperStyle}>
      {/* Верхняя панель */}
      <div style={toolbarRow}>
        {/* Слева: действия */}
        <div style={leftActions}>
          <button style={btn} onClick={handleAddRow}>+ Добавить строку</button>

          {isAdmin && (
            <>
              <button
                style={btn}
                onClick={() =>
                  onEditPositions
                    ? onEditPositions()
                    : alert("Открыть редактирование справочника Должностей (доступно только администратору).")
                }
              >
                Редактировать справочник Должностей
              </button>
              <button
                style={btn}
                onClick={() =>
                  onEditRegimes
                    ? onEditRegimes()
                    : alert("Открыть редактирование справочника Режимов (доступно только администратору).")
                }
              >
                Редактировать справочник Режимов
              </button>
            </>
          )}
        </div>

        {/* Справа: дата выдачи ЗП */}
        <div style={dateRight}>
          {!pickerOpen ? (
            <>
              <button style={btn} onClick={openGlobalPicker}>
                Дата выдачи зп.
              </button>
              {payoutBannerDate && (
                <span style={badge}>ЗП выдана {payoutBannerDate}</span>
              )}
            </>
          ) : (
            <>
              <input
                type="date"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
              />
              <button style={btn} onClick={confirmGlobalPicker}>
                Ок
              </button>
              <button style={btnSecondary} onClick={cancelGlobalPicker}>
                Отмена
              </button>
            </>
          )}
        </div>
      </div>

      {/* Фикс наезжания: tableLayout fixed */}
      <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ ...cellGray, width: "2%" }}>№</th>
            <th style={{ ...cellGray, width: "18%" }}>Должность</th>
            <th style={{ ...cellGray, width: "8%" }}>Режим</th>
            <th style={{ ...cellGray, width: "8%" }}>Время С</th>
            <th style={{ ...cellGray, width: "8%" }}>Время По</th>
            <th style={{ ...cellGray, width: "7%" }}>
              Кол-во<br />чел. в смену
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              З/П на руки<br />на 1 чел.
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Наличная<br />з/п на 1 чел.
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              На карту з/п<br />в мес.<br />на 1 чел.
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Итого наличный<br />ФОТ руб.
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Итого на карту<br />ФОТ (на руки)
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Общий ФОТ<br />(Карта+Нал)
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Выплачено<br />наличный ФОТ
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Выплачено<br />на карту ФОТ
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Осталось выдать<br />наличный ФОТ
            </th>
            <th style={{ ...cellGray, width: "8%" }}>
              Осталось выдать<br />на карту ФОТ
            </th>
            <th style={{ ...cellGray, width: "12%" }}>Комментарий</th>
            <th style={{ ...cellGray, width: "3%" }}></th>
          </tr>
        </thead>
        <tbody>
          {staffRows.length === 0 && (
            <tr>
              <td colSpan={18} style={{ ...cellStyle, textAlign: "center", color: "#aaa" }}>
                Нет данных
              </td>
            </tr>
          )}

          {staffRows.map((row, idx) => {
            const valid = isSalarySplitValid(row);
            const salaryCellStyle = {
              ...editableRight,
              background: valid ? "#e7f6d4" : "#ffeaea",
            };
            const paidLocked = !!row._payoutLocked;

            return (
              <tr key={idx}>
                <td style={cellGray}>{idx + 1}</td>

                {/* Должность — custom dropdown с переносом выбранного текста */}
                <td style={{ ...editableLeft }}>
                  <PositionSelect
                    value={row.position || ""}
                    onChange={(val) => handleSimpleChange(idx, "position", val)}
                    options={positionsList}
                  />
                </td>

                {/* Режим — нативный select (редактирование справочника — вверху) */}
                <td>
                  <select
                    value={row.regime || ""}
                    onChange={(e) => handleSimpleChange(idx, "regime", e.target.value)}
                    style={{ ...cellStyle, width: "98%", padding: "6px 4px" }}
                  >
                    <option value="">---</option>
                    {regimesList.map((r, i) => (
                      <option key={i} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Время С */}
                <td style={editableLeft}>
                  <input
                    type="time"
                    value={row.time_from || ""}
                    onChange={(e) => handleSimpleChange(idx, "time_from", e.target.value)}
                    style={{ ...inputText, textAlign: "center" }}
                  />
                </td>

                {/* Время По */}
                <td style={editableLeft}>
                  <input
                    type="time"
                    value={row.time_to || ""}
                    onChange={(e) => handleSimpleChange(idx, "time_to", e.target.value)}
                    style={{ ...inputText, textAlign: "center" }}
                  />
                </td>

                {/* 5. Кол-во */}
                <td style={editableRight}>
                  <input
                    type="text"
                    value={formatNum(row.count)}
                    onChange={(e) => handleCountChange(idx, e.target.value)}
                    style={inputNum}
                  />
                </td>

                {/* 6. З/П на руки — проверка суммы */}
                <td style={salaryCellStyle}>
                  <input
                    type="text"
                    value={formatNum(row.salary)}
                    onChange={(e) => handleSalaryChange(idx, e.target.value)}
                    style={inputNum}
                  />
                  {!valid && (
                    <div style={{ color: "#c00", fontSize: 12, marginTop: 4, textAlign: "left" }}>
                      сумма наличной зп и на карту не совпадает с суммой зп на руки. введите корректные значения
                    </div>
                  )}
                </td>

                {/* 7. Наличная з/п */}
                <td style={editableRight}>
                  <input
                    type="text"
                    value={formatNum(row.cash_salary)}
                    onChange={(e) => handleCashChange(idx, e.target.value)}
                    style={inputNum}
                  />
                </td>

                {/* 8. На карту з/п */}
                <td style={editableRight}>
                  <input
                    type="text"
                    value={formatNum(row.salary_card)}
                    onChange={(e) => handleCardChange(idx, e.target.value)}
                    style={inputNum}
                  />
                </td>

                {/* 9. Итого наличный ФОТ */}
                <td style={readOnlyBox}>{formatNum(row.cash_total)}</td>

                {/* 10. Итого на карту ФОТ */}
                <td style={readOnlyBox}>{formatNum(row.card_total)}</td>

                {/* 11. Общий ФОТ */}
                <td style={readOnlyBox}>{formatNum(row.total)}</td>

                {/* 12. Выплачено наличный ФОТ (после даты — нередакт.) */}
                <td style={paidLocked ? readOnlyBox : editableRight}>
                  <input
                    type="text"
                    value={formatNum(row.cash_paid)}
                    onChange={(e) => !paidLocked && handlePaidCashChange(idx, e.target.value)}
                    style={paidLocked ? disabledInput : inputNum}
                    disabled={paidLocked}
                  />
                </td>

                {/* 13. Выплачено на карту ФОТ */}
                <td style={paidLocked ? readOnlyBox : editableRight}>
                  <input
                    type="text"
                    value={formatNum(row.card_paid)}
                    onChange={(e) => !paidLocked && handlePaidCardChange(idx, e.target.value)}
                    style={paidLocked ? disabledInput : inputNum}
                    disabled={paidLocked}
                  />
                </td>

                {/* 14. Осталось выдать наличный ФОТ */}
                <td style={readOnlyBox}>{formatNum(row.cash_left)}</td>

                {/* 15. Осталось выдать на карту ФОТ */}
                <td style={readOnlyBox}>{formatNum(row.card_left)}</td>

                {/* 16. Комментарий — без прокрутки, кликабельно открывает модалку */}
                <td style={editableLeft}>
                  <button
                    type="button"
                    onClick={() => openCommentModal(idx)}
                    title="Открыть комментарий"
                    style={{
                      width: "95%",
                      minHeight: 36,
                      padding: "6px 8px",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      textAlign: "left",
                      background: "#fff",
                      cursor: "pointer",
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                      lineHeight: 1.25,
                    }}
                  >
                    {row.comment ? row.comment : "Комментарий"}
                  </button>
                </td>

                {/* 17. Удаление */}
                <td>
                  <button
                    onClick={() => handleDeleteRow(idx)}
                    style={{ color: "#c00", fontWeight: "bold", background: "none", border: "none", cursor: "pointer" }}
                    title="Удалить строку"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Итоги */}
        <tfoot>
          {renderTotalsRow("Итого без учета менеджера:", sumsNoMgr)}
          {renderTotalsRow("Итого:", sumsAll)}
        </tfoot>
      </table>

      {/* Модалка редактирования комментария */}
      {commentModal.open && (
        <div
          onClick={closeCommentModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(800px, 95vw)",
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 18 }}>
              Комментарий к строке {commentModal.index !== null ? commentModal.index + 1 : ""}
            </div>
            <textarea
              autoFocus
              value={commentModal.value}
              onChange={(e) => setCommentModal((s) => ({ ...s, value: e.target.value }))}
              rows={10}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "10px 12px",
                border: "1px solid #ccc",
                borderRadius: 6,
                fontSize: 16,
                lineHeight: 1.4,
              }}
              placeholder="Введите комментарий"
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={closeCommentModal}>
                Отмена
              </button>
              <button style={btn} onClick={saveCommentModal}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}