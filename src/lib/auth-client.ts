"use client";

import { auth } from "@/lib/firebase";
import { getIdToken as firebaseGetIdToken } from "firebase/auth";

/**
 * Returns the currently signed-in user's ID token.
 * Throws if no user is signed in.
 */
export async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User is not signed in.");
  }

  return firebaseGetIdToken(user, forceRefresh);
}

/**
 * Convenience wrapper around fetch that automatically adds the Firebase ID token
 * as an Authorization header (Bearer token).
 */
export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  try {
    const token = await getIdToken();
    const headers = new Headers(init.headers);

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(input, {
      ...init,
      headers
    });
  } catch (error) {
    // Firebase認証が設定されていない、またはユーザーがサインインしていない場合
    // トークンなしでリクエストを試行（開発環境用）
    console.warn('[fetchWithAuth] Failed to get auth token, proceeding without auth:', error);
    return fetch(input, init);
  }
}
