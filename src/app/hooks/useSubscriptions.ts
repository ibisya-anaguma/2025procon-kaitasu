"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionItem {
  id: string;
  name: string;
  price: number;
  imgUrl: string;
  quantity: number;
  frequency: number; // 配送頻度（日数）
}

export function useSubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // トークンを取得
  const getIdToken = async () => {
    if (!user) throw new Error('ユーザーが認証されていません');
    return await user.getIdToken();
  };

  // 定期購入一覧を取得
  const fetchSubscriptions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/subscriptions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('定期購入の取得に失敗しました');
      }

      const data = await response.json();
      setSubscriptions(data);
    } catch (err) {
      console.error('定期購入取得エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 定期購入に追加
  const addToSubscriptions = async (productId: string, quantity: number, frequency: number) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: productId, quantity, frequency }),
      });

      if (!response.ok) {
        throw new Error('定期購入への追加に失敗しました');
      }

      // 追加後、リストを再取得
      await fetchSubscriptions();
      return true;
    } catch (err) {
      console.error('定期購入追加エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 定期購入から削除
  const removeFromSubscriptions = async (productId: string) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch(`/api/subscriptions/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('定期購入からの削除に失敗しました');
      }

      // 削除後、リストを再取得
      await fetchSubscriptions();
      return true;
    } catch (err) {
      console.error('定期購入削除エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 定期購入を更新（数量や頻度の変更）
  const updateSubscription = async (productId: string, quantity?: number, frequency?: number) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const updateData: { quantity?: number; frequency?: number } = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (frequency !== undefined) updateData.frequency = frequency;

      const response = await fetch(`/api/subscriptions/${productId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('定期購入の更新に失敗しました');
      }

      // 更新後、リストを再取得
      await fetchSubscriptions();
      return true;
    } catch (err) {
      console.error('定期購入更新エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 定期購入に登録されているか確認
  const isSubscribed = (productId: string) => {
    return subscriptions.some(item => item.id === productId);
  };

  // ユーザーが変更されたときに定期購入を取得
  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    } else {
      setSubscriptions([]);
    }
  }, [user, fetchSubscriptions]);

  return {
    subscriptions,
    isLoading,
    error,
    addToSubscriptions,
    removeFromSubscriptions,
    updateSubscription,
    isSubscribed,
    fetchSubscriptions,
  };
}
