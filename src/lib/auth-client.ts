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
  const token = await getIdToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
}
