import React, { useState, useEffect } from "react";

// GeneralSheet — исправление: добавление строки работает всегда корректно!
// Теперь добавленная строка не исчезает после быстрого PATCH и получения новых данных.

export default function GeneralSheet({ data, onChange }) {
  // Локальный стейт всегда синхронизируется с props.data
  const [localData, setLocalData] = useState(data || {});
  const [objectNameEditable, setObjectNameEditable] = useState(!data?.objectName);
  const [saved, setSaved] = useState(!!data?.objectCode);

  useEffect(() => {
    setLocalData(data || {});
    setSaved(!!(data && data.objectCode));
    setObjectNameEditable(!(data && data.objectName));
  }, [data]);

  // Сохранить новую карточку
  function handleSaveClick() {
    if (!localData.objectCode && localData.objectName?.trim()) {
      if (onChange) onChange(localData);
      setSaved(true);
      setObjectNameEditable(false);
    }
  }

  function handleNameChange(e) {
    setLocalData({ ...localData, objectName: e.target.value });
  }
  function handleNameBlur() {
    setObjectNameEditable(false);
  }

  // Автосохранение для остальных полей
  function handleFieldChange(field, value) {
    const nextData = { ...localData, [field]: value };
    setLocalData(nextData);
    if (localData.objectCode && onChange) onChange(nextData);
  }

  // Таблица площадей
  const areaRows = localData.areaTable || [];
  function handleAreaChange(idx, field, value) {
    const newRows = areaRows.map((row, i) =>
      i === idx ? { ...row, [field]: value } : row
    );
    const nextData = { ...localData, areaTable: newRows };
    setLocalData(nextData);
    if (localData.objectCode && onChange) onChange(nextData);
  }

  // Исправлено! — теперь добавленная строка не исчезает
  function handleAddAreaRow() {
    // Делаем optimistic update: сначала добавляем строку в локальный стейт
    const nextRows = [...areaRows, { territory: "", area: "" }];
    setLocalData({ ...localData, areaTable: nextRows });

    // Если карточка уже сохранена, отправляем изменения наружу
    if (localData.objectCode && onChange) {
      // Важно: передаем уже добавленную строку!
      onChange({ ...localData, areaTable: nextRows });
    }
  }

  function handleRemoveAreaRow(idx) {
    const newRows = areaRows.filter((_, i) => i !== idx);
    const nextData = { ...localData, areaTable: newRows };
    setLocalData(nextData);
    if (localData.objectCode && onChange) onChange(nextData);
  }

  const totalArea = areaRows.reduce((sum, row) => sum + (Number(row.area) || 0), 0);

  if (!localData) return <div>Загрузка...</div>;

  return (
    <div>
      <div style={{
        fontWeight: "bold",
        fontSize: "1.2rem",
        textAlign: "center",
        marginBottom: 16
      }}>
        {objectNameEditable || !localData.objectName ? (
          <input
            type="text"
            value={localData.objectName || ""}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            placeholder="Введите название объекта"
            style={{
              fontSize: "1.2rem",
              padding: "8px 20px",
              marginBottom: 6,
              borderRadius: 5,
              border: "1px solid #ccc",
              width: "70%",
              textAlign: "center"
            }}
          />
        ) : (
          <span>{localData.objectName}</span>
        )}
        {!saved && (
          <button
            onClick={handleSaveClick}
            style={{
              marginLeft: 18,
              fontSize: "1rem",
              padding: "6px 18px",
              borderRadius: 5,
              background: "#e7f6d4",
              border: "1px solid #8bc34a",
              cursor: "pointer"
            }}
            disabled={!localData.objectName || !localData.objectName.trim()}
          >
            Сохранить
          </button>
        )}
      </div>
      <div style={{ marginBottom: 11, display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ width: 110, textAlign: "right", fontWeight: 500 }}>Заказчик:</label>
        <input
          type="text"
          value={localData.company || ""}
          onChange={e => handleFieldChange("company", e.target.value)}
          disabled={!saved}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 11, display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ width: 110, textAlign: "right", fontWeight: 500 }}>Адрес:</label>
        <input
          type="text"
          value={localData.address || ""}
          onChange={e => handleFieldChange("address", e.target.value)}
          disabled={!saved}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: "bold", fontSize: "1rem", marginBottom: 8 }}>
          Площадь
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fafcff" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={tableThStyle}>Территория</th>
              <th style={tableThStyle}>Площадь, м.кв.</th>
              <th style={tableThStyle}></th>
            </tr>
          </thead>
          <tbody>
            {areaRows.map((row, idx) => (
              <tr key={idx}>
                <td style={tableTdStyle}>
                  <input
                    value={row.territory}
                    onChange={e => handleAreaChange(idx, "territory", e.target.value)}
                    disabled={!saved}
                    style={{ width: "100%", padding: "4px", ...inputStyle }}
                  />
                </td>
                <td style={tableTdStyle}>
                  <input
                    value={row.area}
                    onChange={e => handleAreaChange(idx, "area", e.target.value)}
                    disabled={!saved}
                    style={{ width: "100%", padding: "4px", ...inputStyle }}
                  />
                </td>
                <td style={tableTdStyle}>
                  <button
                    onClick={() => handleRemoveAreaRow(idx)}
                    disabled={!saved}
                    style={{ background: "#fff0f0", border: "1px solid #ccc", borderRadius: 4, cursor: "pointer", padding: "0 8px" }}
                  >🗑️</button>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ textAlign: "right", fontWeight: "bold" }}>Итого:</td>
              <td style={{ fontWeight: "bold" }}>{totalArea}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={3} style={{ textAlign: "right", padding: "8px 0" }}>
                <button
                  onClick={handleAddAreaRow}
                  disabled={!saved}
                  style={{
                    background: "#e7f6d4",
                    border: "1px solid #8bc34a",
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: "6px 22px",
                    fontWeight: "bold",
                    fontSize: "1rem"
                  }}
                >➕ Добавить строку</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginBottom: 11, display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ width: 110, textAlign: "right", fontWeight: 500 }}>Наше юр.лицо:</label>
        <input
          type="text"
          value={localData.customer || ""}
          onChange={e => handleFieldChange("customer", e.target.value)}
          disabled={!saved}
          style={inputStyle}
        />
      </div>
      <div style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ width: 110, textAlign: "right", fontWeight: 500 }}>Комментарий:</label>
        <input
          type="text"
          value={localData.comment || ""}
          onChange={e => handleFieldChange("comment", e.target.value)}
          disabled={!saved}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "5px 12px",
  borderRadius: 4,
  border: "1px solid #ccc",
  fontSize: "1rem",
  background: "#fff"
};

const tableThStyle = {
  padding: "8px 6px",
  border: "1px solid #ddd",
  background: "#fafafa",
  fontWeight: "bold",
  textAlign: "center",
  fontSize: "1rem"
};

const tableTdStyle = {
  padding: "4px 8px",
  border: "1px solid #eee",
  textAlign: "center"
};