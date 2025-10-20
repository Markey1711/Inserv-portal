// name=src/components/MainMenu/MenuButtons.js
import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import styles from "./MainMenu.module.css";

const items = [
  { id: "tmc", label: "Справочник ТМЦ", href: "/tmc" },
  { id: "cards", label: "Журнал карточек расчётов", href: "/card-calc" },
];

export default function MenuButtons({ controls, disabled, onFirstButtonRef }) {
  const navigate = useNavigate();

  const firstRefCb = useCallback(
    (node) => {
      if (node && onFirstButtonRef) onFirstButtonRef(node);
    },
    [onFirstButtonRef]
  );

  return (
    <div className={styles.buttons}>
      {items.map((it, i) => (
        <motion.div
          key={it.id}
          initial={{ opacity: 0, y: 18, scale: 0.95 }}
          variants={{
            show: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                duration: 0.36,
                ease: [0.34, 1.56, 0.64, 1],
                delay: i * 0.08
              },
            },
            instant: { opacity: 1, y: 0, scale: 1 },
          }}
          animate={controls}
        >
          <button
            type="button"
            className={styles.threedButton}
            tabIndex={disabled ? -1 : 0}
            ref={i === 0 ? firstRefCb : null}
            onClick={() => navigate(it.href)}
            aria-label={it.label}
          >
            <span>{it.label}</span>
          </button>
        </motion.div>
      ))}
    </div>
  );
}