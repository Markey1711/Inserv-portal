import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import GeneralSheet from "./sheets/GeneralSheet";
import StaffSheet from "./sheets/StaffSheet";
import TmcSheet from "./sheets/TmcSheet";
import AmortSheet from "./sheets/AmortSheet";
import ExtrasSheet from "./sheets/ExtrasSheet";
import SummarySheet from "./sheets/SummarySheet";

import "../styles/brand-decor.css";

const SHEETS = [
  "Общая информация",
  "Штатное расписание",
  "ТМЦ",
  "Амортизация",
  "Доп.затраты",
  "Итоговая страница",
];

function getEmptyCardData() {
  return {
    objectCode: "",
    status: "draft",
    createdAt: new Date().toISOString(),
    approvals: [],
    objectName: "",
    company: "",
    address: "",
    customer: "",
    comment: "",
    areaTable: [],
    sheets: {
      general: {},
      staff: [],
      tmc: [],
      amortization: [],
      extraCosts: [],
      summary: {},
    },
  };
}

function mergeCardWithEmpty(data) {
  const base = getEmptyCardData();
  const incomingSheets = data?.sheets || {};
  const incomingExtraCosts = Array.isArray(incomingSheets.extraCosts)
    ? incomingSheets.extraCosts
    : Array.isArray(incomingSheets.extras)
    ? incomingSheets.extras
    : [];

  return {
    ...base,
    ...data,
    areaTable: Array.isArray(data?.areaTable) ? data.areaTable : base.areaTable,
    sheets: {
      ...base.sheets,
      ...incomingSheets,
      staff: Array.isArray(incomingSheets?.staff) ? incomingSheets.staff : [],
      tmc: Array.isArray(incomingSheets?.tmc) ? incomingSheets.tmc : [],
      amortization: Array.isArray(incomingSheets?.amortization) ? incomingSheets.amortization : [],
      extraCosts: incomingExtraCosts,
      summary: incomingSheets?.summary || {},
    },
  };
}

