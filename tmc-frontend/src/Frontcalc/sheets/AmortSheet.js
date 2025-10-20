import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Открытие карточки ТМЦ (при необходимости подправьте маршрут) */
const makeTmcUrl = (id) => `${window.location.origin}/tmc/${id}`;

const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseNum = (s) => {
  const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function AmortSheet({ data, onChange }) {
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
    const onFocus = () => loadDicts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const groupNameById = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(String(g.id), String(g.name || ""));
    return map;
  }, [groups]);

  // Аморт-группа: убираем «Расходные материалы», оставляем «ОС/оборуд/инвентарь/инструмент/амортиз…»
  const isAmortizable = (item) => {
    const rawName = String(item?.groupName || item?.group || "");
    const gid = item?.group_id ?? item?.groupId ?? item?.groupID;
    const gname = gid != null ? String(groupNameById.get(String(gid)) || "") : rawName;
    const s = gname.toLowerCase();
    const isConsumable = s.includes("расходн");
    const looksAmort =
      s.includes("амортиз") || s.includes("основ") || s.includes("инвентар") || s.includes("оборуд") || s.includes("инструмент");
    return looksAmort && !isConsumable;
  };

  const amortDict = useMemo(() => tmcDict.filter(isAmortizable), [tmcDict, groupNameById]);

  // Пересчёт строки
  const recalcRow = (row) => {
    const qty = Number(row.qty) || 0;
    const price = Number(row.price) || 0;
    const total = round2(qty * price);

    const months = Math.max(1, Math.floor(Number(row.norm_months) || 0));
    const amortPerMonth = months > 0 ? round2(total / months) : 0;

    return { ...row, total, amort_per_month: amortPerMonth };
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
        norm_months: 12,
        amort_per_month: 0,
      },
    ]);
  };
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  // helper: extract norm months from TMC item
  // IMPORTANT: the TMC card field "Амортизация (мес.)" is mapped to `amortization_period` in TmcCard.jsx.
  // We must prioritise that field and treat it as months (no years conversion).
  const extractNormMonths = (item) => {
    if (!item || typeof item !== "object") return 0;

    // 1) Primary field used in TmcCard.jsx
    if (item.hasOwnProperty("amortization_period")) {
      const v = Number(item.amortization_period);
      if (Number.isFinite(v) && v > 0) return Math.round(v);
    }

    // 2) Common alternate names that may also represent months; treat values as months directly
    const monthCandidates = ["norm_months", "amort_months", "amort_period", "amortization_months", "amort", "norm"];
    for (const key of monthCandidates) {
      if (item.hasOwnProperty(key)) {
        const v = Number(item[key]);
        if (Number.isFinite(v) && v > 0) return Math.round(v);
      }
    }

    // 3) Try inside nested props if present (less likely)
    const altFields = ["meta", "extra", "props", "attributes"];
    for (const af of altFields) {
      const obj = item[af];
      if (!obj || typeof obj !== "object") continue;
      for (const key in obj) {
        const maybe = Number(obj[key]);
        if (Number.isFinite(maybe) && maybe > 0) {
          return Math.round(maybe);
        }
      }
    }

    return 0;
  };

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
      }));
      return;
    }

    const normFromItem = extractNormMonths(item);

    applyRow(idx, (row) => {
      const nextPrice = Number(item.price) || 0;
      return {
        ...row,
        tmc_id: item.id,
        name: item.name ?? "",
        code: item.code ?? "",
        unit: item.unit ?? "",
        price: nextPrice,
        supplier_link: item.supplier_link ?? "",
        // if the TMC contains an amortization_period (months) — use it; otherwise keep existing or default 12
        norm_months: normFromItem > 0 ? normFromItem : (row.norm_months ?? 12),
      };
    });
  };

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
      const normFromDict = extractNormMonths(dictItem);
      return {
        ...row,
        price: newPrice,
        norm_months: normFromDict > 0 ? normFromDict : row.norm_months,
      };
    });
  };

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc.totalG += Number(r.total) || 0;
          acc.totalJ += Number(r.amort_per_month) || 0;
          return acc;
        },
        { totalG: 0, totalJ: 0 }
      ),
    [rows]
  );

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
  const editWhiteLeftWrap = { ...editWhite, textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", overflow: "visible", lineHeight: 1.3 };
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
    color: "#5427b0",
    background: "#f5efff",
    cursor: "pointer",
    textDecoration: "none",
    fontWeight: 700,
  };
  const deleteBtnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    minWidth: 28,
    height: 28,
    border: "1px solid #f5c6cb",
    borderRadius: 6,
    color: "#b91c1c",
    background: "#fff5f6",
    cursor: "pointer",
    marginLeft: 6,
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
          + Добавить строку
        </button>
      </div>

      <table style={tableStyle}>
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "6%" }} />
        </colgroup>

        <thead>
          <tr>
            <th style={thGray}>№ п/п</th>
            <th style={thGray}>наименование</th>
            <th style={thGray}>Код</th>
            <th style={thGray}>Кол-во</th>
            <th style={thGray}>Ед. изм.</th>
            <th style={thGray}>
              <div style={thHeaderStack}>
                <div>Цена за ед.</div>
                <button type="button" onClick={refreshPrices} style={headerBtn} title="Подтянуть актуальные цены из справочника">
                  Обновить цены
                </button>
              </div>
            </th>
            <th style={thGray}>Итого, руб. с НДС</th>
            <th style={thGray}>Ссылка</th>
            <th style={thGray}>Норма амортизации, месяцев</th>
            <th style={thGray}>Сумма амортизации в месяц, руб.</th>
            <th style={thGray}>Действия</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} style={{ ...roGray, textAlign: "center", color: "#999", whiteSpace: "normal" }}>
                Нет позиций. Нажмите «Добавить строку».
              </td>
            </tr>
          )}

          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={roGrayCenter}>{idx + 1}</td>

              <td style={editWhiteLeftWrap}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <NamePicker
                      value={row.name || ""}
                      dict={amortDict}
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
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    title="Удалить строку"
                    style={deleteBtnStyle}
                  >
                    ✖
                  </button>
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

              <td style={roGrayCenter}>
                {row.norm_months != null && row.norm_months !== "" ? row.norm_months : "—"}
              </td>

              <td style={roGrayRight}>{fmtMoney(row.amort_per_month)}</td>

              <td style={roGrayCenter}>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  title="Удалить строку"
                  style={{ ...deleteBtnStyle, width: "100%", minWidth: 0 }}
                >
                  Удалить
                </button>
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
              <td style={{ ...roGrayRight, fontWeight: 800 }}>{fmtMoney(totals.totalJ)}</td>
              <td style={roGray} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ИМЕННО ЗДЕСЬ: Расширенный дропдаун с авто-подгонкой ширины, переносами и отступом слева */
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

    const margin = 16;        // поля по краям вьюпорта
    const leftOffset = 14;    // чтобы не упиралось в левую границу ячейки
    const vpW = window.innerWidth;
    const minW = Math.min(720, vpW - margin * 2); // широкий список, но не больше экрана
    const desiredWidth = Math.max(r.width, minW);
    const maxLeft = vpW - desiredWidth - margin;

    const baseLeft = r.left + leftOffset;
    const left = Math.max(margin, Math.min(baseLeft, maxLeft));
    const top = Math.round(r.bottom + window.scrollY);

    setDdStyle({
      top,
      left: Math.round(left + window.scrollX),
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
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    textAlign: "left",
                    borderBottom: "1px solid #f2f2f2",
                    background: "transparent",
                    cursor: "pointer",
                  }}
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