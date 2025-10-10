"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface FavoriteItem {
  id: string;
  name: string;
  price: number;
  imgUrl: string;
  quantity?: number;
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // トークンを取得
  const getIdToken = async () => {
    if (!user) throw new Error('ユーザーが認証されていません');
    return await user.getIdToken();
  };

  // お気に入り一覧を取得
  const fetchFavorites = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch('/api/favorites', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('お気に入りの取得に失敗しました');
      }

      const data = await response.json();
      setFavorites(data);
    } catch (err) {
      console.error('お気に入り取得エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // お気に入りに追加
  const addToFavorites = async (productId: string, productInfo?: { name: string; price: number; imgUrl: string }) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const payload: Record<string, unknown> = { id: productId, quantity: 1 };
      
      // 商品情報が提供されている場合は一緒に保存
      if (productInfo) {
        payload.name = productInfo.name;
        payload.price = productInfo.price;
        payload.imgUrl = productInfo.imgUrl;
      }
      
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('お気に入りへの追加に失敗しました');
      }

      // 追加後、リストを再取得
      await fetchFavorites();
      return true;
    } catch (err) {
      console.error('お気に入り追加エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // お気に入りから削除
  const removeFromFavorites = async (productId: string) => {
    if (!user) return false;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch(`/api/favorites/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('お気に入りからの削除に失敗しました');
      }

      // 削除後、リストを再取得
      await fetchFavorites();
      return true;
    } catch (err) {
      console.error('お気に入り削除エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // お気に入りに登録されているか確認
  const isFavorite = (productId: string) => {
    return favorites.some(item => item.id === productId);
  };

  // ユーザーが変更されたときにお気に入りを取得
  useEffect(() => {
    if (user) {
      fetchFavorites();
    } else {
      setFavorites([]);
    }
  }, [user, fetchFavorites]);

  return {
    favorites,
    isLoading,
    error,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    fetchFavorites,
  };
}
