import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ObjectsPage() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  // форма создания вынесена на отдельную страницу /objects/new
  const navigate = useNavigate();

  const loadObjects = () => {
    setLoading(true);
    setError("");
    fetch("http://localhost:3001/api/objects")
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => Number(a.codeBase) - Number(b.codeBase));
        setObjects(arr);
        setLoading(false);
      })
      .catch(() => {
        setError("Ошибка загрузки объектов");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadObjects();
  }, []);

  const handleGoCreate = () => navigate('/objects/new');

  const handleRowClick = (o) => setSelectedId(o.id);
  const handleRowDoubleClick = (o) => navigate(`/objects/${o.id}`);

  const handleDelete = async (o) => {
    if (!window.confirm(`Удалить объект «${o.name}»? Это действие необратимо.`)) return;
    try {
      const res = await fetch(`http://localhost:3001/api/objects/${o.id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const body = await res.json().catch(()=>({}));
        const cnt = body?.count || 0;
        alert(`Нельзя удалить объект: к нему привязано ${cnt} карточек расчёта.`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(()=>({}));
        throw new Error(body?.error || 'DELETE_FAILED');
      }
      if (selectedId === o.id) setSelectedId(null);
      loadObjects();
    } catch (e) {
      alert('Ошибка удаления: ' + (e?.message || e));
    }
  };

  return (
    <div style={{ padding: "32px 0 0 0" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 14px 0" }}>Журнал объектов</h2>

      <div style={{ textAlign: 'right', marginBottom: 16 }}>
        <button onClick={handleGoCreate} style={{ padding: '8px 12px', background: '#e7f6d4', border: '1px solid #8bc34a' }}>
          Создать новый объект
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center" }}>Загрузка…</div>
      ) : error ? (
        <div style={{ textAlign: "center", color: "#c00" }}>{error}</div>
      ) : (
        <table
          style={{ width: "100%", background: "#fff", borderCollapse: "collapse", boxShadow: "0 1px 14px #0002" }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>Код</th>
              <th style={{ padding: 10, textAlign: "left" }}>Название</th>
              <th style={{ padding: 10, textAlign: "left" }}>Расчётов</th>
              <th style={{ padding: 10, textAlign: "left" }}>Адрес</th>
              <th style={{ padding: 10, textAlign: "left" }}>Контакты</th>
              <th style={{ padding: 10, textAlign: "left" }}>Юр. лицо клиента</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {objects.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 16, color: "#777" }}>
                  Объектов нет
                </td>
              </tr>
            ) : (
              objects.map((o) => {
                const isSel = selectedId === o.id;
                return (
                  <tr
                    key={o.id}
                    onClick={() => handleRowClick(o)}
                    onDoubleClick={() => handleRowDoubleClick(o)}
                    style={{ background: isSel ? '#f0f7ff' : undefined, cursor: 'pointer' }}
                  >
                    <td style={{ padding: 8 }}>{String(o.codeBase).padStart(4, "0")}</td>
                    <td style={{ padding: 8 }}>{o.name}</td>
                    <td style={{ padding: 8 }}>{o.calcCount}</td>
                    <td style={{ padding: 8 }}>{o.address || "—"}</td>
                    <td style={{ padding: 8 }}>{o.contacts || "—"}</td>
                    <td style={{ padding: 8 }}>{o.clientCompany || "—"}</td>
                    <td style={{ padding: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(o); }}
                        title="Удалить объект"
                        style={{ background: '#fff0f0', border: '1px solid #e5bdbd', borderRadius: 4, cursor: 'pointer', padding: '4px 8px' }}
                      >
                        🗑️ Удалить
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
