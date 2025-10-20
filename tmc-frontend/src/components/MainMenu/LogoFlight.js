// updated LogoFlight to aim at center of first button and to respect the new visual sizing
import React, { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import styles from "./MainMenu.module.css";

/*
  Летит из верхнего левого угла в центр первой кнопки (точно).
  Стартовый размер крупный (scale 3), в конце уменьшается до 0.6.
  Если цель не готова — летит к центру экрана.
*/
export default function LogoFlight({
  start = true,
  targetEl,
  onTouch,
  reducedMotion,
  visible = true,
}) {
  const ctrl = useAnimation();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!start) return;
    if (reducedMotion) {
      onTouch && onTouch();
      return;
    }
    const run = async () => {
      const el = targetEl;
      const wrapRect = wrapRef.current?.getBoundingClientRect?.() || { width: 88, height: 88 };
      const logoW = wrapRect.width || 88;
      const logoH = wrapRect.height || 88;

      const startCenterX = 36 + logoW / 2;
      const startCenterY = 36 + logoH / 2;

      // if target missing, aim to center of viewport
      if (!el) {
        const targetCenterX = window.innerWidth / 2;
        const targetCenterY = window.innerHeight / 2;
        const dx = targetCenterX - startCenterX;
        const dy = targetCenterY - startCenterY;
        const cpX = startCenterX + dx * 0.45;
        const cpY = Math.max(120, Math.min(startCenterY, targetCenterY) - Math.abs(dx) * 0.08);

        await ctrl.start({
          translateX: [0, cpX - startCenterX, dx],
          translateY: [0, cpY - startCenterY, dy],
          scale: [3, 1.1, 0.6],
          transition: { duration: 1.6, ease: "easeInOut", times: [0, 0.56, 1] },
        });
        onTouch && onTouch();
        return;
      }

      const btnRect = el.getBoundingClientRect();
      const targetCenterX = btnRect.left + btnRect.width / 2;
      const targetCenterY = btnRect.top + btnRect.height / 2;

      const dx = targetCenterX - startCenterX;
      const dy = targetCenterY - startCenterY;

      const cpX = startCenterX + dx * 0.45;
      // keep arc moderate
      const cpY = Math.max(120, Math.min(startCenterY, targetCenterY) - Math.abs(dx) * 0.08);

      const cpDx = cpX - startCenterX;
      const cpDy = cpY - startCenterY;

      await ctrl.start({
        translateX: [0, cpDx, dx],
        translateY: [0, cpDy, dy],
        scale: [3, 1.1, 0.6],
        transition: {
          duration: 1.6,
          ease: "easeInOut",
          times: [0, 0.58, 1],
        },
      });

      onTouch && onTouch();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, targetEl, reducedMotion]);

  return (
    <motion.div
      ref={wrapRef}
      className={styles.logo}
      style={{ display: visible ? "block" : "none" }}
      initial={{ translateX: 0, translateY: 0, opacity: 1 }}
      animate={ctrl}
    >
      <img src="/brand/inserv-logo.svg" alt="Инсерв" draggable={false} />
    </motion.div>
  );
}