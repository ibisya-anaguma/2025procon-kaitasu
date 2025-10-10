"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useHistory } from "@/app/hooks/useHistory";
import { useAppContext } from "@/contexts/AppContext";
import type { HistoryEntry } from "@/types/page";

export default function HistoryPage() {
  const { history, isLoading, error } = useHistory();
  const { onAddFavoriteEntry } = useAppContext();

  const handleAddToFavorites = (item: HistoryEntry) => {
    onAddFavoriteEntry({
      id: item.productId,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity: item.quantity,
      description: ''
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return { year, month, day };
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center">
        <div className="text-[24px] font-['BIZ_UDPGothic']">読み込み中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center">
        <div className="text-[24px] font-['BIZ_UDPGothic'] text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex justify-center" data-oid="n3s1kmy">
      <div className="w-[900px]" data-oid="me-dwvn">
        <h2 className="text-[36px] font-bold mb-6 text-[#101010] font-['BIZ_UDPGothic']" data-oid="x::kret">
          購入履歴
        </h2>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[20px] font-['BIZ_UDPGothic'] text-gray-500">購入履歴がありません</p>
          </div>
        ) : (
          <div className="space-y-4" data-oid="4c1ea9l">
            {history.map((item) => {
              const { year, month, day } = formatDate(item.purchasedAt);
              return (
                <Card
                  key={item.id}
                  className="p-6 bg-white border-[3px] border-[#FDA900] rounded-[14.469px] shadow-sm"
                  data-oid="giqzpfm">

                  <div className="flex items-center gap-6" data-oid="jlp_i_y">
                    <div className="text-base font-['BIZ_UDPGothic'] text-[#101010] min-w-[100px]" data-oid="jflct6b">
                      <div className="font-bold text-[20px]" data-oid="mtapic7">{year}年</div>
                      <div className="font-medium text-[18px]" data-oid="op7puzz">{month}月{day}日</div>
                    </div>
                    <img
                      src={item.image || "/images/food-item.jpg"}
                      alt={item.name}
                      className="w-[120px] h-[120px] object-cover rounded-lg"
                      data-oid="wur3l8e" />

                    <div className="flex-1" data-oid="kmj3p4f">
                      <h4 className="text-[24px] font-bold mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="uwyj:6y">
                        {item.name}
                      </h4>
                      <Badge
                        variant="secondary"
                        className="text-base px-4 py-2 border-2 border-[#209fde] bg-white text-[#209fde] rounded-lg font-['BIZ_UDPGothic'] font-bold hover:bg-[#209fde] hover:text-white cursor-pointer transition-colors"
                        onClick={() => handleAddToFavorites(item)}
                        data-oid="_ne7wd0">

                        お気に入りに追加
                      </Badge>
                    </div>
                    <div className="text-right min-w-[120px]" data-oid="t6t6kx-">
                      <div className="text-[20px] mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="9d22m2g">
                        {item.quantity}コ
                      </div>
                      <div className="font-bold text-[28px] text-[#101010] font-['BIZ_UDPGothic']" data-oid="8yen38r">
                        ¥{item.price.toLocaleString('ja-JP')}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
