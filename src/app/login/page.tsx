"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/lib/firebase";

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
      <div
        className="flex min-h-screen items-center justify-center px-4 py-8"
        style={{
          background: "radial-gradient(circle at top left, #fde9bb 0%, #fdf7e9 45%, #ffffff 100%)"
        }}>
        <div className="text-center text-[#555555] text-sm">認証状態を確認しています…</div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-8"
      style={{
        background: "radial-gradient(circle at top left, #fde9bb 0%, #fdf7e9 45%, #ffffff 100%)"
      }}>
      <div className="w-full max-w-[420px] bg-white rounded-[20px] px-8 pt-9 pb-10 shadow-2xl border border-black/[0.06]">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Image
            src="/images/logo_kaitasu.png"
            alt="かいたすのロゴ"
            width={56}
            height={56}
            className="w-14 h-14 object-contain"
            priority
          />
          <h1
            className="text-[26px] font-bold tracking-[0.06em] text-[#101010]"
            style={{ fontFamily: "'BIZ UDPGothic', 'Noto Sans JP', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            かいたすにログイン
          </h1>
        </div>

        <p className="text-center text-[#4f4f4f] text-[15px] leading-relaxed mb-7">
          ご登録いただいたメールアドレスとパスワードを入力してログインしてください。
        </p>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-600/15 text-red-700 text-[13px] leading-relaxed">
            {errorMessage}
          </div>
        )}

        <form className="flex flex-col gap-[22px]" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#303030] tracking-wider" htmlFor="email">
              メールアドレス
            </label>
            <div className="relative">
              <input
                id="email"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.12] bg-[#fafafa] text-[15px] text-[#202020] transition-all duration-200 focus:outline-none focus:border-[#209fde] focus:shadow-[0_0_0_3px_rgba(32,159,222,0.18)] focus:bg-white"
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

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#303030] tracking-wider" htmlFor="password">
              パスワード
            </label>
            <div className="relative">
              <input
                id="password"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.12] bg-[#fafafa] text-[15px] text-[#202020] transition-all duration-200 focus:outline-none focus:border-[#209fde] focus:shadow-[0_0_0_3px_rgba(32,159,222,0.18)] focus:bg-white"
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
                className="absolute top-1/2 right-3 -translate-y-1/2 bg-transparent border-none text-[#209fde] text-xs font-semibold cursor-pointer px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(32,159,222,0.6)] focus-visible:rounded-lg"
                onClick={() => setIsPasswordVisible((prev) => !prev)}
                aria-label={isPasswordVisible ? "パスワードを隠す" : "パスワードを表示する"}
              >
                {isPasswordVisible ? "隠す" : "表示"}
              </button>
            </div>
          </div>

          <button
            className="w-full px-4 py-3.5 text-base font-bold text-white border-none rounded-[14px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(32,159,222,0.2)] active:translate-y-0 active:shadow-[0_6px_12px_rgba(32,159,222,0.18)] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
            style={{
              background: "linear-gradient(135deg, #209fde 0%, #2185bf 100%)"
            }}
            type="submit"
            disabled={isSubmitting}>
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-[18px] text-[13px] text-[#636363] text-center leading-relaxed">
          パスワードをお忘れの場合は、管理者までお問い合わせください。<br />
          <Link href="/" className="text-[#209fde] font-semibold no-underline hover:underline">
            トップページに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
