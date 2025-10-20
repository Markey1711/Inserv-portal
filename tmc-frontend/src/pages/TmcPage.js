import React, { useEffect, useRef, useState } from "react";
import CardModal from "../CardModal";
import CardCalc from "../Frontcalc/CardCalc";
import CalcJournal from "../Frontcalc/CalcJournal";
import TmcCard from "../Frontcalc/TmcCard";

/*
  Страница Справочник ТМЦ — перенесена из App.js.
  Содержит своё состояние (tmcList, filters и т.д.), модалку и таблицу.
*/
export default function TmcPage() {
  const [tmcList, setTmcList] = useState([]);
  const [filters, setFilters] = useState({
    code: "", name: "", group: "", category: "", unit: "",
    price: "", supplier: "", comment: "", amortization: ""
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);

  const stickyRef = useRef(null);
  const [stickyH, setStickyH] = useState(0);
  const tableStickyTop = Math.max(0, stickyH - 1);

  useEffect(() => {
    loadTmc();
    loadDicts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const measure = () => {
      setStickyH(Math.round(stickyRef.current?.getBoundingClientRect().height || 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stickyRef.current) ro.observe(stickyRef.current);
    window.addEventListener('resize', measure);
    const raf = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  function loadTmc() {
    fetch('http://localhost:3001/api/tmc')
      .then(res => res.json())
      .then(setTmcList)
      .catch(console.error);
  }
  function loadDicts() {
    fetch('http://localhost:3001/api/tmc/groups')
      .then(res => res.json())
      .then(setGroups)
      .catch(() => setGroups([]));
    fetch('http://localhost:3001/api/tmc/categories')
      .then(res => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }

  const maxCodeLength = tmcList.reduce((m, i) => Math.max(m, String(i.code ?? "").length), 2);

  // Локальные стили ячеек (как было)
  const thStyle = {
    padding: "4px 4px 2px 4px",
    border: "1px solid #ddd",
    background: "#fafafa",
    fontWeight: "bold",
    textAlign: "center",
    overflow: "hidden",
    whiteSpace: "nowrap"
  };
  const codeThStyle = { ...thStyle, minWidth: `${maxCodeLength + 2}ch`, width: `${maxCodeLength + 2}ch` };
  const thNameStyle = { ...thStyle, minWidth: "250px", maxWidth: "600px", whiteSpace: "normal", textAlign: "left" };
  const tdCodeStyle = { padding: "4px", border: "1px solid #eee", textAlign: "center", fontSize: "15px", maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const tdNameStyle = { padding: "4px", border: "1px solid #eee", textAlign: "left", fontSize: "15px", minWidth: "250px", maxWidth: "600px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.15 };
  const tdStyle = { padding: "4px", border: "1px solid #eee", textAlign: "center", fontSize: "15px", maxWidth: "210px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const inputStyle = { padding: "2px 4px", fontSize: "13px", borderRadius: "3px", border: "1px solid #ccc", marginTop: "2px", marginBottom: "2px", width: "90%" };

  function getGroupName(id) { const f = groups.find(g => String(g.id) === String(id)); return f ? f.name : id; }
  function getCategoryName(id) { const f = categories.find(c => String(c.id) === String(id)); return f ? f.name : id; }

  const filtered = tmcList.filter(item =>
    (filters.code === "" || String(item.code ?? "").toLowerCase().includes(filters.code.toLowerCase())) &&
    (filters.name === "" || String(item.name || "").toLowerCase().includes(filters.name.toLowerCase())) &&
    (filters.group === "" || String(getGroupName(item.group_id) || "").toLowerCase().includes(filters.group.toLowerCase())) &&
    (filters.category === "" || String(getCategoryName(item.category_id) || "").toLowerCase().includes(filters.category.toLowerCase())) &&
    (filters.unit === "" || String(item.unit || "").toLowerCase().includes(filters.unit.toLowerCase())) &&
    (filters.price === "" || String(item.price ?? "").toLowerCase().includes(filters.price.toLowerCase())) &&
    (filters.supplier === "" || String(item.supplier_link || "").toLowerCase().includes(filters.supplier.toLowerCase())) &&
    (filters.comment === "" || String(item.comment || "").toLowerCase().includes(filters.comment.toLowerCase())) &&
    (filters.amortization === "" || String(item.amortization_period ?? "").toLowerCase().includes(filters.amortization.toLowerCase()))
  );

  const isAdmin = true;

  function handleAddNew() {
    window.open(`${window.location.origin}/tmc/new`, '_blank', 'noopener');
  }
  function handleRemovePosition(id) {
    if (!window.confirm("Удалить позицию?")) return;
    fetch(`http://localhost:3001/api/tmc/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(r => { if (r.ok) loadTmc(); else alert('Ошибка удаления: ' + (r.error || '')); })
      .catch(err => alert('Ошибка запроса: ' + err));
  }
  function handleSave(updatedItem) {
    fetch('http://localhost:3001/api/tmc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedItem)
    })
      .then(res => res.json())
      .then(() => { setModalOpen(false); loadTmc(); })
      .catch(err => { alert('Ошибка сохранения: ' + err); setModalOpen(false); });
  }
  useEffect(() => { if (!modalOpen) setHighlightedId(null); }, [modalOpen]);

  return (
    <div style={{ width: "100%", maxWidth: "100vw", padding: 12 }}>
      {/* ЕДИНЫЙ липкий контейнер для заголовка и тулбара — без зазора */}
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#fafcff",
          margin: 0,
          borderBottom: "1px solid #e6e8ef",
          boxShadow: "0 1px 8px #0001",
        }}
      >
        <h2 style={{
          textAlign: "center",
          margin: 0,
          fontWeight: "bold",
          fontSize: "1.2rem",
          letterSpacing: "0.5px",
          padding: "8px 0 6px 0"
        }}>
          Справочник ТМЦ
        </h2>

        <div
          style={{
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
            borderTop: "1px solid #e6e8ef",
            background: "#fafcff",
          }}
        >
          <button
            style={{ fontSize: 16, background: "#e7f6d4", border: "1px solid #8bc34a", padding: "6px 16px", borderRadius: 4, cursor: "pointer" }}
            onClick={handleAddNew}
          >➕ Добавить позицию</button>
        </div>
      </div>

      <table
        className="table-sticky"
        style={{
          '--table-sticky-top': `${tableStickyTop}px`,
          width: "100%",
          background: "#fff",
          fontSize: "15px",
          tableLayout: "fixed",
          borderCollapse: "separate",
          borderSpacing: 0
        }}
      >
        <colgroup>
          <col style={{ width: "60px" }} />
          <col style={{ width: "350px" }} />
          <col style={{ width: "150px" }} />
          <col style={{ width: "210px" }} />
          <col style={{ width: "75px" }} />
          <col style={{ width: "70px" }} />
          <col style={{ width: "85px" }} />
          <col style={{ width: "130px" }} />
          <col style={{ width: "55px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "70px" }} />
        </colgroup>

        <thead>
          <tr>
            <th style={codeThStyle}>Код<br />
              <input style={inputStyle}
                value={filters.code}
                onChange={e => setFilters(f => ({ ...f, code: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thNameStyle}>Наименование<br />
              <input style={inputStyle}
                value={filters.name}
                onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Группа<br />
              <input style={inputStyle}
                value={filters.group}
                onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Категория<br />
              <input style={inputStyle}
                value={filters.category}
                onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Ед. изм.<br />
              <input style={inputStyle}
                value={filters.unit}
                onChange={e => setFilters(f => ({ ...f, unit: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Цена<br />
              <input style={inputStyle}
                value={filters.price}
                onChange={e => setFilters(f => ({ ...f, price: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Поставщик<br />
              <input style={inputStyle}
                value={filters.supplier}
                onChange={e => setFilters(f => ({ ...f, supplier: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Комментарий<br />
              <input style={inputStyle}
                value={filters.comment}
                onChange={e => setFilters(f => ({ ...f, comment: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}>Фото</th>
            <th style={thStyle}>Амортизация (мес.)<br />
              <input style={inputStyle}
                value={filters.amortization}
                onChange={e => setFilters(f => ({ ...f, amortization: e.target.value }))}
                placeholder="Поиск..." />
            </th>
            <th style={thStyle}></th>
          </tr>
        </thead>

        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ textAlign: "center", padding: 16, color: "#888" }}>Нет данных</td>
            </tr>
          ) : filtered.map(item => (
            <tr
              key={item.id}
              style={{
                borderBottom: "1px solid #eee",
                cursor: "pointer",
                background: (highlightedId === item.id) ? "#e9f2fa" : undefined
              }}
              onClick={() => setHighlightedId(item.id)}
              onDoubleClick={() => { window.open(`${window.location.origin}/tmc/${item.id}`, '_blank', 'noopener'); }}
            >
              <td style={tdCodeStyle}>{item.code}</td>
              <td style={tdNameStyle}>{item.name}</td>
              <td style={tdStyle}>{getGroupName(item.group_id)}</td>
              <td style={tdStyle}>{getCategoryName(item.category_id)}</td>
              <td style={tdStyle}>{item.unit}</td>
              <td style={tdStyle}>
                {item.price !== undefined && item.price !== "" && !isNaN(Number(item.price))
                  ? Number(item.price).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                  : ""}
              </td>
              <td style={tdStyle}>
                {item.supplier_link
                  ? <a href={item.supplier_link} target="_blank" rel="noopener noreferrer" style={{ color: "#3a27c5", textDecoration: "underline" }}>Ссылка</a>
                  : "-"}
              </td>
              <td style={tdStyle}>{item.comment}</td>
              <td style={tdStyle}>
                {item.photo_url
                  ? <img src={`http://localhost:3001${item.photo_url}`} alt="Фото" width={40} />
                  : "-"}
              </td>
              <td style={tdStyle}>{item.amortization_period ?? "-"}</td>
              <td style={tdStyle}>
                <button
                  style={{ border: 'none', background: 'none', color: '#c00', fontSize: '18px', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); handleRemovePosition(item.id); }}
                  title="Удалить позицию"
                >🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <CardModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={selectedItem}
        onSave={handleSave}
        isAdmin={isAdmin}
        tmcList={tmcList}
      />
    </div>
  );
}