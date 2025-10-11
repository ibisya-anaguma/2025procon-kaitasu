"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FILTER_BUTTON_INACTIVE_CLASS, FILTER_BUTTON_TEXT_CLASS } from "@/components/screens/filterStyles";
import { useProductSearch } from "@/app/hooks/useProductSearch";
import { useFavorites } from "@/app/hooks/useFavorites";
import { useAppContext } from "@/contexts/AppContext";
import type { Product, Screen } from "@/types/page";

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
  const { products: searchResults, isComboResults } = useProductSearch();
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [searchProductQuantities, setSearchProductQuantities] = useState<Record<string, number>>({});

  // favoritesが変更されたらログ出力
  useEffect(() => {
    console.log('[DEBUG catalog] Favorites updated:', favorites);
  }, [favorites]);

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  // お気に入り状態を確認
  const isFavorite = (productId: string | number): boolean => {
    const checkId = productId.toString();
    const isFav = favorites.some(fav => {
      const favId = fav.productId.toString();
      const match = favId === checkId;
      if (match) {
        console.log(`[DEBUG catalog] ✓ Match found! favId: ${favId}, checkId: ${checkId}`);
      }
      return match;
    });
    if (!isFav && favorites.length > 0) {
      console.log(`[DEBUG catalog] ✗ No match for ${checkId}. Favorites IDs:`, favorites.map(f => f.productId.toString()).slice(0, 3));
    }
    return isFav;
  };

  // お気に入りトグル
  const handleToggleFavorite = async (productId: string | number) => {
    const isFav = isFavorite(productId);
    console.log(`[DEBUG catalog] ========== お気に入りトグル ==========`);
    console.log(`[DEBUG catalog] Product ID: ${productId}`);
    console.log(`[DEBUG catalog] Current state: ${isFav ? 'favorited' : 'not favorited'}`);
    console.log(`[DEBUG catalog] Favorites list:`, favorites);
    
    if (isFav) {
      // お気に入りから削除
      console.log(`[DEBUG catalog] Attempting to remove favorite...`);
      const success = await removeFavorite(productId.toString());
      console.log(`[DEBUG catalog] Remove favorite result: ${success ? 'success' : 'failed'}`);
    } else {
      // お気に入りに追加
      console.log(`[DEBUG catalog] Attempting to add favorite...`);
      const success = await addFavorite(productId, 1);
      console.log(`[DEBUG catalog] Add favorite result: ${success ? 'success' : 'failed'}`);
    }
    console.log(`[DEBUG catalog] ==========================================`);
  };

  // 検索結果が変わったら数量をリセット
  useEffect(() => {
    if (searchResults.length > 0) {
      const initialQuantities: Record<string, number> = {};
      searchResults.forEach(p => {
        initialQuantities[p.id] = isComboResults ? 1 : 0;
      });
      setSearchProductQuantities(initialQuantities);
    }
  }, [searchResults, isComboResults]);

  // 検索結果の商品数量を更新（IDは文字列として扱う）
  const handleUpdateSearchProductQuantity = (id: number | string, change: number) => {
    const idKey = String(id);
    setSearchProductQuantities(prev => ({
      ...prev,
      [idKey]: Math.max(0, (prev[idKey] || 0) + change)
    }));
  };

  // 検索結果がある場合は検索結果を、ない場合は静的な商品データを使用
  const allProducts: Array<Product & { id: number | string }> = searchResults.length > 0 ? searchResults.map(p => {
    const productId = p.id; // 文字列のまま使用
    return {
      id: productId,
      name: p.name,
      price: p.price,
      image: p.imgUrl,
      quantity: searchProductQuantities[productId] || 0,
      description: ''
    };
  }) : staticProducts;

  // 検索結果の合計を計算
  const searchQuantitySum = searchResults.length > 0 
    ? Object.values(searchProductQuantities).reduce((sum, qty) => sum + qty, 0)
    : 0;
  
  const searchPriceSum = searchResults.length > 0
    ? searchResults.reduce((sum, p) => {
        const productId = p.id;
        const qty = searchProductQuantities[productId] || 0;
        return sum + (qty * p.price);
      }, 0)
    : 0;

  // 実際に使用する数量更新関数と合計
  const updateQuantity = searchResults.length > 0 ? handleUpdateSearchProductQuantity : onUpdateProductQuantity;
  const quantitySum = searchResults.length > 0 ? searchQuantitySum : catalogQuantitySum;
  const priceSum = searchResults.length > 0 ? searchPriceSum : catalogPriceSum;

  // ページネーション計算
  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const displayProducts = allProducts.slice(startIndex, endIndex);

  console.log('[DEBUG catalog] Search results:', searchResults.length, 'items');
  console.log('[DEBUG catalog] All products:', allProducts.length, 'items');
  console.log('[DEBUG catalog] Display products:', displayProducts.length, 'items');
  console.log('[DEBUG catalog] Is combo results:', isComboResults);
  console.log('[DEBUG catalog] Product quantities:', searchProductQuantities);
  console.log('[DEBUG catalog] Favorites count:', favorites.length);
  
  // 検索結果がある場合、商品の詳細情報を出力
  if (searchResults.length > 0) {
    console.log('[DEBUG catalog] ========== カタログ商品情報 ==========');
    console.log('[DEBUG catalog] 表示商品数:', displayProducts.length, '/', allProducts.length);
    console.log('[DEBUG catalog] 現在のページ:', currentPage, '/', totalPages);
    const selectedCount = Object.values(searchProductQuantities).filter(q => q > 0).length;
    const totalQuantity = Object.values(searchProductQuantities).reduce((sum, q) => sum + q, 0);
    console.log('[DEBUG catalog] 選択商品数:', selectedCount, '個（合計数量:', totalQuantity, '）');
    console.log('[DEBUG catalog] お気に入り数:', favorites.length, '個');
    const favoritedInCurrentPage = displayProducts.filter(p => isFavorite(p.id)).length;
    console.log('[DEBUG catalog] 現在のページのお気に入り:', favoritedInCurrentPage, '/', displayProducts.length);
    console.log('[DEBUG catalog] ==========================================');
  }

  // ページ変更時にスクロールをトップに戻す
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (catalogScrollRef.current) {
      catalogScrollRef.current.scrollTop = 0;
    }
  };

  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] relative min-h-screen flex items-center justify-center"
      data-oid="d95y1m5">

      <div
        className="absolute right-0 top-0 bottom-0 w-1 bg-[#fda900]"
        data-oid="kh0_yce">
      </div>

      <div className="mx-auto w-[1000px]" data-oid="psedc55">
        {/* 検索結果情報 */}
        {searchResults.length > 0 && (
          <div className="mb-4 text-sm text-gray-600">
            {searchResults.length}件の商品が見つかりました
          </div>
        )}

        <div className="flex gap-[25px] mb-6" data-oid="br-d9o3">
          <Button
            key="catalog-back-button"
            variant="ghost"
            className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
            onClick={() => {
              // 検索結果をクリア
              sessionStorage.removeItem('searchResults');
              sessionStorage.removeItem('isComboResults');
              handleNavigate("catalogLanding");
            }}
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
            {totalPages > 0 && Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
              const isActive = num === currentPage;
              return (
                <Button
                  key={num}
                  size="sm"
                  variant="ghost"
                  onClick={() => handlePageChange(num)}
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
            </div>

            <div
            className="grid grid-cols-4 gap-y-4 gap-x-[45px] justify-items-start"
            style={{ gridTemplateColumns: "repeat(4, 188px)" }}
            data-oid="h7qwqv1">
            {displayProducts.map((product) => (
              <Card
                key={product.id}
                className="relative px-4 pt-1 pb-0 bg-white border-2 border-[#e0e0e0] rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col w-[188px] h-[265px]"
                data-oid="3w-11ql">

                {/* 選択中表示 */}
                {product.quantity > 0 && (
                  <div
                    className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                    data-oid={`catalog-card-selected-${product.id}`}>
                    <div className="w-[100px] h-[40px] shrink-0 rounded-[10px] bg-[#FDA900] flex items-center justify-center">
                      <span className="text-white font-['BIZ_UDPGothic'] text-[24px] font-bold leading-normal tracking-[1.248px]">
                        選択中
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mb-[3px]" data-oid="catalog-heart-row">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const currentState = isFavorite(product.id);
                      console.log('[DEBUG catalog] Heart clicked for product:', product.id, 'Current isFavorite:', currentState);
                      await handleToggleFavorite(product.id);
                      // クリック後の状態を確認
                      setTimeout(() => {
                        const newState = isFavorite(product.id);
                        console.log('[DEBUG catalog] After toggle, isFavorite:', newState, 'Changed:', currentState !== newState);
                      }, 500);
                    }}
                    className="cursor-pointer hover:scale-110 transition-transform"
                    aria-label={isFavorite(product.id) ? "お気に入りから削除" : "お気に入りに追加"}
                  >
                    {isFavorite(product.id) ? (
                      // お気に入り登録済み - 青で塗りつぶし
                      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="31" viewBox="0 0 50 45" fill="none">
                        <mask id={`path-1-inside-1_${product.id}`} fill="white">
                          <path d="M24.6836 9.45889C24.6836 9.45889 24.6836 9.15626 22.6137 6.43262C20.2169 3.27321 16.6761 0.985352 12.4273 0.985352C5.64541 0.985352 0.170898 6.45986 0.170898 13.2417C0.170898 15.7747 0.933517 18.117 2.24086 20.0508C4.44701 23.3464 24.6836 44.5635 24.6836 44.5635M24.6836 9.45889C24.6836 9.45889 24.6836 9.15626 26.7536 6.43262C29.1504 3.27321 32.6911 0.985352 36.94 0.985352C43.7218 0.985352 49.1964 6.45986 49.1964 13.2417C49.1964 15.7747 48.4337 18.117 47.1264 20.0508C44.9202 23.3464 24.6836 44.5635 24.6836 44.5635"/>
                        </mask>
                        <path d="M-42.3164 9.4592C-42.3162 46.4623 -12.3191 76.4591 24.6839 76.4589C61.687 76.4587 91.6838 46.4616 91.6836 9.45857L24.6836 9.45889L-42.3164 9.4592ZM22.6137 6.43262L-30.7647 46.9265C-30.7528 46.9421 -30.741 46.9576 -30.7292 46.9732L22.6137 6.43262ZM2.24086 20.0508L57.9173 -17.2202C57.8606 -17.305 57.8037 -17.3896 57.7465 -17.4741L2.24086 20.0508ZM24.6836 44.5635L-23.7996 90.8062C-11.1558 104.062 6.36442 111.564 24.6836 111.564C43.0028 111.564 60.5231 104.062 73.1668 90.8062L24.6836 44.5635ZM26.7536 6.43262L80.0965 46.9732C80.1083 46.9576 80.1201 46.9421 80.1319 46.9265L26.7536 6.43262ZM47.1264 20.0508L-8.37927 -17.4741C-8.4364 -17.3896 -8.49334 -17.305 -8.55009 -17.2202L47.1264 20.0508ZM24.6836 9.45889C91.6836 9.45857 91.6833 9.23632 91.6822 9.01408C91.6816 8.94067 91.6796 8.72145 91.6778 8.57563C91.674 8.28537 91.6683 7.999 91.661 7.71661C91.6463 7.15201 91.6248 6.60227 91.5978 6.06805C91.5437 5.00096 91.4668 3.98765 91.3748 3.03278C91.1916 1.13168 90.9433 -0.594497 90.6758 -2.1195C90.1483 -5.12732 89.4889 -7.67726 88.8998 -9.65813C87.7545 -13.5093 86.476 -16.5353 85.6124 -18.4293C83.9173 -22.1466 82.2163 -24.9743 81.322 -26.4126C79.4409 -29.4377 77.475 -32.11 75.9565 -34.108L22.6137 6.43262L-30.7292 46.9732C-30.1777 47.6989 -31.1086 46.5397 -32.4722 44.3468C-33.1078 43.3247 -34.6794 40.7428 -36.3098 37.1674C-37.1411 35.3443 -38.4034 32.3633 -39.5407 28.5393C-40.1257 26.572 -40.783 24.0312 -41.3096 21.0291C-41.5765 19.507 -41.8246 17.7829 -42.0076 15.8831C-42.0996 14.9289 -42.1765 13.916 -42.2305 12.8493C-42.2576 12.3152 -42.279 11.7656 -42.2937 11.2011C-42.3011 10.9187 -42.3067 10.6324 -42.3106 10.3421C-42.3123 10.1963 -42.3144 9.97709 -42.3149 9.90369C-42.316 9.68145 -42.3164 9.4592 24.6836 9.45889ZM22.6137 6.43262L75.992 -34.0613C64.2412 -49.551 42.5697 -66.0146 12.4273 -66.0146V0.985352V67.9854C-9.21741 67.9854 -23.8075 56.0974 -30.7647 46.9265L22.6137 6.43262ZM12.4273 0.985352V-66.0146C-31.3577 -66.0146 -66.8291 -30.5432 -66.8291 13.2417H0.170898H67.1709C67.1709 43.4629 42.6485 67.9854 12.4273 67.9854V0.985352ZM0.170898 13.2417H-66.8291C-66.8291 29.4227 -61.909 44.7895 -53.2648 57.5758L2.24086 20.0508L57.7465 -17.4741C63.776 -8.55548 67.1709 2.12669 67.1709 13.2417H0.170898ZM2.24086 20.0508L-53.4356 57.3218C-49.5666 63.1014 -43.9004 69.2276 -43.1212 70.0933C-40.5139 72.9901 -37.4592 76.2924 -34.6921 79.2573C-31.8817 82.2686 -29.1678 85.1459 -27.17 87.2563C-26.167 88.316 -25.3347 89.1926 -24.749 89.8086C-24.456 90.1169 -24.2241 90.3605 -24.0628 90.5299C-23.9822 90.6145 -23.9191 90.6807 -23.8749 90.7271C-23.8528 90.7504 -23.8353 90.7687 -23.8227 90.7819C-23.8164 90.7885 -23.8113 90.7938 -23.8075 90.7979C-23.8055 90.7999 -23.8039 90.8016 -23.8026 90.803C-23.8019 90.8037 -23.8012 90.8045 -23.8008 90.8048C-23.8002 90.8055 -23.7996 90.8062 24.6836 44.5635C73.1668 -1.6791 73.1673 -1.67864 73.1676 -1.67825C73.1676 -1.67823 73.1679 -1.67792 73.168 -1.67787C73.1681 -1.67778 73.1678 -1.67801 73.1673 -1.67856C73.1663 -1.67965 73.164 -1.682 73.1606 -1.6856C73.1537 -1.69281 73.1421 -1.70499 73.1259 -1.72202C73.0934 -1.75607 73.0426 -1.80944 72.9745 -1.88096C72.8382 -2.02402 72.6332 -2.23946 72.3686 -2.51781C71.839 -3.07491 71.073 -3.88165 70.1444 -4.86261C68.2788 -6.83339 65.7957 -9.46632 63.2712 -12.1713C60.7034 -14.9226 58.2853 -17.5425 56.4777 -19.5508C55.5544 -20.5767 55.0196 -21.1888 54.7969 -21.4497C53.7978 -22.6202 55.7108 -20.5164 57.9173 -17.2202L2.24086 20.0508ZM24.6836 9.45889C91.6836 9.45878 91.6833 9.68103 91.6822 9.90327C91.6816 9.97667 91.6796 10.1959 91.6778 10.3417C91.674 10.6319 91.6683 10.9183 91.661 11.2006C91.6463 11.7652 91.6249 12.3148 91.5978 12.8489C91.5438 13.9157 91.4669 14.9285 91.3749 15.8827C91.1919 17.7825 90.9438 19.5067 90.6769 21.0288C90.1504 24.0309 89.493 26.5717 88.908 28.539C87.7707 32.3631 86.5084 35.3442 85.6771 37.1673C84.0467 40.7427 82.4751 43.3246 81.8395 44.3468C80.4759 46.5397 79.5449 47.6989 80.0965 46.9732L26.7536 6.43262L-26.5893 -34.108C-28.1077 -32.11 -30.0737 -29.4377 -31.9547 -26.4125C-32.8491 -24.9743 -34.5501 -22.1465 -36.2452 -18.4292C-37.1088 -16.5352 -38.3873 -13.5092 -39.5326 -9.65791C-40.1217 -7.67702 -40.7811 -5.12704 -41.3086 -2.11919C-41.5761 -0.59417 -41.8244 1.13202 -42.0076 3.03314C-42.0995 3.98802 -42.1765 5.00134 -42.2305 6.06845C-42.2576 6.60266 -42.279 7.15242 -42.2937 7.71702C-42.3011 7.99941 -42.3067 8.28578 -42.3106 8.57605C-42.3123 8.72186 -42.3144 8.94109 -42.3149 9.0145C-42.316 9.23674 -42.3164 9.45899 24.6836 9.45889ZM26.7536 6.43262L80.1319 46.9265C73.1747 56.0974 58.5847 67.9854 36.94 67.9854V0.985352V-66.0146C6.79757 -66.0146 -14.8739 -49.551 -26.6247 -34.0613L26.7536 6.43262ZM36.94 0.985352V67.9854C6.71879 67.9854 -17.8036 43.463 -17.8036 13.2417H49.1964H116.196C116.196 -30.5432 80.7249 -66.0146 36.94 -66.0146V0.985352ZM49.1964 13.2417H-17.8036C-17.8036 2.12666 -14.4088 -8.5555 -8.37927 -17.4741L47.1264 20.0508L102.632 57.5758C111.276 44.7895 116.196 29.4227 116.196 13.2417H49.1964ZM47.1264 20.0508L-8.55009 -17.2202C-6.34357 -20.5164 -4.43052 -22.6202 -5.42968 -21.4497C-5.65239 -21.1888 -6.18711 -20.5767 -7.11043 -19.5508C-8.91803 -17.5425 -11.3361 -14.9226 -13.904 -12.1713C-16.4285 -9.46632 -18.9116 -6.83339 -20.7772 -4.86261C-21.7057 -3.88165 -22.4717 -3.07491 -23.0013 -2.51781C-23.2659 -2.23946 -23.471 -2.02402 -23.6072 -1.88096C-23.6753 -1.80944 -23.7262 -1.75607 -23.7586 -1.72202C-23.7749 -1.70499 -23.7865 -1.6928 -23.7934 -1.6856C-23.7968 -1.682 -23.799 -1.67964 -23.8001 -1.67855C-23.8006 -1.67801 -23.8008 -1.67778 -23.8007 -1.67787C-23.8007 -1.67792 -23.8004 -1.67822 -23.8004 -1.67825C-23.8 -1.67863 -23.7996 -1.6791 24.6836 44.5635C73.1668 90.8062 73.1674 90.8055 73.1681 90.8048C73.1684 90.8045 73.1692 90.8037 73.1698 90.803C73.1712 90.8016 73.1728 90.7999 73.1747 90.7979C73.1786 90.7938 73.1837 90.7885 73.19 90.7819C73.2026 90.7687 73.22 90.7504 73.2421 90.7271C73.2864 90.6807 73.3494 90.6145 73.4301 90.5299C73.5914 90.3605 73.8232 90.1169 74.1163 89.8086C74.702 89.1926 75.5342 88.316 76.5373 87.2563C78.535 85.1459 81.249 82.2686 84.0594 79.2573C86.8265 76.2924 89.8812 72.9901 92.4884 70.0933C93.2676 69.2276 98.9339 63.1014 102.803 57.3218L47.1264 20.0508Z" fill="#209FDE" mask={`url(#path-1-inside-1_${product.id})`}/>
                      </svg>
                    ) : (
                      // 未登録 - 通常のアウトライン
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
                    )}
                  </button>
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
                <h4 className="text-sm font-bold line-clamp-2" data-oid="d:mf1eo">
                  {product.name}
                </h4>
                <p className="hidden" data-oid="ms.1o9h">
                  {product.description}
                </p>
                <div
              className="flex flex-col items-center"
              data-oid="r7z2qp8">
                <span
                className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal tracking-[1.04px] self-start w-full block mt-0"
                data-oid="eq4gt6a">
                    ¥{product.price}
                  </span>
                  <div className="mt-[6px] mb-[6px] flex w-full items-center justify-center gap-2" data-oid="4z4g4a-">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 rounded-md bg-transparent hover:bg-transparent"
                      onClick={() => updateQuantity(product.id, -1)}
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
                      onClick={() => updateQuantity(product.id, 1)}
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
            {quantitySum}点 ¥
            {priceSum.toLocaleString('ja-JP')}
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
