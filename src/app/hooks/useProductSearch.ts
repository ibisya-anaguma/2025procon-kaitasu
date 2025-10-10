"use client";

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface SearchProduct {
  id: string;
  name: string;
  price: number;
  imgUrl: string;
}

export interface SearchParams {
  q?: string | null;
  genre?: number | null;
  favorite?: boolean;
  limit?: number;
}

export function useProductSearch() {
  const { user } = useAuth();
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(async (params: SearchParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchBody = {
        ...params,
        uid: user?.uid
      };

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchBody),
      });

      if (!response.ok) {
        throw new Error('商品検索に失敗しました');
      }

      const data = await response.json();
      setProducts(data);
    } catch (err) {
      console.error('商品検索エラー:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  const clearSearch = useCallback(() => {
    setProducts([]);
    setError(null);
  }, []);

  return {
    products,
    isLoading,
    error,
    searchProducts,
    clearSearch,
  };
}
