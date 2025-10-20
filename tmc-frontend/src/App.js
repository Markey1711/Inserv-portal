import React from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";

import MainMenuPage from "./pages/MainMenuPage";
import TmcPage from "./pages/TmcPage";
import CardCalc from "./Frontcalc/CardCalc";
import CalcJournal from "./Frontcalc/CalcJournal";
import TmcCard from "./Frontcalc/TmcCard";

import BrandWordmark from "./components/BrandWordmark";
import "./styles/brand-wordmark.css";
import "./styles/sticky-override.css";

/* Router-aware BrandWordmark: скрывает базовый логотип на корне ("/"),
   делает его кликабельным (переход на "/") на остальных страницах */
function RouterAwareBrandWordmark() {
  const location = useLocation();
  if (location.pathname === "/") return null;
  return (
    <Link to="/" aria-label="Перейти в главное меню" className="brand-link">
      <BrandWordmark href="/" position="top-left" />
    </Link>
  );
}

/* ThemeToggle — использует window.Inserv API */
function ThemeToggle({ theme, onChange }) {
  const cycle = () => {
    const order = ["insrv", "dark", "auto"];
    const next = order[(order.indexOf(theme) + 1) % order.length] || "insrv";
    try { window.Inserv?.setTheme?.(next); } catch {}
    onChange(next);
  };

  return (
    <button
      onClick={cycle}
      title={`Тема: ${theme}`}
      className="theme-toggle"
      aria-label="Переключатель темы"
    >
      {theme === "insrv" ? "Светлая" : theme === "dark" ? "Тёмная" : "Авто"}
    </button>
  );
}

/* Header — теперь полностью скрывается на корне ("/") чтобы не просвечивать под заставкой */
function Header({ theme, onThemeChange }) {
  const location = useLocation();
  const onRoot = location.pathname === "/";

  // Если мы на главном меню — не рендерим сам header вовсе
  if (onRoot) return null;

  const linkColor = theme === "dark" ? "#ffffff" : "#3a27c5";

  return (
    <header className={`app-header ${onRoot ? "root-page" : "inner-page"}`}>
      <div style={{ flex: "0 0 auto" }} aria-hidden>
        <RouterAwareBrandWordmark />
      </div>

      <nav style={{ flex: "1 1 auto", textAlign: "center" }}>
        <Link to="/tmc" style={{ margin: "0 12px", fontWeight: "bold", color: linkColor }}>
          Справочник ТМЦ
        </Link>
        <Link to="/card-calc" style={{ margin: "0 12px", fontWeight: "bold", color: linkColor }}>
          Журнал расчетных карточек
        </Link>
      </nav>

      <div style={{ flex: "0 0 auto", marginLeft: "auto" }}>
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}

export default function App() {
  const [theme, setTheme] = React.useState(() => {
    try { return window.Inserv?.getTheme?.() || "insrv"; } catch { return "insrv"; }
  });

  React.useEffect(() => {
    const onStorage = (e) => { if (e.key === "theme") setTheme(e.newValue || "insrv"); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleThemeChange = (next) => setTheme(next);

  return (
    <BrowserRouter>
      <Header theme={theme} onThemeChange={handleThemeChange} />

      <main className="app-main" role="main">
        <Routes>
          <Route path="/" element={<MainMenuPage />} />
          <Route path="/tmc" element={<TmcPage />} />
          <Route path="/card-calc" element={<CalcJournal />} />
          <Route path="/card-calc/new" element={<CardCalc isNew={true} />} />
          <Route path="/card-calc/:id" element={<CardCalc />} />
          <Route path="/tmc/new" element={<TmcCard />} />
          <Route path="/tmc/:id" element={<TmcCard />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}