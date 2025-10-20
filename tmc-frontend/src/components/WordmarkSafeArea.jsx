import { useEffect } from "react";

/*
  Включает/выключает «защитный» отступ под лого только для текущего экрана.
  Пример: <WordmarkSafeArea side="left" /> на CardCalc — чтобы ничего не наезжало.
  В журналах НЕ используем — таблица будет на всю ширину.
*/
export default function WordmarkSafeArea({ side = "left", enable = true }) {
  useEffect(() => {
    const html = document.documentElement;
    const cls = side === "right" ? "wm-safe-right" : "wm-safe-left";
    if (enable) html.classList.add(cls);
    return () => html.classList.remove(cls);
  }, [side, enable]);
  return null;
}