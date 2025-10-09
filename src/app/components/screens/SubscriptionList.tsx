"use client";

import Image from "next/image";

import type { SubscriptionEntry } from "@/types/page";

type SubscriptionListProps = {
  entries: SubscriptionEntry[];
  onRemoveEntry: (productId: number) => void;
};

export function SubscriptionList({ entries, onRemoveEntry }: SubscriptionListProps) {
  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen"
      data-oid="subscription-list-page">
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
          {entries.length === 0 ? (
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
            entries.map((entry) => (
              <div
                key={`subscription-entry-${entry.productId}`}
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
                    個数 x{entry.quantity}
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
                <button
                  className="rounded-md border border-[#FDA900] px-4 py-2 text-sm font-medium text-[#FDA900]"
                  onClick={() => onRemoveEntry(entry.productId)}
                  data-oid="subscription-list-remove">
                  削除
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
