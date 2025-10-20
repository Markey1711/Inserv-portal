import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function CalcJournal() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    objectCode: "",
    objectName: "",
    address: "",
    comment: "",
  });
  const [highlightedId, setHighlightedId] = useState(null);
  const navigate = useNavigate();

  const loadCards = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("http://localhost:3001/api/card-calc?page=1&perPage=200&raw=1")
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
        arr.sort((a, b) => Number(a.objectCode) - Number(b.objectCode));
        setCards(arr);
        setLoading(false);
      })
      .catch((e) => {
        setError("Ошибка загрузки данных");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  function handleDelete(objectCode) {
    if (!window.confirm("Удалить карточку?")) return;
    fetch(`http://localhost:3001/api/card-calc/${objectCode}`, { method: "DELETE" })
      .then((res) => res.json())
      .then((result) => {
        if (result.ok) {
          setCards((cards) => cards.filter((c) => String(c.objectCode) !== String(objectCode)));
          if (String(highlightedId) === String(objectCode)) setHighlightedId(null);
        } else {
          alert("Ошибка удаления: " + (result.error || ""));
        }
      })
      .catch((err) => alert("Ошибка запроса: " + err));
  }

  function handleCreate() {
    navigate("/card-calc/new");
  }

  const list = Array.isArray(cards) ? cards : [];

  // фильтрованная версия списка по inputs
  const filtered = useMemo(() => {
    const f = {
      code: (filters.objectCode || "").toString().toLowerCase(),
      name: (filters.objectName || "").toLowerCase(),
      address: (filters.address || "").toLowerCase(),
      comment: (filters.comment || "").toLowerCase(),
    };
    return list.filter((card) => {
      return (
        (f.code === "" || String(card.objectCode || "").toLowerCase().includes(f.code)) &&
        (f.name === "" || String(card.objectName || "").toLowerCase().includes(f.name)) &&
        (f.address === "" || String(card.address || "").toLowerCase().includes(f.address)) &&
        (f.comment === "" || String(card.comment || "").toLowerCase().includes(f.comment))
      );
    });
  }, [list, filters]);

  const onFilterChange = (key, value) => {
    setFilters((s) => ({ ...s, [key]: value }));
  };

  return (
    <div style={{ padding: "32px 0 0 0" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 14px 0" }}>Журнал расчетных карточек</h2>
      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <button
          style={{
            fontSize: 16,
            background: "#e7f6d4",
            border: "1px solid #8bc34a",
            padding: "7px 16px",
            borderRadius: 4,
            cursor: "pointer",
          }}
          onClick={handleCreate}
        >
          ➕ Новая карточка
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center" }}>Загрузка...</div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "#c00" }}>{error}</div>
      ) : (
        <table
          className="calc-table"
          style={{
            borderCollapse: "collapse",
            width: "100%",
            background: "#fff",
            fontSize: "15px",
            tableLayout: "fixed",
            boxShadow: "0 1px 14px #0002",
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ width: "10%" }}>Код</th>
              <th style={{ width: "35%" }}>Название объекта</th>
              <th style={{ width: "35%" }}>Адрес</th>
              <th style={{ width: "15%" }}>Комментарий</th>
              <th style={{ width: "5%" }}></th>
            </tr>

            {/* Фильтры: строка с input под заголовками, похожи на журнал ТМЦ */}
            <tr>
              <th style={{ padding: "6px" }}>
                <input
                  value={filters.objectCode}
                  onChange={(e) => onFilterChange("objectCode", e.target.value)}
                  placeholder="Поиск..."
                  style={{ width: "92%", padding: "6px 8px", fontSize: 13 }}
                />
              </th>
              <th style={{ padding: "6px" }}>
                <input
                  value={filters.objectName}
                  onChange={(e) => onFilterChange("objectName", e.target.value)}
                  placeholder="Поиск..."
                  style={{ width: "96%", padding: "6px 8px", fontSize: 13 }}
                />
              </th>
              <th style={{ padding: "6px" }}>
                <input
                  value={filters.address}
                  onChange={(e) => onFilterChange("address", e.target.value)}
                  placeholder="Поиск..."
                  style={{ width: "96%", padding: "6px 8px", fontSize: 13 }}
                />
              </th>
              <th style={{ padding: "6px" }}>
                <input
                  value={filters.comment}
                  onChange={(e) => onFilterChange("comment", e.target.value)}
                  placeholder="Поиск..."
                  style={{ width: "96%", padding: "6px 8px", fontSize: 13 }}
                />
              </th>
              <th />
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#888" }}>
                  Нет карточек
                </td>
              </tr>
            ) : (
              filtered.map((card) => {
                const isSelected = String(card.objectCode) === String(highlightedId);
                return (
                  <tr
                    key={card.objectCode}
                    onDoubleClick={() => navigate(`/card-calc/${card.objectCode}`)}
                    onClick={() => setHighlightedId(card.objectCode)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "rgba(86,61,255,0.08)" : "transparent",
                    }}
                  >
                    <td>
                      <Link to={`/card-calc/${card.objectCode}`}>{card.objectCode}</Link>
                    </td>
                    <td>{card.objectName}</td>
                    <td>{card.address}</td>
                    <td>{card.comment}</td>
                    <td>
                      <button
                        style={{
                          border: "none",
                          background: "none",
                          color: "#c00",
                          fontSize: "18px",
                          cursor: "pointer",
                        }}
                        onClick={() => handleDelete(card.objectCode)}
                        title="Удалить карточку"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}