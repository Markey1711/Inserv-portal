import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import LogoFlight from "./LogoFlight";
import MenuHeadline from "./MenuHeadline";
import MenuButtons from "./MenuButtons";
import CityScene from "./CityScene";
import styles from "./MainMenu.module.css";
import SkipButton from "./SkipButton";
import { playTouchAudio } from "./audio";

export default function MainMenuOverlay({ open, onClose, routeMode, overrides }) {
  const overlayCtrl = useAnimation();
  const headlineCtrl = useAnimation();
  const buttonsCtrl = useAnimation();

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // Всегда проигрываем заставку при каждом открытии, кроме случаев: skip или prefers-reduced-motion
  const skipDirect = (overrides?.skipParam) || reducedMotion;

  const [firstBtnEl, setFirstBtnEl] = useState(null);
  const [logoVisible, setLogoVisible] = useState(!skipDirect);
  const [wordmarkVisible, setWordmarkVisible] = useState(skipDirect);
  const [flash, setFlash] = useState({ show: false, x: 0, y: 0 });

  // Плавное появление подложки
  useEffect(() => {
    if (!open) return;
    overlayCtrl.start({ opacity: 1, transition: { duration: 0.28 } });
  }, [open, overlayCtrl]);

  // Начальные/финальные состояния
  useEffect(() => {
    if (!open) return;
    if (skipDirect) {
      setLogoVisible(false);
      setWordmarkVisible(true);
      headlineCtrl.set("activatedStatic");
      buttonsCtrl.set("instant");
    } else {
      setLogoVisible(true);
      setWordmarkVisible(false);
      headlineCtrl.set({ opacity: 0, y: -12 });
      buttonsCtrl.set({ opacity: 0, y: 18 });
    }
  }, [open, skipDirect, headlineCtrl, buttonsCtrl]);

  const onLogoTouch = () => {
    if (!overrides?.silent && !reducedMotion) {
      try { playTouchAudio(); } catch {}
    }

    if (firstBtnEl) {
      const r = firstBtnEl.getBoundingClientRect();
      setFlash({ show: true, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }

    // Скрываем летящий логотип и сразу показываем вордмарк
    setLogoVisible(false);
    setWordmarkVisible(true);

    // Показ заголовка и кнопок ВМЕСТЕ с исчезновением логотипа
    headlineCtrl.start("activate");
    buttonsCtrl.start("show");

    // Спрячем вспышку через анимацию (CSS)
    setTimeout(() => setFlash(f => ({ ...f, show: false })), 420);
  };

  // Esc — закрыть
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose && onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mainMenuHeadline"
          className={routeMode ? styles.routeContainer : styles.overlay}
          initial={{ opacity: 0 }}
          animate={overlayCtrl}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          <CityScene />

          {/* Летящий логотип */}
          <LogoFlight
            start={!skipDirect}
            targetEl={firstBtnEl}
            onTouch={onLogoTouch}
            reducedMotion={skipDirect}
            visible={logoVisible}
          />

          {/* Вордмарк (лого + надпись) слева вверху — появляется после исчезновения летящего лого */}
          {wordmarkVisible && (
            <div className={styles.wordmarkTL} aria-label="Инсерв">
              <img src="/brand/inserv-logo.svg" alt="" aria-hidden />
              <span className={styles.wordmarkText}>ИНСЕРВ</span>
            </div>
          )}

          <MenuHeadline controls={headlineCtrl} />

          <MenuButtons
            controls={buttonsCtrl}
            disabled={false}
            onFirstButtonRef={setFirstBtnEl}
          />

          {/* Skip только когда реально летит логотип */}
          {!skipDirect && logoVisible && (
            <SkipButton
              visible
              onSkip={() => {
                setLogoVisible(false);
                setWordmarkVisible(true);
                headlineCtrl.set("activatedStatic");
                buttonsCtrl.set("instant");
              }}
            />
          )}

          {/* Вспышка — SVG звезда */}
          {flash.show && (
            <div className={styles.flashWrap} style={{ left: flash.x + "px", top: flash.y + "px" }} aria-hidden>
              <svg className={styles.flashStar} viewBox="0 0 64 64" width="64" height="64" aria-hidden>
                <path fill="#FFF6D6" stroke="#FFD15A" strokeWidth="1.6"
                      d="M32 2 L38 24 L60 24 L42 36 L48 58 L32 44 L16 58 L22 36 L4 24 L26 24 Z" />
              </svg>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}