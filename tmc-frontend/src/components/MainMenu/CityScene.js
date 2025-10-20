import React from "react";
import styles from "./MainMenu.module.css";

export default function CityScene() {
  return (
    <div className={styles.city}>
      <div className={`${styles.building} ${styles.b1}`} />
      <div className={`${styles.building} ${styles.b2}`} />
      <div className={`${styles.building} ${styles.b3}`} />
    </div>
  );
}