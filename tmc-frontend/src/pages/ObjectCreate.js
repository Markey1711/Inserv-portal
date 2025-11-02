import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ObjectCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contacts, setContacts] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    const nm = (name || "").trim();
    if (!nm) return alert("Введите уникальное название объекта");
    setSaving(true);
    fetch("http://localhost:3001/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nm, address, contacts, clientCompany })
    })
      .then((r) => {
        if (r.status === 409) throw new Error("Название занято");
        return r.json();
      })
      .then((obj) => navigate(`/objects/${obj.id}`))
      .catch((e) => alert("Ошибка создания: " + e.message))
      .finally(() => setSaving(false));
  };

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
        <div style={{ fontSize: "1.35rem", marginBottom: 10 }}>Создать новый объект</div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, alignItems: "center" }}>
          <div>Название объекта:</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "8px 10px" }} />

          <div>Адрес объекта:</div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} style={{ padding: "8px 10px" }} />

          <div>Контакты:</div>
          <input value={contacts} onChange={(e) => setContacts(e.target.value)} style={{ padding: "8px 10px" }} />

          <div>Юр. лицо клиента:</div>
          <input value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} style={{ padding: "8px 10px" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => navigate(-1)}>Назад</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#e7f6d4", border: "1px solid #8bc34a", padding: "8px 12px" }}>
            {saving ? "Создаю..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
