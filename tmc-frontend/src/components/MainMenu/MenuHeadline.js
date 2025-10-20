import React from "react";
import { motion } from "framer-motion";
import styles from "./MainMenu.module.css";

export default function MenuHeadline({ controls }) {
  return (
    <motion.h1
      id="mainMenuHeadline"
      className={styles.headline}
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.4, duration: 0.6 } }}
      variants={{
        activate: {
          filter: ["brightness(1)", "brightness(1.4)", "brightness(1)"],
          transition: { duration: 0.6 },
        },
        activatedStatic: {},
      }}
      animate={controls}
    >
      Главное меню
      <span className={styles.shimmer} />
    </motion.h1>
  );
}