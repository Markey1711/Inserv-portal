import React, { useMemo, useState, useEffect } from "react";

/* ========= Утилиты ========= */
const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseNum = (s) => {
  if (s === null || s === undefined) return 0;
  const cleaned = String(s).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const TAX_SYSTEMS = [
  { id: "vat20", name: "С НДС 20%", percent: 20 },
  { id: "novat", name: "Без НДС", percent: 0 },
];

/* ========= Универсальный числовой input с буфером ========= */
function NumericInput({
  fieldKey,
  displayValue,
  summaryUpdater,
  editBuffer,
  setEditBuffer,
  style,
  title,
  inputMode = "decimal",
  autoSelect = true,
  disabled = false,
}) {
  const [editing, setEditing] = useState(false);

  const commit = () => {
    if (disabled) {
      setEditBuffer((b) => {
        const nb = { ...b };
        delete nb[fieldKey];
        return nb;
      });
      setEditing(false);
      return;
    }
    const raw = editBuffer[fieldKey];
    if (raw !== undefined) {
      const n = round2(parseNum(raw));
      summaryUpdater(n);
      setEditBuffer((b) => {
        const nb = { ...b };
        delete nb[fieldKey];
        return nb;
      });
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditBuffer((b) => {
      const nb = { ...b };
      delete nb[fieldKey];
      return nb;
    });
    setEditing(false);
  };

  const onChange = (e) => {
    if (disabled) return;
    let val = e.target.value;
    if (/[^0-9.,]/.test(val)) val = val.replace(/[^0-9.,]/g, "");
    const firstComma = val.indexOf(",");
    const firstDot = val.indexOf(".");
    const sepIndex =
      firstComma === -1
        ? firstDot
        : firstDot === -1
        ? firstComma
        : Math.min(firstComma, firstDot);
    if (sepIndex !== -1) {
      const head = val.slice(0, sepIndex + 1);
      const tail = val.slice(sepIndex + 1).replace(/[.,]/g, "");
      val = head + tail;
    }
    setEditBuffer((b) => ({ ...b, [fieldKey]: val }));
  };

  const value = editing
    ? editBuffer[fieldKey] ?? ""
    : fmtMoney(displayValue);

  const finalStyle = disabled
    ? { ...(style || {}), background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }
    : style;

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      disabled={disabled}
      onFocus={(e) => {
        if (disabled) return;
        setEditing(true);
        if (!(fieldKey in editBuffer)) {
          setEditBuffer((b) => ({
            ...b,
            [fieldKey]:
              displayValue !== null && displayValue !== undefined
                ? String(displayValue).replace(".", ",")
                : "",
          }));
        }
        if (autoSelect) setTimeout(() => e.target.select(), 0);
      }}
      onChange={onChange}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }}
      style={finalStyle}
      title={title}
    />
  );
}

