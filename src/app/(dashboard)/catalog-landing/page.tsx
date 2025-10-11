"use client";

import { Fragment, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_CLASS, FILTER_BUTTON_TEXT_CLASS } from "@/components/screens/filterStyles";
import { useProductSearch } from "@/app/hooks/useProductSearch";
import { useAppContext } from "@/contexts/AppContext";
import { useUserInformation } from "@/app/hooks/useUserInformation";
import { useAuth } from "@/contexts/AuthContext";
import type { LandingCardContent, Screen } from "@/types/page";
import { cn } from "@/lib/utils";

// ジャンルボタンのインデックスとジャンル番号のマッピング
  const GENRE_MAPPING: Record<number, number> = {
    0: 11,   // 野菜
    1: 12,   // くだもの
    2: 13,   // 魚
    3: 14,   // 肉
    4: 15,   // お弁当・寿司・お惣菜・サラダ
    5: 16,   // ハム・ソーセージ・肉加工品
    6: 17,   // 卵・牛乳・乳製品
    7: 18,   // ヨーグルト・ドリンクヨーグルト
    8: 19,   // パン・シリアル・ジャム
    9: 50,   // おすすめ・特集
    10: 40,  // トップバリュ
    11: 41,  // カフェランテ
  };

  const GENRE_NAMES: Record<number, string> = {
    11: '野菜',
    12: 'くだもの',
    13: '魚',
    14: '肉',
    15: 'お弁当・寿司・お惣菜・サラダ',
    16: 'ハム・ソーセージ・肉加工品',
    17: '卵・牛乳・乳製品',
    18: 'ヨーグルト・ドリンクヨーグルト',
    19: 'パン・シリアル・ジャム',
    50: 'おすすめ・特集',
    40: 'トップバリュ',
    41: 'カフェランテ',
  };

function screenToPath(screen: Screen): string | null {
  switch (screen) {
    case "dashboard":
      return "/";
    case "catalog":
      return "/catalog";
    case "catalogLanding":
      return "/catalog-landing";
    case "cart":
      return "/cart";
    case "order":
      return "/order";
    case "history":
      return "/history";
    case "profile":
      return "/profile";
    case "subscription":
      return "/subscription";
    case "subscriptionAdd":
      return "/subscription/add";
    case "subscriptionList":
      return "/subscription/list";
    default:
      return null;
  }
}

