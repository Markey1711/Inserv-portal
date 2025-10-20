import React, { useRef, useState, useEffect } from "react";

export default function CardModal({ open, onClose, item, onSave, isAdmin = false, tmcList = [] }) {
  const [editItem, setEditItem] = useState(item || {});
  const [isDirty, setIsDirty] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Справочники
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([
    "Канистра", "Коробка", "Л.", "Мешок", "Пара", "Пачка", "Рулон", "Упак.", "Флакон", "Шт."
  ]);

  const [unitInput, setUnitInput] = useState(item?.unit ?? "");
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showUnitEditor, setShowUnitEditor] = useState(false);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState(item?.group_id ? String(item.group_id) : "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(item?.category_id ? String(item.category_id) : "");

  // Фото превью
  const [localPhotoUrl, setLocalPhotoUrl] = useState("");
  const fileInputRef = useRef();

  // --- Загрузка справочников (устойчивая) ---
  async function reloadDicts() {
    try {
      const rg = await fetch("http://localhost:3001/api/tmc/groups");
      const groupsData = rg.ok ? await rg.json() : [];
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch { setGroups([]); }

    try {
      const rc = await fetch("http://localhost:3001/api/tmc/categories");
      const catsData = rc.ok ? await rc.json() : [];
      setCategories(Array.isArray(catsData) ? catsData : []);
    } catch { setCategories([]); }
  }
  useEffect(() => { reloadDicts(); }, []);

  useEffect(() => {
    setEditItem(item || {});
    setSelectedGroupId(item?.group_id ? String(item.group_id) : "");
    setSelectedCategoryId(item?.category_id ? String(item.category_id) : "");
    setUnitInput(item?.unit ?? "");
    setIsDirty(false);
    setLocalPhotoUrl("");
    setValidationError("");
  }, [item, open]);

  // Категории, относящиеся к выбранной группе
  const filteredCategories = Array.isArray(categories)
    ? categories.filter(cat => String(cat.groupId ?? cat.group_id) === selectedGroupId)
    : [];
  const filteredUnits = units.filter(u => u.toLowerCase().includes(unitInput.toLowerCase()));

  const photoSrc = localPhotoUrl
    ? localPhotoUrl
    : (editItem.photo_url ? `http://localhost:3001${editItem.photo_url}` : "");

  const isExpense = selectedGroupId === "1";

  if (!open || !item) return null;

  function handleChange(e) {
    const { name, value } = e.target;
    setEditItem(i => ({ ...i, [name]: value }));
    setIsDirty(true);
    if (validationError) setValidationError("");
  }
  function handleGroupChange(e) {
    setSelectedGroupId(e.target.value);
    setSelectedCategoryId("");
    setEditItem(i => ({ ...i, group_id: e.target.value, category_id: "" }));
    setIsDirty(true);
    if (validationError) setValidationError("");
  }
  function handleCategoryChange(e) {
    setSelectedCategoryId(e.target.value);
    setEditItem(i => ({ ...i, category_id: e.target.value }));
    setIsDirty(true);
    if (validationError) setValidationError("");
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setEditItem(i => ({ ...i, photoFile: file })); // сейчас игнорируется сервером
      setIsDirty(true);
      setLocalPhotoUrl(URL.createObjectURL(file));
      if (validationError) setValidationError("");
    }
  }

  function handleUnitInputChange(e) {
    const value = e.target.value;
    setUnitInput(value);
    setEditItem(i => ({ ...i, unit: value }));
    setShowUnitDropdown(value.length > 0 && filteredUnits.length > 0);
    setIsDirty(true);
    if (validationError) setValidationError("");
  }
  function handleUnitSelect(unit) {
    setUnitInput(unit);
    setEditItem(i => ({ ...i, unit }));
    setShowUnitDropdown(false);
    setIsDirty(true);
    if (validationError) setValidationError("");
  }
  function handleUnitInputBlur() {
    setTimeout(() => setShowUnitDropdown(false), 100);
  }

  // ---- ВАЛИДАЦИЯ ----
  function validateFields() {
    const requiredFields = [
      { key: "name", label: "Наименование" },
      { key: "group_id", label: "Группа" },
      { key: "unit", label: "Ед. изм." },
      { key: "price", label: "Цена" },
      { key: "category_id", label: "Категория" },
    ];
    const emptyFields = requiredFields.filter(f => {
      let val = editItem[f.key];
      if (f.key === "price") return !val || isNaN(Number(val)) || Number(val) <= 0;
      return !val || (typeof val === "string" && val.trim() === "");
    });
    return emptyFields.map(f => f.label);
  }

  function handleSave() {
    const isNew = !editItem.id;
    let itemToSave = { ...editItem };

    // Валидация
    const notFilled = validateFields();
    if (notFilled.length > 0) {
      setValidationError(`Заполните обязательные поля: ${notFilled.join(", ")}`);
      return;
    }

    // Присваиваем code только при создании
    if (isNew) {
      const maxCode = tmcList.length ? Math.max(...tmcList.map(i => Number(i.code) || 0)) : 0;
      itemToSave.code = maxCode + 1;
    }

    // Пока отправляем только JSON (без загрузки фото)
    const payload = JSON.stringify(itemToSave);

    fetch('http://localhost:3001/api/tmc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    })
      .then(res => res.json())
      .then(data => {
        onSave(data);
        setIsDirty(false);
        setLocalPhotoUrl("");
        setValidationError("");
        onClose();
      })
      .catch(err => {
        alert('Ошибка сохранения: ' + err);
      });
  }

  function handleClose() {
    if (isDirty) {
      if (!window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")) return;
    }
    setLocalPhotoUrl("");
    setValidationError("");
    onClose();
  }

  // --- редакторы ед.изм/групп/категорий (без изменений) ---
  function handleAddUnit() {
    const name = prompt("Название новой единицы измерения:");
    if (!name) return;
    setUnits([...units, name]);
  }
  function handleEditUnit(index) {
    const name = prompt("Новое название:", units[index]);
    if (!name) return;
    setUnits(units.map((u, i) => i === index ? name : u));
  }
  function handleRemoveUnit(index) {
    if (!window.confirm("Удалить единицу?")) return;
    setUnits(units.filter((u, i) => i !== index));
  }

  function handleAddGroup() {
    const name = prompt("Название новой группы:");
    if (!name) return;
    fetch("http://localhost:3001/api/tmc/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    })
      .then(r => r.json())
      .then(() => reloadDicts());
  }
  function handleRemoveGroup(id) {
    if (!window.confirm("Удалить группу?")) return;
    fetch(`http://localhost:3001/api/tmc/groups/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(result => {
        if (result.ok) reloadDicts();
        else alert('Ошибка удаления: ' + (result.error || ''));
      })
      .catch(err => alert('Ошибка запроса: ' + err));
  }

  function handleAddCategory() {
    const name = prompt("Название новой категории:");
    if (!name) return;
    let groupId = prompt("ID группы для категории (например, 1 или 2):");
    if (!groupId) return;
    fetch("http://localhost:3001/api/tmc/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, groupId: Number(groupId) })
    })
      .then(r => r.json())
      .then(() => reloadDicts());
  }
  function handleRemoveCategory(id) {
    if (!window.confirm("Удалить категорию?")) return;
    fetch(`http://localhost:3001/api/tmc/categories/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(result => {
        if (result.ok) reloadDicts();
        else alert('Ошибка удаления: ' + (result.error || ''));
      })
      .catch(err => alert('Ошибка запроса: ' + err));
  }

  function handlePriceChange(e) {
    let val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    setEditItem(i => ({ ...i, price: val }));
    setIsDirty(true);
    if (validationError) setValidationError("");
  }
  function getFormattedPrice() {
    if (!editItem.price || isNaN(Number(editItem.price))) return "";
    const num = Number(editItem.price);
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{
        background: "#fff", padding: 32, borderRadius: 8,
        width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 4px 32px #0002",
        position: "relative"
      }}>
        <button
          onClick={handleClose}
          style={{
            position: "absolute", top: 12, right: 16,
            background: "none", border: "none", fontSize: 24, lineHeight: "20px", color: "#888", cursor: "pointer", zIndex: 2
          }}
          title="Закрыть"
        >&times;</button>

        <h2 style={{ marginTop: 0 }}>Карточка ТМЦ</h2>
        {editItem.code && (
          <div style={{ marginBottom: 12 }}>
            <b>Код:</b> {editItem.code}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label>Наименование<br />
            <input name="name" value={editItem.name ?? ""} onChange={handleChange} style={inputStyle} />
          </label>
        </div>

        <div style={{ marginBottom: 12, display: "flex", alignItems: "center" }}>
          <label style={{ flex: 1 }}>Группа<br />
            <select value={selectedGroupId} onChange={handleGroupChange} style={inputStyle}>
              <option value="" disabled>Выберите группу...</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          {isAdmin && (
            <button style={dictBtn} onClick={() => setShowGroupEditor(true)}>
              Редактировать группы
            </button>
          )}
        </div>

        <div style={{ marginBottom: 12, display: "flex", alignItems: "center" }}>
          <label style={{ flex: 1 }}>Категория<br />
            <select
              value={selectedCategoryId}
              onChange={handleCategoryChange}
              style={inputStyle}
              disabled={!selectedGroupId}
            >
              <option value="" disabled>Выберите категорию...</option>
              {filteredCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          {isAdmin && (
            <button style={dictBtn} onClick={() => setShowCategoryEditor(true)}>
              Редактировать категории
            </button>
          )}
        </div>

        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", position: "relative" }}>
          <label style={{ flex: 1 }}>Ед. изм.<br />
            <input
              name="unit"
              value={unitInput}
              onChange={handleUnitInputChange}
              autoComplete="off"
              placeholder="Поиск..."
              style={inputStyle}
              onFocus={() => setShowUnitDropdown(filteredUnits.length > 0 && unitInput.length > 0)}
              onBlur={handleUnitInputBlur}
            />
            {showUnitDropdown && (
              <ul style={{
                position: "absolute", left: 0, top: "64px", width: "100%",
                maxHeight: "180px", background: "#fff", border: "1px solid #bbb", borderRadius: 4,
                boxShadow: "0 2px 12px #0002", zIndex: 50, margin: 0, padding: "2px 0",
                listStyle: "none", fontSize: 16, overflowY: "auto"
              }}>
                {filteredUnits.map((u) => (
                  <li
                    key={u}
                    style={{ padding: "6px 12px", cursor: "pointer", background: u === unitInput ? "#e0e0e0" : undefined }}
                    onMouseDown={() => handleUnitSelect(u)}
                  >
                    {u}
                  </li>
                ))}
              </ul>
            )}
          </label>
          {isAdmin && (
            <button style={dictBtn} onClick={() => setShowUnitEditor(true)}>
              Редактировать ед. изм.
            </button>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Цена<br />
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                name="price"
                value={editItem.price === undefined || editItem.price === "" ? "" : getFormattedPrice()}
                onChange={handlePriceChange}
                style={{ ...inputStyle, flex: "1 0 120px", marginRight: "8px" }}
                inputMode="decimal"
                pattern="[0-9]*"
                placeholder="Введите сумму"
              />
              <span style={{ color: "#222", fontSize: "16px", whiteSpace: "nowrap" }}>руб.</span>
            </div>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Поставщик<br />
            <input name="supplier_link" value={editItem.supplier_link ?? ""} onChange={handleChange} style={inputStyle} />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Комментарий<br />
            <input name="comment" value={editItem.comment ?? ""} onChange={handleChange} style={inputStyle} />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Фото<br />
            <div style={{ display: "flex", alignItems: "center" }}>
              {photoSrc
                ? <img src={photoSrc} alt="Фото" style={{ width: 80, height: 80, objectFit: "cover", border: "1px solid #ccc", borderRadius: 4 }} />
                : <div style={{
                  width: 80, height: 80, background: "#f2f2f2", color: "#999",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #ccc", borderRadius: 4, fontSize: 16
                }}>Фото</div>
              }
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ marginLeft: 12 }}
                onChange={handleFileChange}
              />
            </div>
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Амортизация (мес.)<br />
            <input
              name="amortization_period"
              value={editItem.amortization_period ?? ""}
              onChange={handleChange}
              style={inputStyle}
              disabled={isExpense}
              placeholder={isExpense ? "Недоступно для расходников" : ""}
            />
          </label>
          {isExpense && <div style={{ color: "#c00", fontSize: 12 }}>Это расходный материал — амортизация не применяется</div>}
        </div>

        {validationError && (
          <div style={{ color: "#c00", marginBottom: 12, fontWeight: "bold" }}>
            {validationError}
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "right" }}>
          <button onClick={handleClose} style={{ marginRight: 8 }}>Отмена</button>
          <button onClick={handleSave}>Сохранить</button>
        </div>

        {showUnitEditor && isAdmin && (
          <div style={modalEditorStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Редактирование единиц измерения</div>
            <ul style={{ marginBottom: 8 }}>
              {units.map((u, i) => (
                <li key={u} style={{ marginBottom: 4 }}>
                  {u}
                  <button style={dictBtn} onClick={() => handleEditUnit(i)}>✏️</button>
                  <button style={dictBtn} onClick={() => handleRemoveUnit(i)}>🗑️</button>
                </li>
              ))}
            </ul>
            <button style={dictBtn} onClick={handleAddUnit}>➕ Добавить ед. изм.</button>
            <button style={{ marginLeft: 16 }} onClick={() => setShowUnitEditor(false)}>Закрыть</button>
          </div>
        )}

        {showGroupEditor && isAdmin && (
          <div style={modalEditorStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Редактирование групп</div>
            <ul style={{ marginBottom: 8 }}>
              {groups.map(g => (
                <li key={g.id} style={{ marginBottom: 4 }}>
                  {g.name}
                  <button style={dictBtn} onClick={() => handleRemoveGroup(g.id)}>🗑️</button>
                </li>
              ))}
            </ul>
            <button style={dictBtn} onClick={handleAddGroup}>➕ Добавить группу</button>
            <button style={{ marginLeft: 16 }} onClick={() => setShowGroupEditor(false)}>Закрыть</button>
          </div>
        )}

        {showCategoryEditor && isAdmin && (
          <div style={modalEditorStyle}>
            <div style={{ fontWeight: "bold", marginBottom: 8 }}>Редактирование категорий</div>
            <ul style={{ marginBottom: 8 }}>
              {categories.map(c => (
                <li key={c.id} style={{ marginBottom: 4 }}>
                  {c.name} <span style={{ color: "#888" }}>({groups.find(g => String(g.id) === String(c.groupId ?? c.group_id))?.name})</span>
                  <button style={dictBtn} onClick={() => handleRemoveCategory(c.id)}>🗑️</button>
                </li>
              ))}
            </ul>
            <button style={dictBtn} onClick={handleAddCategory}>➕ Добавить категорию</button>
            <button style={{ marginLeft: 16 }} onClick={() => setShowCategoryEditor(false)}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "6px", fontSize: "15px", width: "100%", marginTop: "2px", marginBottom: "2px", boxSizing: "border-box"
};
const dictBtn = {
  marginLeft: 8, border: "none", background: "none", cursor: "pointer", fontSize: 16
};
const modalEditorStyle = {
  position: "absolute",
  left: 0, top: 0, right: 0, bottom: 0,
  background: "rgba(255,255,255,0.99)",
  borderRadius: 8,
  zIndex: 10,
  padding: "32px 24px",
  boxShadow: "0 4px 32px #0003"
};