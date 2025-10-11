"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface SearchProduct {
  id: string;
  name: string;
  price: number;
  imgUrl: string;
}

export interface SearchParams {
  q?: string | null;
  genre?: number | null;
  genres?: number[]; // 複数ジャンル対応
  favorite?: boolean;
  limit?: number;
  comboResults?: any; // combos APIからの結果を直接設定
}

export function useProductSearch() {
  const { user } = useAuth();
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComboResults, setIsComboResults] = useState(false); // combos APIから来たかどうか

  // sessionStorageから検索結果を復元
  useEffect(() => {
    const savedResults = sessionStorage.getItem('searchResults');
    const savedIsCombo = sessionStorage.getItem('isComboResults');
    
    if (savedResults) {
      try {
        const parsedResults = JSON.parse(savedResults);
        setProducts(parsedResults);
        setIsComboResults(savedIsCombo === 'true');
        console.log('[DEBUG useProductSearch] Restored from sessionStorage:', parsedResults.length, 'items');
      } catch (err) {
        console.error('[DEBUG useProductSearch] Failed to restore from sessionStorage:', err);
      }
    }
  }, []);

  const searchProducts = useCallback(async (params: SearchParams) => {
    setIsLoading(true);
    setError(null);

    try {
      // combos APIからの結果が渡された場合は直接設定
      if (params.comboResults) {
        console.log('[DEBUG useProductSearch] Processing combo results:', params.comboResults.length, 'items');
        // combos APIの結果をSearchProduct形式に変換
        const convertedProducts: SearchProduct[] = params.comboResults.map((item: any) => ({
          id: item.id || String(item.productId),
          name: item.name,
          price: item.price || item.priceTax || 0,
          imgUrl: item.imgUrl || item.url || item.image || '',
        }));
        console.log('[DEBUG useProductSearch] Converted products:', convertedProducts.length, 'items');
        setProducts(convertedProducts);
        setIsComboResults(true);
        // sessionStorageに保存
        sessionStorage.setItem('searchResults', JSON.stringify(convertedProducts));
        sessionStorage.setItem('isComboResults', 'true');
        console.log('[DEBUG useProductSearch] Saved to sessionStorage');
        setIsLoading(false);
        return;
      }

      setIsComboResults(false);

      const searchBody = {
        ...params,
        uid: user?.uid || 'test-user-123' // テスト用のUID
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
      // sessionStorageに保存
      sessionStorage.setItem('searchResults', JSON.stringify(data));
      sessionStorage.setItem('isComboResults', 'false');
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
    setIsComboResults(false);
    // sessionStorageもクリア
    sessionStorage.removeItem('searchResults');
    sessionStorage.removeItem('isComboResults');
  }, []);

  return {
    products,
    isLoading,
    error,
    isComboResults,
    searchProducts,
    clearSearch,
  };
}
