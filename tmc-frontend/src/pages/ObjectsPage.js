import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ObjectsPage() {
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
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

  const handleCreate = () => {
    const nm = (name || "").trim();
    if (!nm) return alert("Введите уникальное название объекта");
    const body = { name: nm };
    if (periodMonth) body.periodMonth = Number(periodMonth);
    if (periodYear) body.periodYear = Number(periodYear);

    fetch("http://localhost:3001/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (r.status === 409) throw new Error("Название занято");
        return r.json();
      })
      .then((obj) => {
        setName("");
        setPeriodMonth("");
        setPeriodYear("");
        navigate(`/objects/${obj.id}`);
      })
      .catch((e) => alert("Ошибка создания: " + e.message));
  };

  return (
    <div style={{ padding: "32px 0 0 0" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 14px 0" }}>Журнал объектов</h2>

      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 8,
          border: "1px solid #e6e8ef",
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Создать объект</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Уникальное название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 260, padding: "8px 10px" }}
          />
          <select
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            style={{ padding: "8px 10px" }}
          >
            <option value="">Месяц</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Год"
            value={periodYear}
            onChange={(e) => setPeriodYear(e.target.value)}
            style={{ width: 120, padding: "8px 10px" }}
          />
          <button onClick={handleCreate} style={{ padding: "8px 12px", background: "#e7f6d4", border: "1px solid #8bc34a" }}>
            Создать
          </button>
        </div>
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
              <th style={{ padding: 10, textAlign: "left" }}>Период</th>
              <th></th>
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
              objects.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: 8 }}>{String(o.codeBase).padStart(4, "0")}</td>
                  <td style={{ padding: 8 }}>{o.name}</td>
                  <td style={{ padding: 8 }}>{o.calcCount}</td>
                  <td style={{ padding: 8 }}>
                    {o.periodMonth && o.periodYear ? `${String(o.periodMonth).padStart(2, "0")}.${o.periodYear}` : "—"}
                  </td>
                  <td style={{ padding: 8 }}>
                    <Link to={`/objects/${o.id}`}>Открыть</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
