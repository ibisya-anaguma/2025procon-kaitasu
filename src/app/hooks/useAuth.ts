"use client";

import { useState, useEffect } from 'react';

// テスト用の認証フック
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // テスト用のユーザー情報を設定
    const testUser = {
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'テストユーザー'
    };
    
    // 模擬的な認証状態
    setTimeout(() => {
      setUser(testUser);
      setLoading(false);
    }, 1000);
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    // テスト用のサインイン
    setTimeout(() => {
      setUser({
        uid: 'test-user-123',
        email,
        displayName: 'テストユーザー'
      });
      setLoading(false);
    }, 1000);
  };

  const signOut = async () => {
    setUser(null);
  };

  const getIdToken = async () => {
    // テスト用のトークン
    return 'test-token-123';
  };

  return {
    user,
    loading,
    signIn,
    signOut,
    getIdToken
  };
}
