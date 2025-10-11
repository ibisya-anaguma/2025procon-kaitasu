"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarCatalogIcon, SidebarHistoryIcon, SidebarProfileIcon, SidebarSubscriptionIcon } from "@/components/icons/sidebar-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { fetchWithAuth } from "@/lib/auth-client";

type RecommendedProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
};

type BudgetSummary = {
    budget: number;
    remainingAmount: number;
    usageRate: number; // 0-100
};

export default function DashboardPage() {
  const router = useRouter();
  const { monthlyBudget } = useAppContext();
  const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [isLoadingBudget, setIsLoadingBudget] = useState<boolean>(false);

  // おすすめ商品を取得
  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const response = await fetch('/api/recommendations');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setRecommendedProducts(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };

    fetchRecommendation();
  }, []);

  // 予算サマリーを取得
  useEffect(() => {
      const fetchBudgetSummary = async () => {
          setIsLoadingBudget(true);
          try {
              const res = await fetchWithAuth('/api/budget-summary');
              if (!res.ok) {
                  console.warn('[dashboard] budget-summary fetch failed', res.status);
                  return;
              }
              const data: BudgetSummary = await res.json();
              setBudgetSummary(data);
          } catch (e) {
              console.error('[dashboard] budget-summary fetch error', e);
          } finally {
              setIsLoadingBudget(false);
          }
      };
      fetchBudgetSummary();
  }, []);

  // 前の商品に移動
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : recommendedProducts.length - 1));
  };

  // 次の商品に移動
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < recommendedProducts.length - 1 ? prev + 1 : 0));
  };

  const recommendedProduct = recommendedProducts[currentIndex] || null;

  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center" data-oid="ysuosjy">
      <div className="mx-auto w-[903px] space-y-4" data-oid=":xr07ip">
        {/* Notification Card */}
        <Card
          className="w-[903px] p-4 rounded-[14.469px] border-[5px] border-[#FDA900] bg-white"
          data-oid="2bp9lo4">
          <h3 className="text-center font-medium mb-3 text-sm" data-oid="aek175l">
            おすすめ
          </h3>
          {recommendedProduct ? (
            <div className="flex items-center justify-center gap-4">
              {/* 左矢印 */}
              <button
                onClick={handlePrevious}
                className="flex items-center justify-center w-12 h-12 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="前のおすすめ商品">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FDA900"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              {/* 商品表示エリア */}
              <div 
                className="flex items-center"
                style={{
                  width: '690px',
                  height: '109px',
                  flexShrink: 0
                }}>
                <img
                  src={recommendedProduct.image || "/placeholder.svg"}
                  alt={recommendedProduct.name}
                  style={{
                    width: '164.548px',
                    height: '109px',
                    flexShrink: 0,
                    aspectRatio: '164.55/109.00',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
                <div 
                  style={{
                    marginLeft: '20px',
                    flex: 1,
                    color: 'var(--, #101010)',
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: '24px',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    lineHeight: 'normal',
                    letterSpacing: '1.248px'
                  }}>
                  {recommendedProduct.name}
                </div>
                <div
                  style={{
                    marginLeft: 'auto',
                    color: 'var(--, #101010)',
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: '24px',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    lineHeight: 'normal',
                    letterSpacing: '1.248px'
                  }}>
                  ¥{recommendedProduct.price.toLocaleString('ja-JP')}
                </div>
              </div>

              {/* 右矢印 */}
              <button
                onClick={handleNext}
                className="flex items-center justify-center w-12 h-12 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="次のおすすめ商品">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FDA900"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          ) : (
            <div className="h-12 bg-[#adadad] rounded animate-pulse" data-oid="v_esgva"></div>
          )}
        </Card>

        {/* Budget Card */}
        <Card
          className="w-[903px] h-[230px] p-4 gap-[9px] rounded-[14.469px] border-[5px] border-[#FDA900] bg-white"
          data-oid="t2fyzfc">
          <div className="flex justify-between items-smart mt-[7px] mb-2" data-oid=":be0a2k">
            <span className="text-[30px] font-medium" data-oid=":6v2jl-">
              今月の予算 ▶
            </span>
            <div className="flex items-baseline gap-2 mt-[29px] mr-[81px] self-end" data-oid="qq2w-88">
              <span className="font-bold text-[20px]">残り</span>
              <span className="font-bold text-[36px] leading-none">
                {(() => {
                    const value = budgetSummary?.remainingAmount ?? monthlyBudget ?? 0;
                    return `¥${Number(value).toLocaleString('ja-JP')}`;
                })()}
              </span>
            </div>
          </div>
          <div className="flex w-[703px] justify-between mb-[7px] mt-[9px]" data-oid="h3m4f7m">
            <div className="text-[20px] text-[#adadad]" data-oid="woecoz3">
              {(() => {
                  if (!budgetSummary) return '¥-';
                  const spent = Math.max(0, (budgetSummary.budget || 0) - (budgetSummary.remainingAmount || 0));
                  return `¥${spent.toLocaleString('ja-JP')}`;
              })()}
            </div>
            <div className="flex" data-oid="h3m4f7m">
              <div className="text-[20px] text-right text-[#209fde]" data-oid="6x91r4a">
                使用率:
              </div>
              <div className="text-[20px] text-right text-[#101010]" data-oid="6x91r4a">
                {budgetSummary ? `${budgetSummary.usageRate}%` : (isLoadingBudget ? '...' : '-%')}
              </div>
            </div>
          </div>
          <div className="w-[744px] bg-[#adadad] rounded-full h-[34px] mb-1 mx-auto flex justify-end overflow-hidden" data-oid="pk6di4e">
            <div
                className="bg-[#209fde] h-[34px] rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, budgetSummary?.usageRate ?? 0))}%` }}
                data-oid="5_0shjj"
            ></div>
          </div>
        </Card>

        <div className="mx-auto flex justify-center gap-[61px] w-[903px]" data-oid="ta8f1it">
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative shadow-[4.5px_4.5px_0_#E4E2E2]"
            onClick={() => router.push("/catalog")}
            data-oid="6g1e2.x">
            <div className="flex h-[145px] flex-col items-center justify-between">
              <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal" data-oid="1417ieu">
                買い出し
              </span>
              <div className="flex w-full justify-center">
                <div className="w-[126px] h-[126px]">
                  <SidebarCatalogIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative shadow-[4.5px_4.5px_0_#E4E2E2]"
            onClick={() => router.push("/subscription")}
            data-oid="eljule7">
            <div className="flex h-[145px] flex-col items-center justify-between">
              <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal" data-oid="_8lynit">
                定期購入の確認
              </span>
              <div className="flex w-full justify-center">
                <div className="w-[110px] h-[110px] p-[10px]">
                  <SidebarSubscriptionIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative shadow-[4.5px_4.5px_0_#E4E2E2]"
            onClick={() => router.push("/history")}
            data-oid="vhz4ae4">
            <div className="flex h-[145px] flex-col items-center justify-between">
              <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal" data-oid="pu-k0wb">
                購入履歴
              </span>
              <div className="flex w-full justify-center">
                <div className="w-[91px] h-[91px]">
                  <SidebarHistoryIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative shadow-[4.5px_4.5px_0_#E4E2E2]"
            onClick={() => router.push("/profile")}
            data-oid="oodndhw">
            <div className="flex h-[145px] flex-col items-center justify-between">
              <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal" data-oid="5s21wmk">
                マイページ
              </span>
              <div className="flex w-full justify-center">
                <div className="w-[65.386px] h-[84.068px] shrink-0">
                  <SidebarProfileIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}
