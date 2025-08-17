import React from "react";
import styles from "./page.module.css";

export default function Shortcut() {
  return (
    <div>
      <header className={styles.header}>
        <h1>ショートカット</h1>
      </header>
      <a href="/" className={styles.button}>ホームに戻る</a>
    </div>
  );
}
