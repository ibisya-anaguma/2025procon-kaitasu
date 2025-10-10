"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_CLASS, FILTER_BUTTON_TEXT_CLASS } from "@/components/screens/filterStyles";
import { useProductSearch } from "@/app/hooks/useProductSearch";
import { useAppContext } from "@/contexts/AppContext";
import type { Product, Screen } from "@/types/page";

const CATALOG_FILTER_BUTTONS = [
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

export default function CatalogPage() {
  const router = useRouter();
  const {
    products: staticProducts,
    catalogQuantitySum,
    catalogPriceSum,
    onUpdateProductQuantity,
    catalogScrollRef,
    onNavigate: setScreen
  } = useAppContext();
  const { products: searchResults, searchProducts, clearSearch, isLoading } = useProductSearch();
  const [searchQuery, setSearchQuery] = useState('');

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchProducts({ q: searchQuery.trim(), limit: 50 });
    } else {
      clearSearch();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearSearch();
  };

  // 検索結果がある場合は検索結果を、ない場合は静的な商品データを使用
  const displayProducts = searchResults.length > 0 ? searchResults.map(p => {
    // 既存の商品データから数量を取得
    const existingProduct = staticProducts.find(sp => sp.id === Number(p.id));
    return {
      id: Number(p.id),
      name: p.name,
      price: p.price,
      image: p.imgUrl,
      quantity: existingProduct?.quantity || 0,
      description: ''
    };
  }) : staticProducts;

  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] relative min-h-screen flex items-center justify-center"
      data-oid="d95y1m5">

      <div
        className="absolute right-0 top-0 bottom-0 w-1 bg-[#fda900]"
        data-oid="kh0_yce">
      </div>

      <div className="mx-auto w-[1000px]" data-oid="psedc55">
        {/* 検索ボックス */}
        <div className="relative mb-6" data-oid="catalog-search">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fda900]"
            size={24}
            data-oid="catalog-search-icon"
          />

          <Input
            placeholder="商品名で検索（例: 牛乳、パン、卵など）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-14 h-14 border-2 border-[#fda900] text-[18px] rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20 font-['BIZ_UDPGothic']"
            data-oid="catalog-search-input"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[24px]"
              data-oid="catalog-search-clear">
              ✕
            </button>
          )}
        </div>

        {/* 検索結果情報 */}
        {isLoading && (
          <div className="mb-4 text-[18px] text-[#FDA900] font-['BIZ_UDPGothic'] font-bold">
            検索中...
          </div>
        )}
        {!isLoading && searchQuery && searchResults.length > 0 && (
          <div className="mb-4 text-[18px] text-[#209fde] font-['BIZ_UDPGothic'] font-bold">
            {searchResults.length}件の商品が見つかりました
          </div>
        )}
        {!isLoading && searchQuery && searchResults.length === 0 && (
          <div className="mb-4 text-[18px] text-[#adadad] font-['BIZ_UDPGothic'] font-bold">
            「{searchQuery}」に一致する商品が見つかりませんでした
          </div>
        )}

        <div className="flex gap-[25px] mb-6" data-oid="br-d9o3">
          <Button
            key="catalog-back-button"
            variant="ghost"
            className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
            onClick={() => handleNavigate("catalogLanding")}
            data-oid="catalog-back-button">
            <span className="mr-3 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M22.4404 3.42066C21.5311 3.42066 20.659 3.78188 20.016 4.42486C19.373 5.06785 19.0118 5.93992 19.0118 6.84923C19.0118 7.75854 19.373 8.63062 20.016 9.2736C20.659 9.91658 21.5311 10.2778 22.4404 10.2778H31.7935C34.1613 10.3239 36.4166 11.2969 38.0749 12.9877C39.7331 14.6786 40.662 16.9524 40.662 19.3207C40.662 21.6889 39.7331 23.9627 38.0749 25.6536C36.4166 27.3444 34.1613 28.3174 31.7935 28.3635H16.5158V22.4389C16.5157 21.7609 16.3145 21.0982 15.9377 20.5345C15.561 19.9708 15.0256 19.5315 14.3992 19.272C13.7728 19.0126 13.0835 18.9447 12.4186 19.0769C11.7536 19.2092 11.1427 19.5356 10.6632 20.0149L1.31694 29.3612C0.835444 29.8396 0.506738 30.45 0.372461 31.1153C0.238184 31.7806 0.304378 32.4707 0.562658 33.0984C0.729515 33.5098 0.978658 33.8835 1.31009 34.2195L10.6632 43.5727C11.1427 44.052 11.7536 44.3784 12.4186 44.5107C13.0835 44.6429 13.7728 44.575 14.3992 44.3156C15.0256 44.0561 15.561 43.6168 15.9377 43.0531C16.3145 42.4894 16.5157 41.8267 16.5158 41.1487V35.2207H31.7935C33.9012 35.2516 35.994 34.8632 37.9502 34.0781C39.9064 33.2929 41.687 32.1266 43.1884 30.6471C44.6898 29.1676 45.882 27.4043 46.6958 25.4599C47.5096 23.5154 47.9287 21.4286 47.9287 19.3207C47.9287 17.2128 47.5096 15.1259 46.6958 13.1814C45.882 11.237 44.6898 9.47372 43.1884 7.9942C41.687 6.51468 39.9064 5.34843 37.9502 4.56327C35.994 3.77811 33.9012 3.38971 31.7935 3.42066H22.4404Z"
                  fill="#FDA900"
                />
              </svg>
            </span>
            <span className={FILTER_BUTTON_TEXT_CLASS}>戻る</span>
          </Button>
          {CATALOG_FILTER_BUTTONS.map(({ label, buttonDataOid, textDataOid }) => (
            <Button
              key={label}
              variant="ghost"
              className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
              data-oid={buttonDataOid}>
              <span className={FILTER_BUTTON_TEXT_CLASS} data-oid={textDataOid}>
                {label}
              </span>
            </Button>
          ))}
        </div>

        <div
        className="relative mt-[23px] mb-[24px] w-[1000px]"
        data-oid="catalog-card-background">
          <div
          className="pointer-events-none absolute top-0 left-0 z-0 h-[507px] w-[1000px] rounded-[20px] bg-[rgba(253,169,0,0.5)]"
          aria-hidden="true"
          />
          <div
            ref={catalogScrollRef}
            className="relative z-10 h-[507px] w-[1000px] overflow-x-hidden overflow-y-auto pt-[18px] flex flex-col items-center"
            data-oid="uy6_dcp-wrapper">
            <div
            className="flex justify-center gap-[25px] mb-6"
            data-oid="uy6_dcp">
            <span
            className="flex items-center text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]"
            data-oid="catalog-page-label">
              ページ
            </span>
            {[1, 2, 3, 4, 5].map((num) => {
              const isActive = num === 1;
              return (
                <Button
                  key={num}
                  size="sm"
                  variant="ghost"
                  className={`border border-transparent p-0 flex w-[60px] h-[60px] px-[19px] py-[14px] flex-col justify-center items-center gap-[10px] shrink-0 rounded-[20px] text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px] ${
                    isActive
                      ? 'bg-[#FDA900] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)_inset]'
                      : 'bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]'
                  }`}
                  data-oid="9r7o0ii">
                    {num}
                  </Button>
              );
            })}
            <span className="text-sm self-center font-medium" data-oid="xd09rri">
              ...
            </span>
            <Button
            size="sm"
            variant="ghost"
            className="border border-transparent p-0 flex w-[60px] h-[60px] px-[19px] py-[14px] flex-col justify-center items-center gap-[10px] rounded-[20px] bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]"
            data-oid="f8qlkjv">
              15
            </Button>
            </div>

            <div
            className="grid grid-cols-4 gap-y-4 gap-x-[45px] justify-items-start"
            style={{ gridTemplateColumns: "repeat(4, 188px)" }}
            data-oid="h7qwqv1">
            {displayProducts.map((product) => (
              <Card
                key={product.id}
                className="px-4 pt-1 pb-0 bg-white border-2 border-[#e0e0e0] rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col w-[188px] h-[265px]"
                data-oid="3w-11ql">

                <div className="flex justify-end mb-[3px]" data-oid="catalog-heart-row">
                  <svg
                xmlns="http://www.w3.org/2000/svg"
                width="34"
                height="31"
                viewBox="0 0 34 31"
                fill="none"
                data-oid="eo3z5j5">
                    <path
                  d="M17 7.84292C17 7.84292 17 7.66699 15.7967 6.08366C14.4033 4.24699 12.345 2.91699 9.875 2.91699C5.9325 2.91699 2.75 6.09949 2.75 10.042C2.75 11.5145 3.19333 12.8762 3.95333 14.0003C5.23583 15.9162 17 28.2503 17 28.2503M17 7.84292C17 7.84292 17 7.66699 18.2033 6.08366C19.5967 4.24699 21.655 2.91699 24.125 2.91699C28.0675 2.91699 31.25 6.09949 31.25 10.042C31.25 11.5145 30.8067 12.8762 30.0467 14.0003C28.7642 15.9162 17 28.2503 17 28.2503"
                  stroke="#209FDE"
                  strokeWidth="3.86"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                  </svg>
                </div>
                <div
                className="relative mb-[6.5px] h-[106px]"
                data-oid="8gipz64">
                  <img
                src={product.image || "/placeholder.svg"}
                alt={product.name}
                className="h-full w-full object-cover rounded-lg"
                data-oid="q.-_y:_" />
                </div>
                <h4 className="text-sm font-bold" data-oid="d:mf1eo">
                  {product.name}
                </h4>
                <p className="hidden" data-oid="ms.1o9h">
                  {product.description}
                </p>
                <div
              className="flex flex-col items-center"
              data-oid="r7z2qp8">
                <span
                className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal tracking-[1.04px] self-start w-full block mt-3"
                data-oid="eq4gt6a">
                    ¥{product.price}
                  </span>
                  <div className="mt-[12px] flex w-full items-center justify-center gap-2" data-oid="4z4g4a-">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 rounded-md bg-transparent hover:bg-transparent"
                      onClick={() => onUpdateProductQuantity(product.id, -1)}
                      data-oid="les5kg0">
                      <Image
                    src="/images/mainasu.png"
                    alt="数量を減らす"
                    width={28}
                    height={28}
                    className="h-full w-full object-contain"
                    data-oid="d7ycg-q" />

                    </Button>
                    <div
                  className="flex items-center justify-center text-sm font-medium w-[73px] h-[26px] shrink-0 rounded-[5px] border border-[#FDA900] bg-white"
                  data-oid="f1loo1.">
                      {product.quantity}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 rounded-md bg-transparent hover:bg-transparent"
                      onClick={() => onUpdateProductQuantity(product.id, 1)}
                      data-oid=":--ycbg">
                      <Image
                    src="/images/plus.png"
                    alt="数量を増やす"
                    width={28}
                    height={28}
                    className="h-full w-full object-contain"
                    data-oid="olbxiee" />

                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            </div>
          </div>
        </div>

        {/* Cart Summary */}
        <div
        className="flex justify-between items-center bg-[#fda900] text-white p-4 rounded-xl border-2 border-[#fda900] shadow-md"
        data-oid="t2ub1nx">

          <span className="text-base font-bold" data-oid="5rigjnl">
            {catalogQuantitySum}点 ¥
            {catalogPriceSum}
          </span>
          <Button
            className="bg-white text-[#fda900] text-base font-bold px-8 h-11 border-2 border-white rounded-lg hover:bg-gray-50 shadow-sm"
            onClick={() => handleNavigate("cart")}
            data-oid="b9c3xju">

            購入
          </Button>
        </div>
      </div>
    </div>
  );
}
