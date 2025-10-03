import React from "react";
import styles from "./page.module.css";

export default function Shopping() {
  return (
    <div>
      <header className={styles.header}>
        <h1>探す</h1>
      </header>
      <a href="/shopping/shopping_cart" className={styles.button}>
        カートに移動
      </a>
      <a href="/" className={styles.button}>
        ホームに戻る
      </a>
    </div>
  );
}
