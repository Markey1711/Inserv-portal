import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Настройка маршрута карточки ТМЦ — при необходимости поменяйте путь */
const makeTmcUrl = (id) => `http://localhost:3000/tmc/${id}`;

/* Общие утилиты */
const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPercent = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseNum = (s) => {
  const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function TmcSheet({ data, onChange }) {
  const rows = Array.isArray(data) ? data : [];

  const [tmcDict, setTmcDict] = useState([]);
  const [groups, setGroups] = useState([]);

  const loadDicts = () => {
    fetch("http://localhost:3001/api/tmc")
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? setTmcDict(arr) : setTmcDict([])))
      .catch(() => setTmcDict([]));

    fetch("http://localhost:3001/api/tmc/groups")
      .then((r) => r.json())
      .then((arr) => (Array.isArray(arr) ? setGroups(arr) : setGroups([])))
      .catch(() => setGroups([]));
  };

  useEffect(() => {
    loadDicts();
    const onFocus = () => loadDicts(); // вернулись с карточки ТМЦ — обновим справочник
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const groupNameById = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(String(g.id), String(g.name || ""));
    return map;
  }, [groups]);

  // Разрешаем только «Расходные материалы» на этой вкладке
  const isConsumable = (item) => {
    const byName = String(item?.groupName || item?.group || "").toLowerCase().includes("расходн");
    if (byName) return true;
    const gid = item?.group_id ?? item?.groupId ?? item?.groupID;
    if (gid !== undefined && gid !== null) {
      const name = String(groupNameById.get(String(gid)) || "").toLowerCase();
      if (name.includes("расходн")) return true;
    }
    return false;
  };
  const consumablesDict = useMemo(() => tmcDict.filter(isConsumable), [tmcDict, groupNameById]);

  // Пересчёт строки
  const recalcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const price = Number(row.price) || 0;
    const forSale = !!row.for_sale;
    const salePrice = Number(row.sale_price) || 0;

    const total = round2(qty * price);

    const saleQty = forSale ? qty : 0;
    const saleSum = round2(saleQty * salePrice);
    const costForSale = round2(saleQty * price);
    const profit = round2(saleSum - costForSale);
    const margin = costForSale > 0 ? round2((profit / costForSale) * 100) : 0;

    return { ...row, total, sale_qty: saleQty, sale_sum: saleSum, profit, margin_percent: margin };
  };

  const applyRow = (idx, mutator) => {
    const next = rows.map((r, i) => (i === idx ? recalcRow(mutator({ ...r })) : r));
    onChange(next);
  };
  const applyAll = (mutator) => {
    const next = rows.map((r) => recalcRow(mutator({ ...r })));
    onChange(next);
  };

  const addEmptyRow = () => {
    onChange([
      ...rows,
      {
        tmc_id: null,
        name: "",
        code: "",
        unit: "",
        price: 0,
        qty: 0,
        total: 0,
        supplier_link: "",
        for_sale: false,
        sale_price: 0,
        sale_sum: 0,
        margin_percent: 0,
        profit: 0,
      },
    ]);
  };
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  // Выбор позиции — цена фиксируется в карточке
  const onPickTmc = (idx, item) => {
    if (!item) {
      applyRow(idx, (row) => ({
        ...row,
        tmc_id: null,
        name: "",
        code: "",
        unit: "",
        price: 0,
        supplier_link: "",
        sale_price: row.for_sale ? 0 : row.sale_price,
      }));
      return;
    }
    applyRow(idx, (row) => {
      const nextPrice = Number(item.price) || 0;
      const shouldAutoSale = !!row.for_sale && !row._saleManual;
      const autoSalePrice = shouldAutoSale ? round2(nextPrice * 1.25) : row.sale_price;
      return {
        ...row,
        tmc_id: item.id,
        name: item.name ?? "",
        code: item.code ?? "",
        unit: item.unit ?? "",
        price: nextPrice,
        supplier_link: item.supplier_link ?? "",
        sale_price: autoSalePrice,
      };
    });
  };

  const toggleForSale = (idx, checked) => {
    applyRow(idx, (row) => {
      const nextSalePrice = checked ? round2((Number(row.price) || 0) * 1.25) : 0;
      return { ...row, for_sale: checked, sale_price: nextSalePrice, _saleManual: false };
    });
  };
  const changeSalePrice = (idx, val) => {
    const v = parseNum(val);
    applyRow(idx, (row) => ({ ...row, sale_price: round2(v), _saleManual: true }));
  };

  // Обновление цен по справочнику
  const refreshPrices = () => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    const byId = new Map();
    const byCode = new Map();
    for (const d of tmcDict) {
      if (d?.id !== undefined) byId.set(String(d.id), d);
      if (d?.code !== undefined) byCode.set(String(d.code), d);
    }
    applyAll((row) => {
      let dictItem = null;
      if (row.tmc_id != null) dictItem = byId.get(String(row.tmc_id));
      if (!dictItem && row.code != null) dictItem = byCode.get(String(row.code));
      if (!dictItem) return row;
      const newPrice = Number(dictItem.price) || 0;
      const newSalePrice = row.for_sale && !row._saleManual ? round2(newPrice * 1.25) : row.sale_price;
      return { ...row, price: newPrice, sale_price: newSalePrice };
    });
  };

  // Итоги
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          const qtyForSale = r.for_sale ? (Number(r.qty) || 0) : 0;
          const price = Number(r.price) || 0;
          acc.totalG += Number(r.total) || 0;
          acc.totalK += Number(r.sale_sum) || 0;
          acc.totalM += Number(r.profit) || 0;
          acc.totalCost += qtyForSale * price;
          return acc;
        },
        { totalG: 0, totalK: 0, totalM: 0, totalCost: 0 }
      ),
    [rows]
  );
  const weightedMargin = totals.totalCost > 0 ? round2((totals.totalM / totals.totalCost) * 100) : 0;

  // Стили
  const tableStyle = { borderCollapse: "separate", borderSpacing: 0, width: "100%", tableLayout: "fixed" };
  const cellBase = {
    border: "1px solid #ddd",
    padding: "7px 6px",
    fontSize: "1rem",
    background: "#fff",
    verticalAlign: "middle",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const thGray = { ...cellBase, background: "#eee", fontWeight: "bold", textAlign: "center", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25 };
  const roGray = { ...cellBase, background: "#f5f5f5", textAlign: "left" };
  const roGrayCenter = { ...roGray, textAlign: "center" };
  const roGrayRight = { ...roGray, textAlign: "right", paddingRight: 10 };
  const editWhite = { ...cellBase, background: "#fff" };
  const editWrap = { ...editWhite, whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", lineHeight: 1.3 };
  const editWhiteCenter = { ...editWhite, textAlign: "center" };
  const editWhiteRight = { ...editWhite, textAlign: "right" };

  const thHeaderStack = { display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 4 };
  const headerBtn = {
    display: "inline-block",
    marginTop: 4,
    padding: "4px 6px",
    fontSize: 12,
    border: "1px solid #c59bff",
    background: "#f5efff",
    color: "#5427b0",
    borderRadius: 6,
    cursor: "pointer",
    maxWidth: "100%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    alignSelf: "stretch",
  };
  const inputNum = { width: "98%", padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, textAlign: "right", boxSizing: "border-box" };

  const editLink = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    minWidth: 28,
    height: 28,
    border: "1px solid #c59bff",
    borderRadius: 6,
    color: "#5427b0", // fix опечатки
    background: "#f5efff", // fix опечатки
    cursor: "pointer",
    textDecoration: "none",
    fontWeight: 700,
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={addEmptyRow}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #c59bff", background: "#f5efff", color: "#5427b0", fontWeight: 700, cursor: "pointer" }}
        >
          + Добавить строку ТМЦ
        </button>
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>

        <thead>
          <tr>
            <th style={thGray}>№ п/п</th>
            <th style={thGray}>Наименование</th>
            <th style={thGray}>Код</th>
            <th style={thGray}>Кол-во</th>
            <th style={thGray}>Ед. изм.</th>
            <th style={thGray}>
              <div style={thHeaderStack}>
                <div>цена за ед.</div>
                <button type="button" onClick={refreshPrices} style={headerBtn} title="Подтянуть актуальные цены из справочника">
                  Обновить цены
                </button>
              </div>
            </th>
            <th style={thGray}>Итого, руб. с НДС</th>
            <th style={thGray}>Ссылка</th>
            <th style={thGray}>ТМЦ на продажу</th>
            <th style={thGray}>Продажная цена за ед., руб. с НДС</th>
            <th style={thGray}>Сумма продажная, руб. с НДС</th>
            <th style={thGray}>Рентабельность продажи ТМЦ, %</th>
            <th style={thGray}>Прибыль от продажи ТМЦ, руб</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={13} style={{ ...roGray, textAlign: "center", color: "#999", whiteSpace: "normal" }}>
                Нет позиций. Нажмите «Добавить строку ТМЦ».
              </td>
            </tr>
          )}

          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={roGrayCenter}>{idx + 1}</td>

              {/* Наименование + быстрая ссылка в карточку ТМЦ */}
              <td style={editWrap}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <NamePicker
                      value={row.name || ""}
                      dict={consumablesDict}
                      onPick={(item) => onPickTmc(idx, item)}
                      onClear={() => onPickTmc(idx, null)}
                    />
                  </div>
                  {row.tmc_id ? (
                    <a
                      href={makeTmcUrl(row.tmc_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Открыть карточку ТМЦ в новой вкладке"
                      style={editLink}
                    >
                      ↗
                    </a>
                  ) : null}
                </div>
              </td>

              <td style={roGrayCenter}>{row.code || ""}</td>

              <td style={editWhiteRight}>
                <input
                  type="text"
                  value={row.qty ?? ""}
                  onChange={(e) => applyRow(idx, (r) => ({ ...r, qty: parseNum(e.target.value) }))}
                  style={inputNum}
                />
              </td>

              <td style={roGrayCenter}>{row.unit || ""}</td>

              <td style={roGrayRight}>{fmtMoney(row.price)}</td>
              <td style={roGrayRight}>{fmtMoney(row.total)}</td>

              <td style={{ ...roGray, whiteSpace: "normal", wordBreak: "break-all" }}>
                {row.supplier_link ? (
                  <a href={row.supplier_link} target="_blank" rel="noopener noreferrer" style={{ color: "#3a27c5", textDecoration: "underline" }} title={row.supplier_link}>
                    Ссылка
                  </a>
                ) : (
                  "—"
                )}
              </td>

              <td style={editWhiteCenter}>
                <input type="checkbox" checked={!!row.for_sale} onChange={(e) => toggleForSale(idx, e.target.checked)} />
              </td>

              <td style={editWhiteRight}>
                <input
                  type="text"
                  value={row.sale_price ?? ""}
                  onChange={(e) => changeSalePrice(idx, e.target.value)}
                  onBlur={(e) => changeSalePrice(idx, e.target.value)}
                  style={inputNum}
                />
              </td>

              <td style={roGrayRight}>{fmtMoney(row.sale_sum)}</td>
              <td style={roGrayRight}>{fmtPercent(row.margin_percent)}</td>

              <td style={roGrayRight}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span>{fmtMoney(row.profit)}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    title="Удалить строку"
                    style={{ border: "none", background: "none", color: "#c00", fontSize: 18, cursor: "pointer" }}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>

        {rows.length > 0 && (
          <tfoot>
            <tr>
              <td style={roGray} />
              <td style={{ ...roGray, fontWeight: 800, whiteSpace: "normal" }}>ИТОГО</td>
              <td style={roGray} />
              <td style={roGray} />
              <td style={roGray} />
              <td style={roGray} />
              <td style={{ ...roGrayRight, fontWeight: 800 }}>{fmtMoney(totals.totalG)}</td>
              <td style={roGray} />
              <td style={roGray} />
              <td style={roGray} />
              <td style={{ ...roGrayRight, fontWeight: 800 }}>{fmtMoney(totals.totalK)}</td>
              <td style={{ ...roGrayRight, fontWeight: 800 }}>{fmtPercent(weightedMargin)}</td>
              <td style={{ ...roGrayRight, fontWeight: 800 }}>{fmtMoney(totals.totalM)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* Выпадающий выбор "Наименование" — портал поверх всего (расширенная ширина + отступ слева) */
function NamePicker({ value, dict, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const anchorRef = useRef(null);
  const dropdownRef = useRef(null);
  const [ddStyle, setDdStyle] = useState({ top: 0, left: 0, width: 0 });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = Array.isArray(dict) ? dict : [];
    if (!s) return base.slice(0, 300);
    return base
      .filter(
        (d) =>
          String(d.name || "").toLowerCase().includes(s) ||
          String(d.code || "").toLowerCase().includes(s)
      )
      .slice(0, 300);
  }, [dict, q]);

  const positionDropdown = () => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();

    const margin = 16;           // поля по бокам экрана
    const leftOffset = 14;       // НОВОЕ: визуальный отступ слева от инпута
    const vpW = window.innerWidth;
    const minW = Math.min(720, vpW - margin * 2); // хотим широкий список, но не больше экрана
    const desiredWidth = Math.max(r.width, minW);
    const maxLeft = vpW - desiredWidth - margin;

    const baseLeft = r.left + leftOffset; // сдвигаем вправо
    const leftPx = Math.max(margin, Math.min(baseLeft, maxLeft));
    const topPx = Math.round(r.bottom + window.scrollY);

    setDdStyle({
      top: topPx,
      left: Math.round(leftPx + window.scrollX),
      width: Math.round(desiredWidth),
    });
  };

  useEffect(() => {
    if (!open) return;
    positionDropdown();
    const onWin = () => positionDropdown();
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin, true);
    const onDoc = (e) => {
      const a = anchorRef.current;
      const d = dropdownRef.current;
      if ((a && a.contains(e.target)) || (d && d.contains(e.target))) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin, true);
      document.removeEventListener("mousedown", onDoc, true);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", width: "98%" }}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={value}
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
        <div style={{ whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.25, color: value ? "#111" : "#999" }}>
          {value || "— выберите позицию из справочника —"}
        </div>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: ddStyle.top,
              left: ddStyle.left,
              width: ddStyle.width,
              maxHeight: 420,
              overflowY: "auto",
              overflowX: "hidden",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,.2)",
              zIndex: 9999,
              boxSizing: "border-box",
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid #eee", display: "flex", gap: 8 }}>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по названию или коду…"
                style={{ flex: 1, padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQ("");
                  onClear?.();
                  setOpen(false);
                }}
                style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, background: "#f5f5f5", cursor: "pointer", whiteSpace: "nowrap" }}
                title="Очистить"
              >
                Очистить
              </button>
            </div>

            <div>
              {filtered.length === 0 && <div style={{ padding: 10, color: "#777" }}>Ничего не найдено</div>}
              {filtered.map((d) => (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPick(d);
                    setOpen(false);
                  }}
                  style={{ width: "100%", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #f2f2f2", background: "transparent", cursor: "pointer" }}
                  title={d.name}
                >
                  <div style={{ fontWeight: 700, lineHeight: 1.25, whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4, whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                    Код: {d.code ?? "—"} • Ед.: {d.unit ?? "—"} • Цена: {fmtMoney(d.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}