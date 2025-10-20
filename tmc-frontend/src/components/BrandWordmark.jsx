import React, { useEffect, useMemo } from "react";

/*
  Inline-логотип (эмблема + «ИНСЕРВ»).
  Эмблема (гексагон + здания) всегда остаётся в своём оригинальном сиренево/белом виде.
  Текст "ИНСЕРВ" рендерится с fill="currentColor" и его цвет управляется через CSS:
    - в светлой теме — чёрный
    - в тёмной теме — белый
*/
export default function BrandWordmark({
  href = "#",
  title = "ИНСЕРВ — Инновационный Сервис будущего",
  position = "top-left", // "top-left" | "top-right" | "bottom-left" | "bottom-right"
  alt = "ИНСЕРВ",
}) {
  const posClass = useMemo(() => {
    const map = {
      "top-left": "wordmark-fixed--tl",
      "top-right": "wordmark-fixed--tr",
      "bottom-left": "wordmark-fixed--bl",
      "bottom-right": "wordmark-fixed--br",
    };
    return map[position] || map["top-left"];
  }, [position]);

  // Проставляем классы на <html> для safe padding
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("has-wordmark");
    const posMap = {
      "top-left": "wm-pos-tl",
      "top-right": "wm-pos-tr",
      "bottom-left": "wm-pos-bl",
      "bottom-right": "wm-pos-br",
    };
    const cls = posMap[position] || "wm-pos-tl";
    ["wm-pos-tl", "wm-pos-tr", "wm-pos-bl", "wm-pos-br"].forEach(c => html.classList.remove(c));
    html.classList.add(cls);
    return () => {
      html.classList.remove("has-wordmark", "wm-pos-tl", "wm-pos-tr", "wm-pos-bl", "wm-pos-br");
    };
  }, [position]);

  const isStub = !href || href === "#";
  const target = isStub ? undefined : "_self"; // навигация внутри SPA
  const rel = isStub ? undefined : "noopener noreferrer";

  return (
    <a
      className={`brand-wordmark wordmark-fixed ${posClass}`}
      href={href}
      target={target}
      rel={rel}
      aria-label={alt}
      title={title}
    >
      <svg
        className="wordmark-img"
        viewBox="0 0 220 56"
        role="img"
        aria-label={alt}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="insrvGradWM" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7b3ae9" />
            <stop offset="100%" stopColor="#ad76fb" />
          </linearGradient>
        </defs>

        {/* Эмблема — всегда градиент/белые элементы (не зависят от темы) */}
        <polygon points="28,4 48,16 48,40 28,52 8,40 8,16" fill="url(#insrvGradWM)" />
        <rect x="17" y="24" width="6" height="16" rx="1.3" fill="#FFFFFF" />
        <rect x="26" y="16" width="6" height="24" rx="1.3" fill="#FFFFFF" />
        <rect x="35" y="28" width="6" height="12" rx="1.3" fill="#FFFFFF" />
        <rect x="14" y="42" width="28" height="2" rx="1" fill="#FFFFFF" opacity="0.9" />

        {/* Текст — следит за CSS-цветом контейнера (currentColor) */}
        <text
          x="64"
          y="28"
          fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
          fontSize="24"
          fontWeight="900"
          letterSpacing=".6"
          dominantBaseline="middle"
          fill="currentColor"
        >
          ИНСЕРВ
        </text>
      </svg>
    </a>
  );
}