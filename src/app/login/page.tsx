"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/lib/firebase";

import styles from "./login.module.css";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
  "auth/user-disabled": "このアカウントは無効化されています。管理者にお問い合わせください。",
  "auth/too-many-requests": "試行回数が多すぎます。しばらく時間を空けてからお試しください。",
  "auth/network-request-failed": "ネットワークエラーが発生しました。接続状況をご確認ください。"
};

const DEFAULT_ERROR_MESSAGE = "ログインに失敗しました。時間を置いてから再度お試しください。";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const redirectTarget = useMemo(() => {
    const nextParam = searchParams?.get("next");
    if (nextParam && nextParam.startsWith("/")) {
      return nextParam;
    }
    return "/";
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(redirectTarget);
      }
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [redirectTarget, router]);

  const getFriendlyMessage = (error: unknown) => {
    if (error instanceof FirebaseError) {
      return AUTH_ERROR_MESSAGES[error.code] ?? DEFAULT_ERROR_MESSAGE;
    }
    if (error instanceof Error) {
      return error.message || DEFAULT_ERROR_MESSAGE;
    }
    return DEFAULT_ERROR_MESSAGE;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();

    if (trimmedEmail.length === 0 || password.length === 0) {
      setErrorMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      router.replace(redirectTarget);
    } catch (error) {
      setErrorMessage(getFriendlyMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>認証状態を確認しています…</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image
            src="/images/logo_kaitasu.png"
            alt="かいたすのロゴ"
            width={56}
            height={56}
            className={styles.brandImage}
            priority
          />
          <h1>かいたすにログイン</h1>
        </div>

        <p className={styles.description}>
          ご登録いただいたメールアドレスとパスワードを入力してログインしてください。
        </p>

        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              メールアドレス
            </label>
            <div className={styles.inputBox}>
              <input
                id="email"
                className={styles.input}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              パスワード
            </label>
            <div className={styles.inputBox}>
              <input
                id="password"
                className={styles.input}
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
              <button
                type="button"
                className={styles.toggleButton}
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                aria-label={isPasswordVisible ? "パスワードを隠す" : "パスワードを表示する"}
              >
                {isPasswordVisible ? "隠す" : "表示"}
              </button>
            </div>
          </div>

          <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className={styles.supporting}>
          パスワードをお忘れの場合は、管理者までお問い合わせください。<br />
          <Link href="/" className={styles.link}>
            トップページに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
