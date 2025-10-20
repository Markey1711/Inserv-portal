import React from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontWeight: 600 }}>Тема:</span>
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        style={{ height: 32, borderRadius: 8 }}
      >
        <option value="insrv">Insrv (бренд)</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}