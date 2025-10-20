import React from "react";

/*
  Уголок-логотип:
  - Внутри плитки показываем КВАДРАТНУЮ иконку (эмблему), чтобы ничего не обрезалось.
  - Рядом всегда виден бейдж с надписью "ИНСЕРВ".
  - Слоган показываем по наведению/фокусу.
  - Позицию можно переключать через prop position: "top-left" | "bottom-right".
  - Если передан href="#", ссылка откроется в этом же окне; иначе — в новой вкладке.
*/
export default function BrandCorner({
  href = "#",
  logoSrc = "/brand/icon-insrv.svg", // квадратная иконка (эмблема)
  brandName = "ИНСЕРВ",
  tagline = "Инновационный Сервис будущего",
  title = "ИНСЕРВ — Инновационный Сервис будущего",
  position = "top-left", // "top-left" | "bottom-right"
  showLabel = true,
  showTagline = true,
}) {
  const posClass =
    position === "bottom-right" ? "corner-logo--bottom-right" : "corner-logo--top-left";

  // если ссылка «в никуда», не открываем новую вкладку
  const isStub = !href || href === "#";
  const target = isStub ? undefined : "_blank";
  const rel = isStub ? undefined : "noopener noreferrer";

  return (
    <a
      className={`corner-logo ${posClass}`}
      href={href}
      target={target}
      rel={rel}
      aria-label={brandName}
      title={title}
    >
      <div className="corner-logo__inner" role="img" aria-label={brandName}>
        {/* Картинка вписывается в квадрат с отступом, чтобы не обрезалось */}
        <img src={logoSrc} alt="" aria-hidden="true" />
      </div>

      {showLabel && <span className="corner-logo__label">{brandName}</span>}

      {showTagline && <span className="corner-logo__tooltip">{tagline}</span>}
    </a>
  );
}