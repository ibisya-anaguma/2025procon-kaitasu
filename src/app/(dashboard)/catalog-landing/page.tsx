"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_CLASS, FILTER_BUTTON_TEXT_CLASS } from "@/components/screens/filterStyles";
import { useProductSearch } from "@/app/hooks/useProductSearch";
import { useAppContext } from "@/contexts/AppContext";
import type { LandingCardContent, Screen } from "@/types/page";
import { cn } from "@/lib/utils";

const LANDING_FILTER_BUTTONS = [
  { label: "健康重視", buttonDataOid: ".zvc9j.", textDataOid: "btn-text-health" },
  { label: "お気に入り", buttonDataOid: "jm:hia2", textDataOid: "btn-text-favorite" }
];

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
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [budget, setBudget] = useState('');

  const handleCardToggle = (index: number) => {
    setSelectedCards((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
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
    // ジャンル番号の計算（ページ数とカード位置から）
    const selectedGenres = selectedCards.map(cardIndex => {
      // 各ページは12個のカードを持つ
      const genreNumber = (landingPage - 1) * 12 + cardIndex + 1;
      return genreNumber;
    });

    // 検索を実行してからcatalogページに遷移
    await searchProducts({
      q: searchQuery.trim() || null,
      genre: selectedGenres.length > 0 ? selectedGenres[0] : null, // 複数ジャンルの場合は最初のものを使用
      limit: 50
    });

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
            size={24}
            data-oid="catalog-landing-search-icon"
          />

          <Input
            placeholder="商品名で検索（例: 牛乳、パン、卵など）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-14 h-14 border-2 border-[#fda900] text-[18px] rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20 font-['BIZ_UDPGothic']"
            data-oid="catalog-landing-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[24px]"
              data-oid="catalog-landing-search-clear">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-[25px] mb-6" data-oid="catalog-landing-filters">
          {LANDING_FILTER_BUTTONS.map(({ label, buttonDataOid, textDataOid }) => (
            <Button
              key={`${label}-landing`}
              variant="ghost"
              className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
              data-oid={`${buttonDataOid}-landing`}>
              <span className={FILTER_BUTTON_TEXT_CLASS} data-oid={`${textDataOid}-landing`}>
                {label}
              </span>
            </Button>
          ))}
          
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
              onChange={(e) => setBudget(e.target.value)}
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
          <Button
            variant="ghost"
            className="border border-transparent p-0 rounded-[20px] border-[3px] border-[#FDA900] bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2] w-[150px] h-[60px] shrink-0"
            onClick={handleSearch}
            disabled={isLoading}
            data-oid="catalog-landing-next-button">
            <span className="text-black font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]">
              {isLoading ? '検索中...' : '次へ'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
