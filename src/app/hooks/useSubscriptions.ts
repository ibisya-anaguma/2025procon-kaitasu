import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { SubscriptionEntry } from '@/types/page';

export function useSubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/subscriptions', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('定期購入の取得に失敗しました');
      }

      const data = await response.json();
      // APIのレスポンス(shape: { id: string, quantity?: number, frequency?: number, name: string, price: number, imgUrl: string }[])
      // をUIで使用しているSubscriptionEntry型にマッピング
      const mapped: SubscriptionEntry[] = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: Number(item.id),
        productId: Number(item.id),
        name: item.name,
        price: item.price,
        image: item.imgUrl || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        frequencyDays: typeof item.frequency === 'number' ? item.frequency : 30,
      }));
      setSubscriptions(mapped);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : '定期購入の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const addSubscription = async (productId: string | number, quantity: number = 1, frequency: number = 30) => {
    if (!user) return false;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: productId.toString(), quantity, frequency }),
      });

      if (!response.ok) {
        throw new Error('定期購入の追加に失敗しました');
      }

      // データを再取得
      await fetchSubscriptions();
      return true;
    } catch (err) {
      console.error('Error adding subscription:', err);
      return false;
    }
  };

  const removeSubscription = async (id: string) => {
    if (!user) return false;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('定期購入の削除に失敗しました');
      }

      // ローカル状態を更新
      setSubscriptions((prev) => prev.filter((item) => item.id.toString() !== id));
      return true;
    } catch (err) {
      console.error('Error removing subscription:', err);
      return false;
    }
  };

  return { subscriptions, isLoading, error, addSubscription, removeSubscription, refetch: fetchSubscriptions };
}

