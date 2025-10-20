import { useEffect, useRef } from "react";

/**
 * Динамически добавляет отступ к tbody только когда thead «прилип»,
 * чтобы строки не уезжали под шапку и не было постоянного зазора.
 *
 * @param {React.RefObject<HTMLTableElement>} tableRef - ref на <table>
 * @param {number} topOffset - отступ сверху (высота закреплённой панели раздела), px
 */
export default function useStickyHeaderOffset(tableRef, topOffset = 0) {
  const rafRef = useRef(0);
  const headHeightRef = useRef(0);

  const measure = () => {
    const table = tableRef.current;
    if (!table) return;
    const headRow = table.querySelector("thead tr:first-child");
    if (!headRow) return;

    const h = Math.ceil(headRow.getBoundingClientRect().height);
    if (h && h !== headHeightRef.current) {
      headHeightRef.current = h;
    }
  };

  const apply = () => {
    const table = tableRef.current;
    if (!table) return;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    if (!thead || !tbody) return;

    const rect = thead.getBoundingClientRect();
    const stuck = rect.top <= topOffset;

    // Отступ только когда шапка «прилипла»
    tbody.style.paddingTop = stuck ? `${headHeightRef.current}px` : "0px";
  };

  const schedule = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      measure();
      apply();
    });
  };

  useEffect(() => {
    schedule();

    // Обновляем при скролле/ресайзе
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // Следим за изменениями размеров (шрифты, строки фильтров и т.п.)
    const ro = new ResizeObserver(schedule);
    const table = tableRef.current;
    if (table) {
      ro.observe(table);
      const headRow = table.querySelector("thead tr:first-child");
      if (headRow) ro.observe(headRow);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
    };
  }, [tableRef, topOffset]);
}