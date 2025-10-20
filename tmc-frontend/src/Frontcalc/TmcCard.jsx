import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API = "http://localhost:3001";

const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const parseNum = (s) => {
  const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export default function TmcCard() {
  const { id } = useParams();
  // FIX: новая карточка, если параметра id нет ИЛИ он равен "new"
  const isNew = id === undefined || String(id) === "new";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [item, setItem] = useState(null);

  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);

  // Подгружаем справочники и текущую позицию (или создаём пустую для /tmc/new)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [grpRes, catRes] = await Promise.all([
          fetch(`${API}/api/tmc/groups`),
          fetch(`${API}/api/tmc/categories`),
        ]);
        const [grpArr, catArr] = await Promise.all([grpRes.json(), catRes.json()]);
        if (cancelled) return;
        setGroups(Array.isArray(grpArr) ? grpArr : []);
        setCategories(Array.isArray(catArr) ? catArr : []);

        if (isNew) {
          // Новая карточка
          setItem({
            // id отсутствует — сервер создаст новую запись
            code: "",                 // код присвоит сервер, если пустой/некорректный
            name: "",
            unit: "",
            price: 0,
            supplier_link: "",
            group_id: null,
            category_id: null,
            comment: "",
            amortization_period: "",
            photo_url: "",
          });
        } else {
          // Редактирование существующей
          const tmcRes = await fetch(`${API}/api/tmc`);
          const tmcArr = await tmcRes.json();
          const found = (Array.isArray(tmcArr) ? tmcArr : []).find((x) => String(x.id) === String(id));
          if (!found) {
            setError("Позиция не найдена");
            setItem(null);
          } else {
            setItem({
              id: found.id,
              code: found.code ?? "",
              name: found.name ?? "",
              unit: found.unit ?? "",
              price: Number(found.price) || 0,
              supplier_link: found.supplier_link ?? "",
              group_id: found.group_id ?? found.groupId ?? null,
              category_id: found.category_id ?? found.categoryId ?? null,
              comment: found.comment ?? "",
              amortization_period: found.amortization_period ?? "",
              photo_url: found.photo_url ?? "",
            });
          }
        }
      } catch {
        setError("Ошибка загрузки данных ТМЦ");
        setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, isNew]);

  // Карта groupId -> name
  const groupNameById = useMemo(() => {
    const m = new Map();
    for (const g of groups) m.set(String(g.id), String(g.name || ""));
    return m;
  }, [groups]);

  // Логика: поле Амортизация недоступно для группы «Расходные материалы»
  const isConsumableGroup = useMemo(() => {
    if (!item?.group_id) return false;
    const name = String(groupNameById.get(String(item.group_id)) || "").toLowerCase();
    return name.includes("расходн");
  }, [item?.group_id, groupNameById]);

  // Если выбрана «Расходные материалы» — чистим амортизацию
  useEffect(() => {
    if (isConsumableGroup && item && item.amortization_period) {
      setItem((prev) => (prev ? { ...prev, amortization_period: "" } : prev));
    }
  }, [isConsumableGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  // Опции селектов
  const groupOptions = useMemo(
    () => groups.map((g) => ({ id: g.id, name: g.name })),
    [groups]
  );
  const categoryOptions = useMemo(() => {
    const gid = item?.group_id != null ? String(item.group_id) : null;
    const all = Array.isArray(categories) ? categories : [];
    return all
      .filter((c) => (gid ? String(c.groupId ?? c.group_id) === gid : true))
      .map((c) => ({ id: c.id, name: c.name, groupId: c.groupId ?? c.group_id }));
  }, [categories, item?.group_id]);

  const onField = (patch) => setItem((prev) => ({ ...prev, ...patch }));

  const goBack = () => {
    // Если открыто в новой вкладке (window.open) — пробуем закрыть
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch {}
    // Иначе — назад/домой
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  // Сохранение: сохранить -> закрыть вкладку и вернуться назад
  const save = async () => {
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        // Для нового не отправляем id, сервер создаст запись
        ...(isNew ? {} : { id: item.id }),
        code: item.code, // нередактируемое (для новых пусто — задаст сервер при необходимости)
        name: item.name,
        unit: item.unit,
        price: Number(item.price) || 0,
        supplier_link: item.supplier_link,
        group_id: item.group_id,
        category_id: item.category_id,
        comment: item.comment,
        amortization_period: isConsumableGroup ? "" : item.amortization_period,
        photo_url: item.photo_url,
      };
      const res = await fetch(`${API}/api/tmc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`bad status ${res.status}`);
      await res.json();
      goBack(); // Успешно — закрываем/возвращаемся
    } catch {
      setError("Не удалось сохранить изменения");
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  // «Отмена» — закрыть карточку без сохранения
  const onCancel = () => goBack();

  // Загрузка фото (если бэк поддерживает /upload)
  const uploadPhoto = async (file) => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (data?.ok && data?.path) onField({ photo_url: data.path });
      else alert("Не удалось загрузить файл");
    } catch {
      alert("Ошибка загрузки файла");
    }
  };

  if (loading) return <div style={{ padding: 16 }}>Загрузка…</div>;
  if (error)
    return (
      <div style={{ padding: 16, color: "#c00" }}>
        {error}
        <button onClick={onCancel} style={{ marginLeft: 8 }}>
          Отмена
        </button>
      </div>
    );
  if (!item) return null;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16 }}>
      <h2 style={{ margin: "0 0 16px" }}>{isNew ? "Новая карточка ТМЦ" : "Карточка ТМЦ"}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 10,
          alignItems: "center",
        }}
      >
        {/* ID — невидимое поле, не отображаем */}

        <label>Код</label>
        <input
          type="text"
          value={item.code}
          readOnly
          disabled
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#f5f5f5",
            color: "#666",
          }}
          title="Поле 'Код' не редактируется"
        />

        <label>Наименование</label>
        <textarea
          value={item.name}
          onChange={(e) => onField({ name: e.target.value })}
          rows={3}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />

        <label>Группа</label>
        <select
          value={item.group_id ?? ""}
          onChange={(e) =>
            onField({
              group_id: e.target.value ? Number(e.target.value) : null,
              category_id: null, // сбрасываем категорию при смене группы
            })
          }
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
            maxWidth: 320,
          }}
        >
          <option value="">— не указано —</option>
          {groupOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <label>Категория</label>
        <select
          value={item.category_id ?? ""}
          onChange={(e) =>
            onField({
              category_id: e.target.value ? Number(e.target.value) : null,
            })
          }
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
            maxWidth: 320,
          }}
        >
          <option value="">— не указано —</option>
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label>Ед. изм.</label>
        <input
          type="text"
          value={item.unit}
          onChange={(e) => onField({ unit: e.target.value })}
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
            maxWidth: 160,
          }}
        />

        <label>Цена (руб. с НДС)</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="text"
            value={item.price}
            onChange={(e) => onField({ price: parseNum(e.target.value) })}
            onBlur={(e) => onField({ price: parseNum(e.target.value) })}
            style={{
              padding: "6px 8px",
              border: "1px solid #ccc",
              borderRadius: 6,
              maxWidth: 220,
              textAlign: "right",
            }}
          />
          <span style={{ color: "#666" }}>
            Отформатировано: {fmtMoney(item.price)}
          </span>
        </div>

        <label>Амортизация (мес.)</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="number"
            value={item.amortization_period ?? ""}
            onChange={(e) =>
              onField({
                amortization_period: e.target.value
                  ? Math.max(0, Number(e.target.value))
                  : "",
              })
            }
            disabled={isConsumableGroup}
            style={{
              padding: "6px 8px",
              border: "1px solid #ccc",
              borderRadius: 6,
              maxWidth: 180,
              background: isConsumableGroup ? "#f5f5f5" : "#fff",
              color: isConsumableGroup ? "#777" : "#111",
            }}
            title={
              isConsumableGroup
                ? "Недоступно для группы «Расходные материалы»"
                : ""
            }
          />
          {isConsumableGroup && (
            <span style={{ color: "#9a9a9a", fontSize: 13 }}>
              Недоступно для группы «Расходные материалы»
            </span>
          )}
        </div>

        <label>Ссылка поставщика</label>
        <input
          type="text"
          value={item.supplier_link}
          onChange={(e) => onField({ supplier_link: e.target.value })}
          style={{
            padding: "6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />

        <label>Комментарий</label>
        <textarea
          value={item.comment}
          onChange={(e) => onField({ comment: e.target.value })}
          rows={3}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            borderRadius: 6,
          }}
        />

        <label>Фото</label>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {item.photo_url ? (
            <a
              href={`${API}${item.photo_url}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть фото"
            >
              <img
                src={`${API}${item.photo_url}`}
                alt="Фото"
                style={{ maxHeight: 64, borderRadius: 6, border: "1px solid #eee" }}
              />
            </a>
          ) : (
            <span style={{ color: "#888" }}>Нет файла</span>
          )}
          <label
            style={{
              padding: "6px 10px",
              border: "1px solid #c59bff",
              background: "#f5efff",
              color: "#5427b0",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Загрузить…
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => e.target.files && uploadPhoto(e.target.files[0])}
            />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "8px 16px",
            border: "1px solid #c59bff",
            background: "#f5efff",
            color: "#5427b0",
            borderRadius: 8,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 8,
            cursor: "pointer",
          }}
          title="Закрыть карточку без сохранения"
        >
          Отмена
        </button>
      </div>

      <div style={{ marginTop: 14, color: "#666" }}>
        После сохранения карточка закроется, и вы вернётесь на страницу, откуда её открыли.
      </div>
    </div>
  );
}