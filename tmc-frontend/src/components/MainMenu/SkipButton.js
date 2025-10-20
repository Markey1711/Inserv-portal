import React from "react";
import styles from "./MainMenu.module.css";

export default function SkipButton({ visible, onSkip }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className={styles.skipButton}
      onClick={onSkip}
      aria-label="Пропустить анимацию"
    >
      Пропустить
    </button>
  );
}