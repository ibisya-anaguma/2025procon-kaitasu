import React from "react";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div>
      <header className={styles.header}>
        <h1>かいたす</h1>
      </header>
      <nav>
        <ul className={styles.list}>
          <li>
            <a href="/shopping" className={styles.button}>買い物を始める</a>
          </li>
          <li>
            <a href="/notice" className={styles.button}>通知</a>
          </li>
          <li>
            <a href="/mypage" className={styles.button}>マイページ</a>
          </li>
          <li>
            <a href="/shortcut" className={styles.button}>ショートカット</a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