/* ========= Компонент SummarySheet ========= */
export default function SummarySheet({ cardData, onChange }) {
  const summary = cardData?.sheets?.summary || {};

  const staffRows = Array.isArray(cardData?.sheets?.staff) ? cardData.sheets.staff : [];
  const tmcRows = Array.isArray(cardData?.sheets?.tmc) ? cardData.sheets.tmc : [];
  const amortRows = Array.isArray(cardData?.sheets?.amortization) ? cardData.sheets.amortization : [];
  const extraRows = Array.isArray(cardData?.sheets?.extraCosts) ? cardData.sheets.extraCosts : [];

  // флаг текущей налоговой системы
  const taxSystemId = summary.taxSystemId ?? "vat20";
  const taxSystem = TAX_SYSTEMS.find(t => t.id === taxSystemId) || TAX_SYSTEMS[0];
  const isNoVat = taxSystem.id === "novat" || Number(taxSystem.percent) === 0;

  const params = {
    ndflPct: Number(summary.ndflPct ?? 13),
    insPct: Number(summary.insPct ?? 30.5),
    tmcVatPct: Number(summary.tmcVatPct ?? 20),
    extrasVatPct: Number(summary.extrasVatPct ?? 20),
    vatPayPct: Number(summary.vatPayPct ?? 20),
    overheadPct: Number(summary.overheadPct ?? 5),
    profitTaxPct: Number(summary.profitTaxPct ?? (isNoVat ? 0 : 25)),
    subcontractVatPct: Number(summary.subcontractVatPct ?? 20),
    soapShareFrac: Number(summary.soapShareFrac ?? (isNoVat ? 1 : 0.89)),
    soapTaxesPct: Number(summary.soapTaxesPct ?? (isNoVat ? 12 : 15)),
    breakEven: Number(summary.breakEven ?? 0),
    tmcPaidManual: Number(summary.tmcPaidManual ?? 0),
  };

  const [editBuffer, setEditBuffer] = useState({});
  const [showRefs, setShowRefs] = useState(true);

  const updateSummary = (patch) => {
    onChange({
      ...(cardData || {}),
      sheets: {
        ...(cardData?.sheets || {}),
        summary: { ...summary, ...patch },
      },
    });
  };

  // При переключении системы налогообложения — проставляем значения по умолчанию
  // Для "Без НДС": soapShareFrac=1, soapTaxesPct=12, profitTaxPct=0
  // Для "С НДС": profitTaxPct=25, soapTaxesPct=17, soapShareFrac=0.85
  useEffect(() => {
    if (isNoVat) {
      updateSummary({
        soapShareFrac: 1,
        soapTaxesPct: 12,
        profitTaxPct: 0,
      });
    } else {
      updateSummary({
        profitTaxPct: 25,
        soapTaxesPct: 17,
        soapShareFrac: 0.85,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxSystemId]);

  /* ---- Агрегаты ---- */
  const src = useMemo(() => {
    const staffTotal = staffRows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const staffCashSum = staffRows.reduce((s, r) => s + (Number(r.cash_total) || 0), 0);
    const staffCardSum = staffRows.reduce((s, r) => s + (Number(r.card_total) || 0), 0);
    const staffCashPaid = staffRows.reduce((s, r) => s + (Number(r.cash_paid) || 0), 0);
    const staffCardPaid = staffRows.reduce((s, r) => s + (Number(r.card_paid) || 0), 0);

    const tmcBuyTotal = tmcRows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const tmcSalesTotal = tmcRows.reduce((s, r) => s + (r.for_sale ? (Number(r.sale_sum) || 0) : 0), 0);

    const amortMonth = amortRows.reduce((s, r) => s + (Number(r.amort_per_month) || 0), 0);
    const amortPurchaseTotal = amortRows.reduce((s, r) => s + (Number(r.total) || 0), 0);

    let extrasVat20 = 0, extrasVat20Paid = 0;
    let extrasNoVat = 0, extrasNoVatPaid = 0;
    let extrasCash = 0, extrasCashPaid = 0;
    for (const r of extraRows) {
      const sum = Number(r.sum) || 0;
      const paid = Number(r.paid) || 0;
      if (r.payment_form === "С НДС 20%") { extrasVat20 += sum; extrasVat20Paid += paid; }
      else if (r.payment_form === "Без НДС") { extrasNoVat += sum; extrasNoVatPaid += paid; }
      else if (r.payment_form === "Наличные") { extrasCash += sum; extrasCashPaid += paid; }
    }

    return {
      staffTotal: round2(staffTotal),
      staffCashSum: round2(staffCashSum),
      staffCardSum: round2(staffCardSum),
      staffCashPaid: round2(staffCashPaid),
      staffCardPaid: round2(staffCardPaid),
      tmcBuyTotal: round2(tmcBuyTotal),
      tmcSalesTotal: round2(tmcSalesTotal),
      amortMonth: round2(amortMonth),
      amortPurchaseTotal: round2(amortPurchaseTotal),
      extrasVat20: round2(extrasVat20),
      extrasVat20Paid: round2(extrasVat20Paid),
      extrasNoVat: round2(extrasNoVat),
      extrasNoVatPaid: round2(extrasNoVatPaid),
      extrasCash: round2(extrasCash),
      extrasCashPaid: round2(extrasCashPaid),
    };
  }, [staffRows, tmcRows, amortRows, extraRows]);

  /* ---- Контракты ---- */
  const manualContracts = Array.isArray(summary.contractRows) && summary.contractRows.length > 0
    ? summary.contractRows
    : [{ numberDate: "", subject: "", amount: 0 }];

  const manualContractsSum = manualContracts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const hasTmcSaleRow = src.tmcSalesTotal > 0;
  const contractTotal = round2(manualContractsSum + (hasTmcSaleRow ? src.tmcSalesTotal : 0)); // H3

  /* ---- Вспомогательные ---- */
  const remain = (sum, paid) => round2((Number(sum) || 0) - (Number(paid) || 0));
  const remainBg = (v) => {
    const r = Number(v) || 0;
    const eps = 0.005;
    if (r > eps) return "#ffd9d9";
    if (r < -eps) return "#ffe9cc";
    return "#daf5d7";
  };
  const posNegBg = (v) => (Number(v) > 0 ? "#dff5e2" : "#ffe1dd");

  /* ---- Формулы (левая) ---- */
  const C2 = src.staffTotal;
  const C3 = src.staffCashSum, D3 = src.staffCashPaid, E3 = remain(C3, D3);
  const C4 = src.staffCardSum, D4 = src.staffCardPaid, E4 = remain(C4, D4);
  const C5 = round2(C4 * params.ndflPct / (100 - params.ndflPct));
  const C6 = round2((C4 + C5) * params.insPct / 100);
  const C7 = round2(C5 + C6);
  const C8 = src.tmcBuyTotal, D8 = params.tmcPaidManual, E8 = remain(C8, D8);
  const C9 = round2(src.amortMonth);
  const C10 = src.extrasVat20, D10 = src.extrasVat20Paid, E10 = remain(C10, D10);
  const C11 = src.extrasNoVat, D11 = src.extrasNoVatPaid, E11 = remain(C11, D11);
  const C12 = src.extrasCash,  D12 = src.extrasCashPaid,  E12 = remain(C12, D12);

  // Важно: сначала вычисляем C23 (оно используется в C26_calc)
  // Изменение: при "Без НДС" C23 = contractTotal * C29 (soapShareFrac)
  const C23 = isNoVat
    ? round2(contractTotal * params.soapShareFrac)
    : round2(Math.max(0, (contractTotal - (C4 + C7 + C8 + C10 + C11)) * params.soapShareFrac));

  // вычисляем базовые C25_calc и C26_calc (используют C23)
  const C25_calc = round2(contractTotal * params.vatPayPct / (100 + params.vatPayPct));
  const C26_calc = round2(
    C8  * params.tmcVatPct         / (100 + params.tmcVatPct) +
    C10 * params.extrasVatPct      / (100 + params.extrasVatPct) +
    C23 * params.subcontractVatPct / (100 + params.subcontractVatPct)
  );

  // Если выбран "Без НДС" — эти поля должны быть 0 (и строки серые/неактивные)
  const C25 = isNoVat ? 0 : C25_calc;
  const C26 = isNoVat ? 0 : C26_calc;
  const C13 = isNoVat ? 0 : round2(C25_calc - C26_calc);

  const C14 = round2(contractTotal * params.overheadPct / 100);
  const C16 = round2(C23 * params.soapTaxesPct / 100);

  const profitPct = params.profitTaxPct;
  const BASE_wo_C15 = round2(C2 + C7 + C8 + C9 + C10 + C11 + C12 + C13 + C14 + C16);
  const C15 = isNoVat ? 0 : round2((contractTotal - BASE_wo_C15) * profitPct / (100 + profitPct));
  const C17 = round2(BASE_wo_C15 + C15);
  const C18 = round2(contractTotal - C17);
  const C19 = contractTotal > 0 ? round2((C18 * 100) / contractTotal) : 0;
  const C20 = src.amortPurchaseTotal;
  const C21 = params.breakEven;
  const E22 = round2(E3 + E12);

  const C24 = round2(C23 * (100 - params.soapTaxesPct) / 100);
  const C28 = round2(C4 + C7 + C8 + C9 + C10 + C11 + C13 + C23);
  const C27 = isNoVat ? 0 : round2(C4 + C7 + C8 + C9 + C10 + C11 + C13 + C23); // новая формула

  const profitOnHand = round2(C24 - C3 - C12 - C14);
  const profitOnHandPct = contractTotal > 0 ? round2((profitOnHand * 100) / contractTotal) : 0;

  // Compute J total (Итого "Прибыль на руки") — special formula for No VAT applied here.
  const jTotal = isNoVat
    ? round2(C24 - C2 - C7 - C8 - C9 - C10 - C11 - C12 - C14)
    : profitOnHand;

  /* ---- Стили ---- */
  const headerBadge = { display: "inline-block", minWidth: 20, padding: "1px 6px", borderRadius: 6, background: "#eef2ff", color: "#374151", fontWeight: 700, marginRight: 6 };
  const refTd = { width: 32, textAlign: "right", padding: "6px 4px", border: "1px solid #ddd", color: "#6b7280", background: "#fafafa", fontWeight: 600, fontSize: 12 };
  const table = { borderCollapse: "separate", borderSpacing: 0, width: "100%", tableLayout: "fixed" };
  const cell = { border: "1px solid #ddd", padding: "6px 8px", fontSize: ".95rem", verticalAlign: "middle", lineHeight: 1.18 };
  const thGray = { ...cell, background: "#cfd3da", fontWeight: 800, textAlign: "center" };
  const thBlue = { ...cell, background: "#b9d2ff", fontWeight: 800, textAlign: "center" };
  const colAWhite = { ...cell, background: "#fff", fontWeight: 600, textAlign: "left" };
  const ro = { ...cell, background: "#f5f5f5", textAlign: "right" };
  const roLeft = { ...ro, textAlign: "left" };
  const yellow = { ...cell, background: "#fff9d6", fontWeight: 700, textAlign: "right" };
  const white = { ...cell, background: "#fff" };
  const whiteRight = { ...white, textAlign: "right" };
  const input = { width: "100%", padding: "5px 6px", border: "1px solid #ccc", borderRadius: 6, fontSize: ".9rem", boxSizing: "border-box" };
  const inputRight = { ...input, textAlign: "right" };

  const grayInactive = { ...cell, background: "#f3f4f6", color: "#6b7280" };

  // Функция заголовка с условным бейджем
  const ColumnHeader = (letter, title, styleObj) => (
    <th style={styleObj}>
      {showRefs && <span style={headerBadge}>{letter}</span>}
      {title}
    </th>
  );

  // Нумерация
  let rowNoLeft = 1;
  const nextRowNoLeft = () => (rowNoLeft += 1);
  const RefCellLeft = (n) => (showRefs ? <td style={refTd}>{n}</td> : null);

  let rowNoCtr = 1;
  const nextRowNoCtr = () => (rowNoCtr += 1);
  const RefCellCtr = (n) => (showRefs ? <td style={refTd}>{n}</td> : null);

  let rowNoTax = 1;
  const nextRowNoTax = () => (rowNoTax += 1);
  const RefCellTax = (n) => (showRefs ? <td style={refTd}>{n}</td> : null);

  const addContractRow = () =>
    updateSummary({
      contractRows: [...manualContracts, { numberDate: "", subject: "", amount: 0 }],
    });

  /* ========= Рендер ========= */
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(760px, 1fr) 24px minmax(560px, 640px)", gap: 16 }}>
      {/* Левая таблица */}
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563" }}>
            <input type="checkbox" checked={showRefs} onChange={(e) => setShowRefs(e.target.checked)} />
            Координаты
          </label>
        </div>
        <table style={table}>
          <colgroup>
            {showRefs && <col style={{ width: 32 }} />}
            <col style={{ width: "44%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr>
              {showRefs && <th style={{ ...thGray, fontSize: 12, textAlign: "right" }}>#</th>}
              {ColumnHeader("A", "Статья затрат", thGray)}
              {ColumnHeader("B", "Значение", thGray)}
              {ColumnHeader("C", "Сумма за год", thGray)}
              {ColumnHeader("D", "Выплачено", thGray)}
              {ColumnHeader("E", "Осталось", thGray)}
            </tr>
          </thead>
          <tbody>
            {/* 2 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Общая сумма ФОТ (карта+нал)</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C2)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>
            {/* 3 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Сумма ФОТ нал</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C3)}</td>
              <td style={yellow}>{fmtMoney(D3)}</td>
              <td style={{ ...yellow, background: remainBg(E3) }}>{fmtMoney(E3)}</td>
            </tr>
            {/* 4 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Сумма ФОТ на карту</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C4)}</td>
              <td style={yellow}>{fmtMoney(D4)}</td>
              <td style={{ ...yellow, background: remainBg(E4) }}>{fmtMoney(E4)}</td>
            </tr>
            {/* 5 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>НДФЛ, руб.</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="ndflPct" displayValue={params.ndflPct} summaryUpdater={(n) => updateSummary({ ndflPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="Процент НДФЛ" />
              </td>
              <td style={yellow}>{fmtMoney(C5)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>
            {/* 6 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Страховые взносы</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="insPct" displayValue={params.insPct} summaryUpdater={(n) => updateSummary({ insPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="Процент страховых" />
              </td>
              <td style={yellow}>{fmtMoney(C6)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 7 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Сумма налогов на ФОТ, руб.</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C7)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 8 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>ТМЦ (с НДС)</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="tmcVatPct" displayValue={params.tmcVatPct} summaryUpdater={(n) => updateSummary({ tmcVatPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="НДС по ТМЦ %" />
              </td>
              <td style={yellow}>{fmtMoney(C8)}</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="tmcPaidManual" displayValue={params.tmcPaidManual} summaryUpdater={(n) => updateSummary({ tmcPaidManual: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="Оплачено ТМЦ вручную" />
              </td>
              <td style={{ ...yellow, background: remainBg(E8) }}>{fmtMoney(E8)}</td>
            </tr>

            {/* 9 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Амортизация оборудования и инвентаря</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C9)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 10 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Доп.затраты, с НДС</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="extrasVatPct" displayValue={params.extrasVatPct} summaryUpdater={(n) => updateSummary({ extrasVatPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="НДС доп.затрат %" />
              </td>
              <td style={yellow}>{fmtMoney(C10)}</td>
              <td style={yellow}>{fmtMoney(D10)}</td>
              <td style={{ ...yellow, background: remainBg(E10) }}>{fmtMoney(E10)}</td>
            </tr>

            {/* 11 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Доп.затраты, без НДС</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C11)}</td>
              <td style={yellow}>{fmtMoney(D11)}</td>
              <td style={{ ...yellow, background: remainBg(E11) }}>{fmtMoney(E11)}</td>
            </tr>

            {/* 12 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Доп.затраты, наличные</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C12)}</td>
              <td style={yellow}>{fmtMoney(D12)}</td>
              <td style={{ ...yellow, background: remainBg(E12) }}>{fmtMoney(E12)}</td>
            </tr>

            {/* 13: НДС на оплату — при Без НДС строка неактивна */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>НДС на оплату</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="vatPayPct" displayValue={params.vatPayPct} summaryUpdater={(n) => updateSummary({ vatPayPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="Процент НДС начисленного" disabled={isNoVat} />
              </td>
              <td style={isNoVat ? grayInactive : yellow}>{fmtMoney(C13)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 14 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Накладные расходы</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="overheadPct" displayValue={params.overheadPct} summaryUpdater={(n) => updateSummary({ overheadPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="% накладных" />
              </td>
              <td style={yellow}>{fmtMoney(C14)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 15: Налог на прибыль — при Без НДС нередактируемо и 0 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Налог на прибыль</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="profitTaxPct" displayValue={params.profitTaxPct} summaryUpdater={(n) => updateSummary({ profitTaxPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="% налога на прибыль" disabled={isNoVat} />
              </td>
              <td style={isNoVat ? grayInactive : yellow}>{fmtMoney(C15)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 16: Затраты на мыло, руб. — B16 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Затраты на мыло, руб.</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="soapTaxesPct" displayValue={params.soapTaxesPct} summaryUpdater={(n) => updateSummary({ soapTaxesPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="% налоги на мыло" />
              </td>
              <td style={yellow}>{fmtMoney(C16)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 17 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Себестоимость контракта</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C17)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 18 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Прибыль контракта</td>
              <td style={roLeft}>—</td>
              <td style={{ ...yellow, background: posNegBg(C18) }}>{fmtMoney(C18)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 19 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Рентабельность чистая, %</td>
              <td style={roLeft}>—</td>
              <td style={{ ...yellow, background: posNegBg(C19) }}>{fmtMoney(C19)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 20 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Закупка оборудования (справочно)</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C20)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 21 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Точка безубыточности (справочно)</td>
              <td style={roLeft}>—</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="breakEven" displayValue={params.breakEven} summaryUpdater={(n) => updateSummary({ breakEven: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="Точка безубыточности" />
              </td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 22 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Итого осталось выплатить нал</td>
              <td style={roLeft}>—</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
              <td style={{ ...yellow, background: remainBg(E22) }}>{fmtMoney(E22)}</td>
            </tr>

            {/* 23 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Субподряд На мыло (с НДС)</td>
              <td style={whiteRight}>
                <NumericInput fieldKey="subcontractVatPct" displayValue={params.subcontractVatPct} summaryUpdater={(n) => updateSummary({ subcontractVatPct: n })} editBuffer={editBuffer} setEditBuffer={setEditBuffer} style={inputRight} title="% НДС субподряда" />
              </td>
              <td style={yellow}>{fmtMoney(C23)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 24 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Получено нал всего</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C24)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 25 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>НДС начисленный</td>
              <td style={roLeft}>—</td>
              <td style={isNoVat ? grayInactive : yellow}>{fmtMoney(C25)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 26 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>НДС в зачет</td>
              <td style={roLeft}>—</td>
              <td style={isNoVat ? grayInactive : yellow}>{fmtMoney(C26)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 27 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Чистая прибыль белая</td>
              <td style={roLeft}>—</td>
              <td style={isNoVat ? grayInactive : { ...yellow, background: posNegBg(C27) }}>{fmtMoney(C27)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 28 */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>ИТОГО затраты с налогами (без накладных)</td>
              <td style={roLeft}>—</td>
              <td style={yellow}>{fmtMoney(C28)}</td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

            {/* 29: Процент выручки минус затраты → мыло */}
            <tr>
              {RefCellLeft(nextRowNoLeft())}
              <td style={colAWhite}>Процент выручки минус затраты → мыло</td>
              <td style={roLeft}>—</td>
              <td style={whiteRight}>
                <NumericInput
                  fieldKey="soapShareFrac"
                  displayValue={params.soapShareFrac}
                  summaryUpdater={(n) => updateSummary({ soapShareFrac: n })}
                  editBuffer={editBuffer}
                  setEditBuffer={setEditBuffer}
                  style={inputRight}
                  title="Доля на мыло"
                  disabled={isNoVat} // при Без НДС = 1 и нередактируемая
                />
              </td>
              <td style={ro}>—</td>
              <td style={ro}>—</td>
            </tr>

          </tbody>
        </table>
      </div>

      <div /> {/* Разделитель */}

      {/* Правая часть: Контракты */}
      <div>
        <table style={table}>
          <colgroup>
            {showRefs && <col style={{ width: 32 }} />}
            <col style={{ width: "24%" }} />
            <col style={{ width: "26%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              {showRefs && <th style={{ ...thBlue, fontSize: 12, textAlign: "right" }}>#</th>}
              {ColumnHeader("F", "№ контракта и дата", thBlue)}
              {ColumnHeader("G", "Суть контракта", thBlue)}
              {ColumnHeader("H", "Стоимость, руб.", thBlue)}
              {ColumnHeader("I", "Рентаб., %", thBlue)}
              {ColumnHeader("J", "Прибыль на руки", thBlue)}
            </tr>
          </thead>
          <tbody>
            {manualContracts.map((r, idx) => {
              const amountKey = `contractAmount_${idx}`;  

              return (
                <tr key={`mc-${idx}`}>
                  {RefCellCtr(nextRowNoCtr())}
                  <td style={white}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="text"
                        value={r.numberDate || ""}
                        onChange={(e) => {
                          const next = manualContracts.map((x, i) =>
                            i === idx ? { ...x, numberDate: e.target.value } : x
                          );
                          updateSummary({ contractRows: next });
                        }}
                        style={input}
                      />
                      {/* delete button for this contract row */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = manualContracts.filter((_, i) => i !== idx);
                          updateSummary({ contractRows: next });
                        }}
                        title="Удалить строку"
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                  <td style={white}>
                    <input
                      type="text"
                      value={r.subject || ""}
                      onChange={(e) => {
                        const next = manualContracts.map((x, i) =>
                          i === idx ? { ...x, subject: e.target.value } : x
                        );
                        updateSummary({ contractRows: next });
                      }}
                      style={input}
                    />
                  </td>
                  <td style={whiteRight}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={
                        editBuffer[amountKey] !== undefined
                          ? editBuffer[amountKey]
                          : fmtMoney(r.amount || 0)
                      }
                      onFocus={(e) => {
                        setEditBuffer((b) => ({
                          ...b,
                          [amountKey]: String(r.amount ?? 0).replace(".", ","),
                        }));
                        setTimeout(() => e.target.select(), 0);
                      }}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (/[^0-9.,]/.test(val)) val = val.replace(/[^0-9.,]/g, "");
                        setEditBuffer((b) => ({ ...b, [amountKey]: val }));
                      }}
                      onBlur={(e) => {
                        const n = round2(parseNum(e.target.value));
                        const next = manualContracts.map((x, i) =>
                          i === idx ? { ...x, amount: n } : x
                        );
                        updateSummary({ contractRows: next });
                        setEditBuffer((b) => {
                          const nb = { ...b };
                          delete nb[amountKey];
                          return nb;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        else if (e.key === "Escape") {
                          setEditBuffer((b) => {
                            const nb = { ...b };
                            delete nb[amountKey];
                            return nb;
                          });
                          e.currentTarget.blur();
                        }
                      }}
                      style={inputRight}
                    />
                  </td>
                  <td style={ro}>—</td>
                  {/* All individual rows in J column remain a dash */}
                  <td style={ro}>—</td>
                </tr>
              );
            })}
            {hasTmcSaleRow && (
              <tr>
                {RefCellCtr(nextRowNoCtr())}
                <td style={roLeft}>—</td>
                <td style={white}>ТМЦ на продажу</td>
                <td style={yellow}>{fmtMoney(src.tmcSalesTotal)}</td>
                <td style={ro}>—</td>
                <td style={ro}>—</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              {showRefs && <td style={refTd}>{rowNoCtr + 1}</td>}
              <td style={{ ...white, fontWeight: 800 }}>Итого:</td>
              <td style={ro}>—</td>
              <td style={yellow}>{fmtMoney(contractTotal)}</td>
              <td style={{ ...yellow, background: posNegBg(profitOnHandPct) }}>{fmtMoney(profitOnHandPct)}%</td>
              {/* J total (Итого прибыль на руки) — J3 in your naming: show computed jTotal here */}
              <td style={{ ...yellow, background: posNegBg(jTotal) }} title={isNoVat ? "J3 = C24 - C2 - C7 - C8 - C9 - C10 - C11 - C12 - C14" : "Прибыль на руки"}>
                {fmtMoney(jTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={addContractRow}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #c59bff",
              background: "#f5efff",
              color: "#5427b0",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Добавить строку
          </button>
        </div>

        {/* Система налогообложения */}
        <table style={table}>
          <colgroup>
            {showRefs && <col style={{ width: 32 }} />}
            <col style={{ width: "70%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr>
              {showRefs && <th style={{ ...thBlue, fontSize: 12, textAlign: "right" }}>#</th>}
              {ColumnHeader("K", "Система налогообложения", thBlue)}
              {ColumnHeader("L", "Процент", thBlue)}
            </tr>
          </thead>
          <tbody>
            <tr>
              {RefCellTax(nextRowNoTax())}
              <td style={white}>
                <select
                  value={taxSystemId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const sys = TAX_SYSTEMS.find(x => x.id === nextId) || TAX_SYSTEMS[0];
                    updateSummary({ taxSystemId: nextId, vatPayPct: sys.percent });
                  }}
                  style={input}
                >
                  {TAX_SYSTEMS.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </td>
              <td style={{ ...ro, fontWeight: 700 }}>{fmtMoney(taxSystem.percent)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}