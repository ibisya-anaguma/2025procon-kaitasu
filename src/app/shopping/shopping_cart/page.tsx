import React from "react";
import styles from "./page.module.css";

export default function ShoppingCart() {
  return (
    <div>
      <header className={styles.header}>
        <h1>カート</h1>
      </header>
      <a href="/shopping" className={styles.button}>Back to Shopping</a>
    </div>
  );
}
