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
      <div className="flex min-h-screen items-center justify-center bg-[#FDA900]">
        <div className="text-center text-white text-lg">認証状態を確認しています…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FDA900]">

      {/* Left Side - Logo and Preview */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center px-16 py-12">
        <div className="flex flex-col gap-10 w-full max-w-[580px]">
          {/* Logo Card */}
          <div className="flex flex-col items-center justify-center gap-4">
            <Image 
              src="/images/logo_kaitasu.png" 
              alt="かいたすロゴ" 
              width={500}
              height={500}
              className="w-48 h-48 object-contain"
            />
          </div>

          {/* App Preview */}
          {/*   <div className="bg-gray-900 rounded-3xl p-5 w-full shadow-2xl"> */}
          {/*     <div className="bg-white rounded-2xl p-8 h-[420px] flex items-center justify-center"> */}
          {/*       <div className="text-gray-400 text-center"> */}
          {/*         <div className="text-5xl mb-3">📱</div> */}
          {/*         <div className="text-lg">アプリプレビュー</div> */}
          {/*       </div> */}
          {/*     </div> */}
          {/*   </div> */}
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-16 py-12">
        <div className="w-full max-w-[520px] bg-white rounded-[30px] px-14 py-14 shadow-2xl">
          <h1 className="text-5xl font-bold text-center text-[#101010] mb-12">
            ログイン
          </h1>

          {errorMessage && (
            <div className="mb-6 p-3 rounded-xl bg-red-600/15 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div>
              <label className="block text-base font-medium text-[#101010] mb-2" htmlFor="email">
                Emailアドレス
              </label>
              <input
                id="email"
                className="w-full px-5 py-3.5 rounded-lg border-2 border-gray-300 bg-white text-base text-[#101010] transition-colors focus:outline-none focus:border-[#209fde]"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="block text-base font-medium text-[#101010] mb-2" htmlFor="password">
                パスワード
              </label>
              <input
                id="password"
                className="w-full px-5 py-3.5 rounded-lg border-2 border-gray-300 bg-white text-base text-[#101010] transition-colors focus:outline-none focus:border-[#209fde]"
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              className="w-full bg-[#209fde] text-white text-lg font-bold py-4 rounded-full transition-all hover:bg-[#1a8bc4] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-8"
              type="submit"
              disabled={isSubmitting}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div className="my-8 border-t border-gray-300"></div>

          <div className="space-y-3">
            <p className="text-center text-gray-600 text-base font-medium mb-4">他の方法</p>
            
            <button
              className="w-full bg-white border-2 border-[#209fde] text-[#101010] text-base font-medium py-3.5 rounded-full transition-all hover:bg-gray-50 flex items-center justify-center gap-3"
              type="button">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Googleで登録
            </button>

            <button
              className="w-full bg-white border-2 border-[#209fde] text-[#101010] text-base font-medium py-3.5 rounded-full transition-all hover:bg-gray-50 flex items-center justify-center gap-3"
              type="button">
              <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebookで登録
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