export default function CatalogLandingPage() {
  const router = useRouter();
  const {
    landingPage,
    totalLandingPages,
    onLandingPageChange,
    currentLandingCards,
    onNavigate: setScreen
  } = useAppContext();
  const { searchProducts, isLoading } = useProductSearch();
  const { userInfo, updateUserInformation } = useUserInformation();
  const { user } = useAuth();
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [budget, setBudget] = useState('');
  const [isHealthFocused, setIsHealthFocused] = useState(false);

  // ユーザー情報から予算を読み込み
  useEffect(() => {
    if (userInfo?.monthlyBudget) {
      setBudget(userInfo.monthlyBudget.toString());
    }
  }, [userInfo]);

  // 予算が変更されたときにデータベースに保存
  const handleBudgetChange = async (value: string) => {
    setBudget(value);
    const budgetValue = parseInt(value, 10);
    if (!isNaN(budgetValue) && budgetValue > 0) {
      await updateUserInformation({ monthlyBudget: budgetValue });
    }
  };

  const handleCardToggle = (index: number) => {
    setSelectedCards((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleHealthFocusToggle = () => {
    setIsHealthFocused((prev) => !prev);
  };

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);

    if (screen === "catalog") {
      router.push("/catalog?fromLanding=1");
      return;
    }

    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  const handleSearch = async () => {
    console.log('[DEBUG landing] handleSearch called, isHealthFocused:', isHealthFocused);
    console.log('[DEBUG landing] selectedCards:', selectedCards);
    
    // 健康重視モードが選択されている場合、combos APIを呼び出す
    if (isHealthFocused) {
      try {
        // 選択されたジャンル番号を取得
        const selectedGenres = selectedCards.map(cardIndex => {
          const globalIndex = (landingPage - 1) * 12 + cardIndex;
          return GENRE_MAPPING[globalIndex];
        }).filter(genre => genre !== undefined);

        // 選択されたジャンルの詳細情報を出力
        console.log('[DEBUG landing] ========== 選択されたジャンル情報 ==========');
        console.log('[DEBUG landing] 選択数:', selectedGenres.length);
        selectedGenres.forEach((genreId, index) => {
          console.log(`[DEBUG landing] ${index + 1}. ジャンルID: ${genreId}, ジャンル名: ${GENRE_NAMES[genreId] || '不明'}`);
        });
        console.log('[DEBUG landing] ==========================================');
        console.log('[DEBUG landing] Selected genres:', selectedGenres);

        // 予算を取得
        const budgetValue = parseInt(budget, 10) || userInfo?.monthlyBudget || 50000;
        console.log('[DEBUG landing] Budget:', budgetValue);

        // combos APIを呼び出す
        if (user) {
          console.log('[DEBUG landing] Calling combos API...');
          const idToken = await user.getIdToken();
          const response = await fetch('/api/combos', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              budget: budgetValue,
              isHealthImportance: true,
              genres: selectedGenres,
            }),
          });

          console.log('[DEBUG landing] Combos API status:', response.status);

          if (response.ok) {
            const comboProducts = await response.json();
            console.log('[DEBUG landing] Combos API response:', comboProducts);
            
            // combos APIからの商品詳細を出力
            if (Array.isArray(comboProducts) && comboProducts.length > 0) {
              console.log('[DEBUG landing] ========== combos API 返却商品 ==========');
              console.log('[DEBUG landing] 商品数:', comboProducts.length);
              const genreCounts: Record<number, number> = {};
              comboProducts.forEach((product: any) => {
                const genreId = product.genre;
                genreCounts[genreId] = (genreCounts[genreId] || 0) + 1;
              });
              console.log('[DEBUG landing] ジャンル別商品数:');
              Object.entries(genreCounts).forEach(([genreId, count]) => {
                console.log(`[DEBUG landing]   - ジャンルID ${genreId} (${GENRE_NAMES[Number(genreId)] || '不明'}): ${count}個`);
              });
              console.log('[DEBUG landing] 合計金額:', comboProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0), '円');
              console.log('[DEBUG landing] ==========================================');
            }
            
            // 結果が空の場合は通常の検索にフォールバック
            if (!Array.isArray(comboProducts) || comboProducts.length === 0) {
              console.log('[DEBUG landing] No combo results, falling back to normal search');
              const fallbackGenres = selectedCards.map(cardIndex => {
                const globalIndex = (landingPage - 1) * 12 + cardIndex;
                return GENRE_MAPPING[globalIndex];
              }).filter(genre => genre !== undefined);

              console.log('[DEBUG landing] Calling searchProducts (fallback)...');
              await searchProducts({
                q: searchQuery.trim() || null,
                genres: fallbackGenres.length > 0 ? fallbackGenres : undefined,
                limit: 50
              });
            } else {
              // combos APIの結果を検索結果として設定
              console.log('[DEBUG landing] Setting combo results as search products');
              await searchProducts({
                q: null,
                genre: null,
                limit: 50,
                comboResults: comboProducts,
              });
              console.log('[DEBUG landing] searchProducts completed');
              // sessionStorageへの保存を確認
              const saved = sessionStorage.getItem('searchResults');
              console.log('[DEBUG landing] Verified sessionStorage:', saved ? JSON.parse(saved).length : 0, 'items');
            }
          } else {
            console.error('[DEBUG landing] Combos API failed with status:', response.status);
          }
        }
      } catch (error) {
        console.error('[DEBUG landing] Error calling combos API:', error);
        // エラーの場合は通常の検索にフォールバック
        const selectedGenres = selectedCards.map(cardIndex => {
          const globalIndex = (landingPage - 1) * 12 + cardIndex;
          return GENRE_MAPPING[globalIndex];
        }).filter(genre => genre !== undefined);
        
        await searchProducts({
          q: searchQuery.trim() || null,
          genres: selectedGenres.length > 0 ? selectedGenres : undefined,
          limit: 50
        });
      }
    } else {
      // 通常の検索
      console.log('[DEBUG landing] Normal search mode');
      const selectedGenres = selectedCards.map(cardIndex => {
        const globalIndex = (landingPage - 1) * 12 + cardIndex;
        return GENRE_MAPPING[globalIndex];
      }).filter(genre => genre !== undefined);

      // 選択されたジャンルの詳細情報を出力
      console.log('[DEBUG landing] ========== 選択されたジャンル情報 ==========');
      console.log('[DEBUG landing] 選択数:', selectedGenres.length);
      selectedGenres.forEach((genreId, index) => {
        console.log(`[DEBUG landing] ${index + 1}. ジャンルID: ${genreId}, ジャンル名: ${GENRE_NAMES[genreId] || '不明'}`);
      });
      console.log('[DEBUG landing] ==========================================');

      console.log('[DEBUG landing] Calling searchProducts (normal)...');
      console.log('[DEBUG landing] Search params:', {
        q: searchQuery.trim() || null,
        genres: selectedGenres,
      });

      await searchProducts({
        q: searchQuery.trim() || null,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
        limit: 50
      });
    }

    console.log('[DEBUG landing] Navigating to catalog...');
    handleNavigate("catalog");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center"
      data-oid="catalog-landing">

      <div className="w-[1000px]">
        <div className="relative mb-6" data-oid="catalog-landing-search">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fda900]"
            size={18}
            data-oid="catalog-landing-search-icon"
          />

          <Input
            placeholder="商品名で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-12 h-12 border-2 border-[#fda900] text-sm rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20"
            data-oid="catalog-landing-search-input"
          />
        </div>

        <div className="flex items-center gap-[25px] mb-6" data-oid="catalog-landing-filters">
          {/* 健康重視ボタン */}
          <Button
            variant="ghost"
            className={`border border-transparent p-0 w-[180px] min-w-[180px] h-[63px] flex items-center justify-center shrink-0 rounded-[20px] border-2 border-[#FDA900] px-6 ${
              isHealthFocused
                ? 'bg-[#FDA900] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)_inset]'
                : 'bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2]'
            }`}
            onClick={handleHealthFocusToggle}
            data-oid="health-focus-button">
            <span className={FILTER_BUTTON_TEXT_CLASS}>健康重視</span>
          </Button>
          
          {/* お気に入りページへボタン（テキストに合わせた幅） */}
          <Button
            variant="ghost"
            className="border border-transparent p-0 h-[63px] flex items-center justify-center rounded-[20px] border-2 border-[#FDA900] px-6 bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2]"
            onClick={() => handleNavigate("favoriteList")}
            data-oid="favorite-list-button">
            <span className={FILTER_BUTTON_TEXT_CLASS}>お気に入りページへ</span>
          </Button>
          
          <div className={`flex items-center justify-center gap-2 ml-4 ${FILTER_BUTTON_INACTIVE_CLASS}`} data-oid="catalog-landing-budget">
            <span
              className={FILTER_BUTTON_TEXT_CLASS}
              data-oid="catalog-landing-budget-label">
              予算:
            </span>
            <Input
              type="number"
              placeholder="0"
              value={budget}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="w-[120px] h-[40px] border-none text-center text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold bg-transparent focus:outline-none focus:ring-0"
              data-oid="catalog-landing-budget-input"
            />
            <span
              className={FILTER_BUTTON_TEXT_CLASS}
              data-oid="catalog-landing-budget-unit">
              円
            </span>
          </div>
        </div>

        <div
        className="relative mt-[23px] mb-[24px] w-[1000px]"
        data-oid="catalog-landing-card-background">
          <div
          className="pointer-events-none absolute top-0 left-0 z-0 h-[507px] w-[1000px] rounded-[20px] bg-[rgba(253,169,0,0.5)]"
          aria-hidden="true"
          />
          <div
          className="relative z-10 h-[507px] w-[1000px] overflow-hidden pt-[18px] flex flex-col items-center gap-[36px]"
          data-oid="catalog-landing-pagination-wrapper">
            <div
            className="flex items-center justify-center gap-[25px]"
            data-oid="catalog-landing-pagination">
              <span
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]"
              data-oid="catalog-landing-page-label">
                ページ
              </span>
              {Array.from({ length: totalLandingPages }, (_, i) => i + 1).map((num) => {
                const isActive = num === landingPage;
                return (
                  <Button
                    key={`landing-page-${num}`}
                    size="sm"
                    variant="ghost"
                    className={`border border-transparent p-0 flex w-[60px] h-[60px] px-[19px] py-[14px] flex-col justify-center items-center gap-[10px] shrink-0 rounded-[20px] text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px] ${
                      isActive
                        ? 'bg-[#FDA900] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)_inset]'
                        : 'bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]'
                    }`}
                    onClick={() => onLandingPageChange(num)}
                    data-oid={`catalog-landing-page-${num}`}>
                    {num}
                  </Button>
                );
              })}
            </div>
            <div
            className="grid grid-cols-4 gap-[45px]"
            data-oid="catalog-landing-card-grid">
              {currentLandingCards.map((card, index) => {
                const Icon = card.renderIcon;
                const isSelected = selectedCards.includes(index);

                const lines = card.title.split("\n");
                return (
                  <Button
                    key={`landing-card-${landingPage}-${index}`}
                    variant="ghost"
                    className={cn(
                    "relative flex h-[160px] w-[160px] flex-col items-center pt-[13px] border border-transparent p-0 transition-colors duration-200 hover:bg-[#fda900]/20",
                    index === 5 && "pt-[0px]",
                  )}
                    onClick={() => handleCardToggle(index)}
                    data-oid={`catalog-landing-card-${index}`}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="165"
                      height="165"
                      viewBox="0 0 165 165"
                      fill="none"
                      className="absolute inset-0"
                      data-oid={`catalog-landing-card-svg-${index}`}>
                      <g filter="url(#catalog-card-filter)">
                        <rect width="160" height="160" rx="13.3333" fill="#FDA900" />
                        <rect x="4.44434" y="4.44434" width="151.111" height="151.111" rx="10" fill="white" />
                      </g>
                      <defs>
                        <filter id="catalog-card-filter" x="0" y="0" width="164.5" height="164.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                          <feOffset dx="4.5" dy="4.5" />
                          <feComposite in2="hardAlpha" operator="out" />
                          <feColorMatrix type="matrix" values="0 0 0 0 0.895207 0 0 0 0 0.887003 0 0 0 0 0.887003 0 0 0 1 0" />
                          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3977_578" />
                          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3977_578" result="shape" />
                        </filter>
                      </defs>
                    </svg>
                    {isSelected && (
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center"
                        data-oid={`catalog-landing-card-selected-${index}`}>
                        <div className="w-[100px] h-[40px] shrink-0 rounded-[10px] bg-[#FDA900] flex items-center justify-center">
                          <span className="text-white font-['BIZ_UDPGothic'] text-[24px] font-bold leading-normal tracking-[1.248px]">
                            選択中
                          </span>
                        </div>
                      </div>
                    )}
                    <div
                      className="relative z-10 flex h-full w-full flex-col items-cente pt-[10px]"
                      data-oid={`catalog-landing-card-content-${index}`}>
                      <span
                      className="text-[#101010] font-['BIZ_UDPGothic'] text-[24px] font-bold leading-[24px] tracking-[1.248px]"
                      data-oid={`catalog-landing-card-title-${index}`}>
                        {lines.map((line, lineIndex) => (
                          <Fragment key={`line-${lineIndex}`}>
                            {line}
                            {lineIndex < lines.length - 1 && <br />}
                          </Fragment>
                        ))}
                      </span>
                      <div className={cn("flex w-full flex-1 items-center justify-center pt-[13px]",
                        ((index === 5)||(index === 6)||(index === 0)||(index === 1)) && "pt-[0px]"
                      )}>
                        {Icon ? (
                          <div
                          className="flex h-[100px] w-[100px] items-center justify-center"
                          data-oid={`catalog-landing-card-icon-${index}`}>
                            <Icon />
                          </div>
                        ) : (
                          <div
                          className="h-[100px] w-[100px] rounded-lg border border-dashed border-[#cfcfcf] bg-[#f5f5f5]"
                          data-oid={`catalog-landing-card-icon-${index}`}
                          />
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end" data-oid="catalog-landing-next-wrapper">
          {/* 組み合わせを生成ボタン（テキストに合わせた幅） */}
          <Button
            variant="ghost"
            className="border border-transparent p-0 rounded-[20px] border-[3px] border-[#FDA900] bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2] h-[60px] px-6"
            onClick={handleSearch}
            disabled={isLoading}
            data-oid="catalog-landing-next-button">
            <span className="text-black font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]">
              {isLoading ? '検索中...' : '組み合わせを生成'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
