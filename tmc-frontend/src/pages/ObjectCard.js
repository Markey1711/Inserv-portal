import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ObjectCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [obj, setObj] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`http://localhost:3001/api/objects/${encodeURIComponent(id)}`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) setObj({ notFound: true });
        else setObj(data);
      })
      .catch(() => setError("Ошибка загрузки объекта"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = () => {
    const body = {
      name: obj.name,
      address: obj.address ?? null,
      contacts: obj.contacts ?? null,
      clientCompany: obj.clientCompany ?? null,
    };
    fetch(`http://localhost:3001/api/objects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => {
        if (r.status === 409) throw new Error("Название занято");
        return r.json();
      })
      .then((saved) => setObj(saved))
      .catch((e) => alert("Ошибка сохранения: " + e.message));
  };

  if (loading) return <div style={{ textAlign: "center", margin: 40 }}>Загрузка…</div>;
  if (obj?.notFound) return <div style={{ textAlign: "center", margin: 40, color: "#c00" }}>Объект не найден</div>;

  return (
    <div style={{ padding: "32px 0 0 0" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e6e8ef",
          borderRadius: 8,
          maxWidth: 820,
          margin: "0 auto",
          padding: 20,
          boxShadow: "0 2px 16px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ fontSize: "1.35rem", marginBottom: 10 }}>
          Объект {String(obj.codeBase).padStart(4, "0")} — расчётов: {obj.calcCount}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, alignItems: "center" }}>
          <div>Название:</div>
          <input
            value={obj.name || ""}
            onChange={(e) => setObj((s) => ({ ...s, name: e.target.value }))}
            style={{ padding: "8px 10px" }}
          />

          <div>Адрес объекта:</div>
          <input
            value={obj.address || ""}
            onChange={(e) => setObj((s) => ({ ...s, address: e.target.value }))}
            style={{ padding: "8px 10px" }}
          />

          <div>Контакты:</div>
          <input
            value={obj.contacts || ""}
            onChange={(e) => setObj((s) => ({ ...s, contacts: e.target.value }))}
            style={{ padding: "8px 10px" }}
          />

          <div>Юр. лицо клиента:</div>
          <input
            value={obj.clientCompany || ""}
            onChange={(e) => setObj((s) => ({ ...s, clientCompany: e.target.value }))}
            style={{ padding: "8px 10px" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => navigate(-1)}>Назад</button>
          <button onClick={handleSave} style={{ background: "#e7f6d4", border: "1px solid #8bc34a", padding: "8px 12px" }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
