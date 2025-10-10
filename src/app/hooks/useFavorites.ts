import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { FavoriteEntry } from '@/types/page';

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/favorites', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('お気に入りの取得に失敗しました');
      }

      const data = await response.json();
      console.log('[DEBUG] Favorites API response:', data);
      
      // APIのレスポンス(shape: { id: string, quantity?: number, name: string, price: number, imgUrl: string }[])
      // をUIで使用しているFavoriteEntry型にマッピング
      const mapped: FavoriteEntry[] = (Array.isArray(data) ? data : []).map((item: any) => ({
        productId: Number(item.id),
        name: item.name,
        price: item.price,
        image: item.imgUrl || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      }));
      console.log('[DEBUG] Mapped favorites:', mapped);
      setFavorites(mapped);
    } catch (err) {
      console.error('Error fetching favorites:', err);
      setError(err instanceof Error ? err.message : 'お気に入りの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = async (productId: string | number, quantity: number = 1) => {
    if (!user) return false;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: productId.toString(), quantity }),
      });

      if (!response.ok) {
        throw new Error('お気に入りの追加に失敗しました');
      }

      // データを再取得
      await fetchFavorites();
      return true;
    } catch (err) {
      console.error('Error adding favorite:', err);
      return false;
    }
  };

  const removeFavorite = async (id: string) => {
    if (!user) return false;

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/favorites/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('お気に入りの削除に失敗しました');
      }

      // ローカル状態を更新
      setFavorites((prev) => prev.filter((item) => item.productId.toString() !== id));
      return true;
    } catch (err) {
      console.error('Error removing favorite:', err);
      return false;
    }
  };

  return { favorites, isLoading, error, addFavorite, removeFavorite, refetch: fetchFavorites };
}