export default function CardCalc({ isNew = false }) {
  const { id } = useParams(); // objectCode из URL
  const navigate = useNavigate();

  const [cardData, setCardData] = useState(getEmptyCardData());
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAdmin] = useState(() => localStorage.getItem("isAdmin") === "1");

  // дебаунс сохранения
  const saveTimerRef = useRef(null);
  const SAVE_DELAY = 700;

  // Загрузка карточки
  useEffect(() => {
    let aborted = false;

    async function load() {
      if (isNew) {
        setCardData(getEmptyCardData());
        setLoading(false);
        return;
      }
      if (!id) {
        setCardData(getEmptyCardData());
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/card-calc/${encodeURIComponent(id)}`);
        if (aborted) return;
        if (res.status === 404) {
          setCardData({ notFound: true });
        } else {
          const data = await res.json();
          setCardData(data ? mergeCardWithEmpty(data) : { notFound: true });
        }
      } catch {
        if (!aborted) setCardData({ notFound: true });
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    load();
    return () => {
      aborted = true;
    };
  }, [id, isNew]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Первое сохранение (создание)
  function handleFirstSaveCard(newData) {
    fetch("http://localhost:3001/api/card-calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData),
    })
      .then((res) => res.json())
      .then((created) => {
        const merged = mergeCardWithEmpty({ ...newData, ...created });
        setCardData(merged);
        const code = created?.objectCode || merged.objectCode;
        if (code) navigate(`/card-calc/${code}`);
      })
      .catch((err) => alert("Ошибка создания карточки: " + err));
  }

  // Унифицированное автосохранение (с дебаунсом)
  function handleAutoSave(nextData) {
    const normalized = mergeCardWithEmpty(nextData);
    setCardData(normalized);

    const code = normalized?.objectCode || cardData?.objectCode;
    if (!code) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const body = JSON.stringify({ ...normalized, objectCode: code });
        const res = await fetch(`http://localhost:3001/api/card-calc/${encodeURIComponent(code)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const updatedCard = await res.json();

        const clientSheets = normalized?.sheets || {};
        const serverSheets = updatedCard?.sheets || {};

        const safeUpdated = mergeCardWithEmpty({
          ...updatedCard,
          sheets: {
            ...serverSheets,
            staff:
              Array.isArray(serverSheets.staff) && serverSheets.staff.length > 0
                ? serverSheets.staff
                : Array.isArray(clientSheets.staff)
                ? clientSheets.staff
                : [],
            tmc:
              Array.isArray(serverSheets.tmc) && serverSheets.tmc.length > 0
                ? serverSheets.tmc
                : Array.isArray(clientSheets.tmc)
                ? clientSheets.tmc
                : [],
            amortization:
              Array.isArray(serverSheets.amortization) && serverSheets.amortization.length > 0
                ? serverSheets.amortization
                : Array.isArray(clientSheets.amortization)
                ? clientSheets.amortization
                : [],
            extraCosts:
              Array.isArray(serverSheets.extraCosts) && serverSheets.extraCosts.length > 0
                ? serverSheets.extraCosts
                : Array.isArray(clientSheets.extraCosts)
                ? clientSheets.extraCosts
                : [],
            summary:
              serverSheets.summary && Object.keys(serverSheets.summary).length > 0
                ? serverSheets.summary
                : clientSheets.summary || {},
          },
        });

        setCardData(safeUpdated);
      } catch (err) {
        console.error("PATCH /api/card-calc failed", err);
      } finally {
        setSaving(false);
      }
    }, SAVE_DELAY);
  }

  // Быстрое добавление строки в "Штатное расписание" (кнопка на вкладке + публичный API для StaffSheet при желании)
  function handleAddStaffRow() {
    const current = cardData.sheets?.staff || [];
    const next = [
      ...current,
      {
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
      },
    ];
    handleAutoSave({ ...cardData, sheets: { ...cardData.sheets, staff: next } });
  }

  const handleEditPositions = () =>
    alert("Откроется редактор справочника Должностей (доступно администратору).");
  const handleEditRegimes = () =>
    alert("Откроется редактор справочника Режимов (доступно администратору).");

  if (loading) {
    return <div style={{ textAlign: "center", margin: 40 }}>Загрузка…</div>;
  }
  if (cardData && cardData.notFound) {
    return (
      <div style={{ color: "#c00", textAlign: "center", margin: 40 }}>
        Карточка с таким кодом не найдена.
      </div>
    );
  }

  const cardTitle = (
    <span style={{ fontWeight: "normal" }}>
      Карточка расчёта стоимости услуг объекта{" "}
      <span style={{ fontWeight: "bold" }}>«{cardData?.objectName || "—"}»</span>
    </span>
  );

  // Доп. панель действий для отдельных вкладок
  const renderTabActions = () => {
    if (activeSheet === 1) {
      return (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            onClick={handleAddStaffRow}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #8bc34a",
              background: "#e7f6d4",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Добавить строку в штатное расписание"
          >
            + Добавить строку
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="brand-page">
      <div
        className="calc-card calc-card--brand"
        style={{
          background: "var(--bg-card, #fff)",
          border: "1px solid var(--border-200, #e6e8ef)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "var(--shadow-1, 0 2px 16px rgba(0,0,0,.08))",
          maxWidth: 1700,
          margin: "40px auto",
          padding: 32,
          position: "relative",
          zIndex: 1,
        }}
      >
        {cardData?.objectCode && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 240,
              fontWeight: 700,
              fontSize: "1.07rem",
              color: "var(--text-700, #2b2f36)",
            }}
          >
            Код объекта: {cardData.objectCode}
          </div>
        )}

        <div
          className="calc-title"
          style={{
            fontWeight: "normal",
            fontSize: "1.5rem",
            textAlign: "center",
            margin: "10px 0 22px 0",
            lineHeight: "1.2",
            color: "var(--text-900, #111317)",
          }}
        >
          {cardTitle}
        </div>

        {/* Вкладки */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 18,
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {SHEETS.map((name, idx) => {
            const active = activeSheet === idx;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setActiveSheet(idx)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  background: active ? "var(--brand-50, #f5efff)" : "#fff",
                  border: active ? "1px solid var(--brand-300, #c59bff)" : "1px solid var(--border-200, #e6e8ef)",
                  color: active ? "var(--brand-800, #5427b0)" : "var(--text-700, #2b2f36)",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: active ? "0 2px 10px rgba(0,0,0,.06)" : "none",
                }}
              >
                {name}
              </button>
            );
          })}
        </div>

        {renderTabActions()}

        {/* Контент вкладок */}
        <div style={{ marginBottom: 8 }}>
          {activeSheet === 0 && (
            <GeneralSheet
              data={cardData}
              onChange={cardData?.objectCode ? handleAutoSave : handleFirstSaveCard}
            />
          )}

          {activeSheet === 1 && (
            <StaffSheet
              data={cardData.sheets?.staff || []}
              onChange={(v) =>
                handleAutoSave({
                  ...cardData,
                  sheets: { ...cardData.sheets, staff: v },
                })
              }
              isAdmin={isAdmin}
              onEditPositions={handleEditPositions}
              onEditRegimes={handleEditRegimes}
            />
          )}

          {activeSheet === 2 && (
            <TmcSheet
              data={cardData.sheets?.tmc || []}
              onChange={(v) =>
                handleAutoSave({
                  ...cardData,
                  sheets: { ...cardData.sheets, tmc: v },
                })
              }
            />
          )}

          {activeSheet === 3 && (
            <AmortSheet
              data={cardData.sheets?.amortization || []}
              onChange={(v) =>
                handleAutoSave({
                  ...cardData,
                  sheets: { ...cardData.sheets, amortization: v },
                })
              }
            />
          )}

          {activeSheet === 4 && (
            <ExtrasSheet
              data={cardData.sheets?.extraCosts || []}
              onChange={(v) =>
                handleAutoSave({
                  ...cardData,
                  sheets: { ...cardData.sheets, extraCosts: v },
                })
              }
            />
          )}

          {activeSheet === 5 && (
            <SummarySheet
              cardData={cardData}
              onChange={handleAutoSave}
            />
          )}
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: saving ? "#0070f3" : "#6b7280", textAlign: "right" }}>
          {saving ? "Сохранение…" : "Все изменения сохраняются автоматически"}
        </div>
      </div>
    </div>
  );
}