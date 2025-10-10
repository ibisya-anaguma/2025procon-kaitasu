"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserInformation, UserInformationUpdate, UserHealthSettings } from '@/types/user';

export function useUserInformation() {
  const { user, loading } = useAuth();
  const [userInfo, setUserInfo] = useState<UserInformation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // トークンを取得
  const getIdToken = async () => {
    if (!user) throw new Error('ユーザーが認証されていません');
    return await user.getIdToken();
  };

  // ユーザー情報を取得
  const fetchUserInformation = async () => {
    if (!user) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/user-information', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }

      const data = await response.json();
      
      // AuthContextのdisplayNameと同期
      const syncedData = {
        ...data,
        name: user.displayName || data.name || 'ユーザー',
        email: user.email || data.email || '',
      };
      
      setUserInfo(syncedData);
    } catch (err) {
      console.error('ユーザー情報取得エラー:', err);
      setErrorMessage(err instanceof Error ? err.message : 'エラーが発生しました');
      
      // エラー時もAuthContextから基本情報を設定
      setUserInfo({
        uid: user.uid,
        name: user.displayName || 'ユーザー',
        email: user.email || '',
        monthlyBudget: 50000,
        resetDay: 1,
      } as UserInformation);
    } finally {
      setIsLoading(false);
    }
  };

  // ユーザー情報を更新
  const updateUserInformation = async (updates: UserInformationUpdate) => {
    if (!user) return false;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/user-information', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ユーザー情報の更新に失敗しました');
      }

      // 更新後、ユーザー情報を再取得
      await fetchUserInformation();
      return true;
    } catch (err) {
      console.error('ユーザー情報更新エラー:', err);
      setErrorMessage(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 健康設定を更新
  const updateHealthSettings = async (healthSettings: UserHealthSettings) => {
    if (!user) return false;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/user-information', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(healthSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '健康設定の更新に失敗しました');
      }

      return true;
    } catch (err) {
      console.error('健康設定更新エラー:', err);
      setErrorMessage(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // ユーザーが変更されたときに情報を取得
  useEffect(() => {
    if (user && !loading) {
      fetchUserInformation();
    } else if (!user && !loading) {
      setUserInfo(null);
    }
  }, [user, loading]);

  return {
    user,
    userInfo,
    isLoading: isLoading || loading,
    error: errorMessage,
    fetchUserInformation,
    updateUserInformation,
    updateHealthSettings,
  };
}
