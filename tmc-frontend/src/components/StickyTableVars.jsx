import { useEffect, useRef } from "react";

/*
  Проставляет CSS‑переменные на контейнер:
  --th-row-1 — фактическая высота первой строки thead (у вас заголовки+инпуты в одном <tr>)
  --th-row-2 — если будет второй <tr> в thead (сейчас 0)
  --table-sticky-top — отступ сверху под закреплённую панель страницы
*/
export default function StickyTableVars({
  containerSelector = ".js-sticky-scope",
  tableSelector = "table",
  topOffset = 48, // высота вашей верхней панели "Справочник ТМЦ"
  secondHeadRow = false,
}) {
  const rafRef = useRef(0);

  useEffect(() => {
    const scope = document.querySelector(containerSelector);
    const table = scope?.querySelector(tableSelector);
    const headRow1 = table?.querySelector("thead tr:first-child");
    const headRow2 = secondHeadRow ? table?.querySelector("thead tr:nth-child(2)") : null;

    const apply = () => {
      const h1 = headRow1 ? headRow1.getBoundingClientRect().height : 0;
      const h2 = headRow2 ? headRow2.getBoundingClientRect().height : 0;

      if (scope) {
        scope.style.setProperty("--table-sticky-top", `${topOffset}px`);
        scope.style.setProperty("--th-row-1", `${Math.round(h1)}px`);
        scope.style.setProperty("--th-row-2", `${Math.round(h2)}px`);
      }
    };

    const schedule = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(apply);
    };

    // начальная установка
    schedule();

    // пересчитываем при ресайзе и смене масштаба
    window.addEventListener("resize", schedule);

    // наблюдаем за изменением размеров шапки (шрифты, полосы прокрутки и т.п.)
    const ro = new ResizeObserver(schedule);
    if (headRow1) ro.observe(headRow1);
    if (headRow2) ro.observe(headRow2);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [containerSelector, tableSelector, topOffset, secondHeadRow]);

  return null;
}