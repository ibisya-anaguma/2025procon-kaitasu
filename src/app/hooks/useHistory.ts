import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { HistoryEntry } from '@/types/page';

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const idToken = await user.getIdToken();
        const response = await fetch('/api/history', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('History API error:', errorData);
          throw new Error('購入履歴の取得に失敗しました');
        }

        const data = await response.json();
        setHistory(data.userInformation || []);
      } catch (err) {
        console.error('Error fetching history:', err);
        setError(err instanceof Error ? err.message : '購入履歴の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  return { history, isLoading, error };
}

