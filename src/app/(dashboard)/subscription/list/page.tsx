"use client";

import { Fragment, useState } from "react";
import Image from "next/image";

import { useAppContext } from "@/contexts/AppContext";
import { useSubscriptions } from "@/app/hooks/useSubscriptions";

export default function SubscriptionListPage() {
  const { subscriptionEntries: entries, onRemoveSubscriptionEntry: onRemoveEntry } = useAppContext();
  const { subscriptions, removeFromSubscriptions, isLoading } = useSubscriptions();
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 定期購入から削除
  const handleRemove = async (productId: number) => {
    const success = await removeFromSubscriptions(String(productId));
    if (success) {
      setSuccessMessage('定期購入から削除しました');
      setTimeout(() => setSuccessMessage(''), 3000);
      // AppContextからも削除
      onRemoveEntry(productId);
    } else {
      setErrorMessage('削除に失敗しました');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  // 表示するエントリー（Firestoreから取得したデータを優先）
  const displayEntries = subscriptions.length > 0 ? subscriptions.map(sub => ({
    productId: Number(sub.id),
    name: sub.name,
    price: sub.price,
    image: sub.imgUrl,
    quantity: sub.quantity,
    frequencyDays: sub.frequency
  })) : entries;

  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center"
      data-oid="subscription-list-page">
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
      <div className="mx-auto w-[903px]" data-oid="subscription-list-content">
        <div
          className="flex flex-col gap-6 p-6"
          style={{
            width: "900px",
            minHeight: "200px",
            borderRadius: "14.469px",
            border: "5px solid #FDA900",
            backgroundColor: "#FFF"
          }}
          data-oid="subscription-list-card">
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
              data-oid="subscription-list-empty">
              <span
                style={{
                  color: "#ADADAD",
                  fontFamily: '"BIZ UDPGothic"',
                  fontSize: "24px",
                  fontStyle: "normal",
                  fontWeight: 700,
                  lineHeight: "normal"
                }}>
                登録された定期購入はありません
              </span>
            </div>
          ) : (
            displayEntries.map((entry, index) => (
              <Fragment key={`subscription-entry-${entry.productId}`}>
                <div
                  className="flex items-center gap-8"
                  data-oid="subscription-list-row">
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "24px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal"
                    }}
                    data-oid="subscription-list-frequency">
                    {entry.frequencyDays}日ごと
                  </span>
                  <div className="flex items-center gap-6 flex-1" data-oid="subscription-list-product">
                    <div
                      className="overflow-hidden rounded bg-white flex items-center justify-center"
                      style={{ width: "160px", height: "106px" }}>
                      <Image
                        src={entry.image || "/placeholder.svg"}
                        alt={entry.name}
                        width={160}
                        height={106}
                        style={{ objectFit: "cover" }}
                        data-oid="subscription-list-image"
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
                    data-oid="subscription-list-name">
                    {entry.name}
                  </span>
                  <div className="flex flex-col items-end ml-auto" data-oid="subscription-list-meta">
                    <span
                      style={{
                        color: "var(--, #101010)",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "normal"
                      }}
                      data-oid="subscription-list-quantity">
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
                      data-oid="subscription-list-price">
                      ¥{entry.price}
                    </span>
                  </div>
                  </div>
                  <button
                    className="rounded-md border border-[#FDA900] px-4 py-2 text-sm font-medium text-[#FDA900] hover:bg-[#FDA900] hover:text-white transition-colors"
                    onClick={() => handleRemove(entry.productId)}
                    data-oid="subscription-list-remove">
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
                    data-oid="subscription-list-divider"
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
