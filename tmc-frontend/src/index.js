import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/themes.css';

import App from './App';
import reportWebVitals from './reportWebVitals';

/*
  Инициализация темы (как было у вас ранее).
*/
const SYSTEM_DARK = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(themeName) {
  let name = themeName || localStorage.getItem('theme') || 'insrv';
  if (name === 'auto') {
    name = SYSTEM_DARK && SYSTEM_DARK.matches ? 'dark' : 'insrv';
  }
  document.documentElement.setAttribute('data-theme', name);
}
function setTheme(themeName) { localStorage.setItem('theme', themeName); applyTheme(themeName); }
function getTheme() { return localStorage.getItem('theme') || 'insrv'; }
applyTheme(getTheme());
if (SYSTEM_DARK) {
  const onSystemThemeChange = () => {
    if ((localStorage.getItem('theme') || 'insrv') === 'auto') applyTheme('auto');
  };
  if (SYSTEM_DARK.addEventListener) SYSTEM_DARK.addEventListener('change', onSystemThemeChange);
  else if (SYSTEM_DARK.addListener) SYSTEM_DARK.addListener(onSystemThemeChange);
}
window.addEventListener('storage', (e) => { if (e.key === 'theme') applyTheme(e.newValue || 'insrv'); });
window.Inserv = {
  setTheme, getTheme,
  setAdmin: (v = true) => { if (v) localStorage.setItem('isAdmin','1'); else localStorage.removeItem('isAdmin'); }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();