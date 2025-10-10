"use client";

import { Fragment, useState } from "react";
import Image from "next/image";

import { useAppContext } from "@/contexts/AppContext";
import { useFavorites } from "@/app/hooks/useFavorites";

export default function FavoriteListPage() {
  const { favoriteEntries: entries, onRemoveFavoriteEntry: onRemoveEntry } = useAppContext();
  const { favorites, removeFromFavorites, isLoading } = useFavorites();
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // お気に入りから削除
  const handleRemove = async (productId: number) => {
    const success = await removeFromFavorites(String(productId));
    if (success) {
      setSuccessMessage('お気に入りから削除しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      // AppContextからも削除
      onRemoveEntry(productId);
    } else {
      setErrorMessage('削除に失敗しました');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // 表示するエントリー（Firestoreから取得したデータを優先）
  const displayEntries = favorites.length > 0 ? favorites.map(fav => ({
    productId: Number(fav.id),
    name: fav.name,
    price: fav.price,
    image: fav.imgUrl,
    quantity: fav.quantity || 1
  })) : entries;
  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center"
      data-oid="favorite-list-page">
      {/* 成功メッセージ */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          {successMessage}
        </div>
      )}
      {/* エラーメッセージ */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
          {errorMessage}
        </div>
      )}
      <div className="mx-auto w-[903px]" data-oid="favorite-list-content">
        <div
          className="flex flex-col gap-6 p-6"
          style={{
            width: "900px",
            minHeight: "200px",
            borderRadius: "14.469px",
            border: "5px solid #FDA900",
            backgroundColor: "#FFF"
          }}
          data-oid="favorite-list-card">
          {isLoading ? (
            <div className="flex h-[160px] items-center justify-center">
              <span style={{
                color: "#ADADAD",
                fontFamily: '"BIZ UDPGothic"',
                fontSize: "24px",
                fontWeight: 700
              }}>読み込み中...</span>
            </div>
          ) : displayEntries.length === 0 ? (
            <div
              className="flex h-[160px] items-center justify-center"
              data-oid="favorite-list-empty">
              <span
                style={{
                  color: "#ADADAD",
                  fontFamily: '"BIZ UDPGothic"',
                  fontSize: "24px",
                  fontStyle: "normal",
                  fontWeight: 700,
                  lineHeight: "normal"
                }}>
                登録されたお気に入りはありません
              </span>
            </div>
          ) : (
            displayEntries.map((entry, index) => (
              <Fragment key={`favorite-entry-${entry.productId}`}>
                <div
                  className="flex items-center gap-8"
                  data-oid="favorite-list-row">
                  <div
                    className="flex items-center gap-6 flex-1"
                    data-oid="favorite-list-product">
                    <div
                      className="overflow-hidden rounded bg-white flex items-center justify-center"
                      style={{ width: "160px", height: "106px" }}>
                      <Image
                        src={entry.image || "/placeholder.svg"}
                        alt={entry.name}
                        width={160}
                        height={106}
                        style={{ objectFit: "cover" }}
                        data-oid="favorite-list-image"
                      />
                    </div>
                    <span
                      style={{
                        color: "var(--, #101010)",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "normal"
                      }}
                      data-oid="favorite-list-name">
                      {entry.name}
                    </span>
                    <div className="flex flex-col items-end ml-auto" data-oid="favorite-list-meta">
                      <span
                        style={{
                          color: "var(--, #101010)",
                          fontFamily: '"BIZ UDPGothic"',
                          fontSize: "24px",
                          fontStyle: "normal",
                          fontWeight: 700,
                          lineHeight: "normal"
                        }}
                        data-oid="favorite-list-quantity">
                        個数 {entry.quantity}コ
                      </span>
                      <span
                        style={{
                          color: "var(--, #101010)",
                          fontFamily: '"BIZ UDPGothic"',
                          fontSize: "24px",
                          fontStyle: "normal",
                          fontWeight: 700,
                          lineHeight: "normal"
                        }}
                        data-oid="favorite-list-price">
                        ¥{entry.price}
                      </span>
                    </div>
                  </div>
                  <button
                    className="rounded-md border border-[#FDA900] px-4 py-2 text-sm font-medium text-[#FDA900] hover:bg-[#FDA900] hover:text-white transition-colors"
                    onClick={() => handleRemove(entry.productId)}
                    data-oid="favorite-list-remove">
                    削除
                  </button>
                </div>
                {index < displayEntries.length - 1 && (
                  <div
                    className="self-center"
                    style={{
                      width: "700px",
                      height: "2px",
                      background: "#ADADAD"
                    }}
                    data-oid="favorite-list-divider"
                  />
                )}
              </Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
