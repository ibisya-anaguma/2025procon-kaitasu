"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Product, Screen, SubscriptionEntry } from "@/types/page";

type SubscriptionAddProps = {
  onNavigate: (screen: Screen) => void;
  onUpdateProductQuantity: (id: number, change: number) => void;
  onSaveSubscriptionEntry: (entry: SubscriptionEntry) => void;
  product: Product | null;
};

export function SubscriptionAdd({
  onNavigate,
  onUpdateProductQuantity,
  onSaveSubscriptionEntry,
  product
}: SubscriptionAddProps) {
  const [deliveryFrequency, setDeliveryFrequency] = useState(1);

  const handleFrequencyChange = (change: number) => {
    setDeliveryFrequency((prev) => Math.max(1, prev + change));
  };

  const handleSave = () => {
    if (!product) {
      return;
    }

    onSaveSubscriptionEntry({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: product.price * product.quantity,
      image: product.image,
      quantity: product.quantity,
      frequencyDays: deliveryFrequency
    });
    setDeliveryFrequency(1);
    onNavigate("subscriptionList");
  };

  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen" data-oid="subscription-add-page">
      <div className="mx-auto w-[903px]">

        {/* オレンジ色の四角（外枠） */}
        <div className="mt-4 flex w-full justify-center" data-oid="subscription-add-frame-wrapper">
          <div
            className="pt-[57px]"
            style={{
              borderRadius: "14.469px",
              border: "6px solid #FDA900",
              background: "#FFF",
              width: "900px",
              height: "633px",
              flexShrink: 0
            }}
            data-oid="subscription-add-orange-frame"
          >
          {/* 先ほど追加したセクション（内側のオレンジは削除し、内容のみ配置） */}
          {product ? (
            <div className="flex flex-col items-center" style={{ gap: "30px" }}>
              <div
                data-oid="subscription-add-product-row"
                style={{
                  display: "flex",
                  width: "768px",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div
                  className="overflow-hidden rounded bg-white"
                  style={{ width: "160px", height: "106.473px", flexShrink: 0 }}
                  data-oid="subscription-add-product-image"
                >
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    style={{ width: "160px", height: "106.473px", aspectRatio: "160 / 106.473", objectFit: "cover", flexShrink: 0 }}
                  />
                </div>
                <div
                  style={{
                    color: "#101010",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "32px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.664px"
                  }}
                  data-oid="subscription-add-product-name"
                >
                  {product.name}
                </div>
                <div
                  style={{
                    color: "#101010",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "36px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.872px"
                  }}
                  data-oid="subscription-add-product-price"
                >
                  ¥{product.price}
                </div>
              </div>
              <div
                style={{
                  width: "768px",
                  height: "2px",
                  background: "#ADADAD"
                }}
                data-oid="subscription-add-divider-1"
              />
              <div
                style={{
                  display: "flex",
                  width: "768px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "24px"
                }}
                data-oid="subscription-add-quantity-row"
              >
                <span
                  style={{
                    color: "var(--, #101010)",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "36px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.872px"
                  }}
                  data-oid="subscription-add-quantity-label"
                >
                  個数
                </span>
                <div
                  className="flex items-center"
                  style={{
                    width: "293px",
                    justifyContent: "space-between"
                  }}
                  data-oid="subscription-add-quantity-controls">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-md bg-transparent hover:bg-transparent"
                    style={{ width: "72px", height: "72px", flexShrink: 0 }}
                    onClick={() => onUpdateProductQuantity(product.id, -1)}
                    data-oid="subscription-add-quantity-decrease"
                  >
                    <img
                      src="/images/mainasu.png"
                      alt="数量を減らす"
                      width={72}
                      height={72}
                      className="h-full w-full object-contain"
                      data-oid="subscription-add-quantity-decrease-img"
                    />
                  </Button>
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "36px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.872px",
                      minWidth: "72px",
                      textAlign: "center"
                    }}
                    data-oid="subscription-add-quantity-value"
                >
                  {product.quantity}
                </span>
                <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-md bg-transparent hover:bg-transparent"
                    style={{ width: "72px", height: "72px", flexShrink: 0 }}
                    onClick={() => onUpdateProductQuantity(product.id, 1)}
                    data-oid="subscription-add-quantity-increase"
                  >
                    <img
                      src="/images/plus.png"
                      alt="数量を増やす"
                      width={72}
                      height={72}
                      className="h-full w-full object-contain"
                      data-oid="subscription-add-quantity-increase-img"
                    />
                  </Button>
                </div>
              </div>
              <div
                style={{
                  width: "768px",
                  height: "2px",
                  background: "#ADADAD"
                }}
                data-oid="subscription-add-divider-2"
              />
              <div
                style={{
                  display: "flex",
                  width: "768px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "12px"
                }}
                data-oid="subscription-add-frequency-row"
              >
                <span
                  style={{
                    color: "var(--, #101010)",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "36px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.872px"
                  }}
                  data-oid="subscription-add-frequency-label"
                >
                  お届け頻度
                </span>
                <span
                  style={{
                    color: "var(--, #101010)",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "36px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.872px"
                  }}
                  data-oid="subscription-add-frequency-description"
                >
                  {deliveryFrequency}日に一回
                </span>
                <div
                  className="flex items-center"
                  style={{
                    width: "293px",
                    justifyContent: "space-between"
                  }}
                  data-oid="subscription-add-frequency-controls">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-md bg-transparent hover:bg-transparent"
                    style={{ width: "72px", height: "72px", flexShrink: 0 }}
                    onClick={() => handleFrequencyChange(-1)}
                    data-oid="subscription-add-frequency-decrease"
                  >
                    <img
                      src="/images/mainasu.png"
                      alt="頻度を減らす"
                      width={72}
                      height={72}
                      className="h-full w-full object-contain"
                      data-oid="subscription-add-frequency-decrease-img"
                    />
                  </Button>
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "36px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.872px",
                      minWidth: "72px",
                      textAlign: "center"
                    }}
                    data-oid="subscription-add-frequency-value"
                  >
                    {deliveryFrequency}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-md bg-transparent hover:bg-transparent"
                    style={{ width: "72px", height: "72px", flexShrink: 0 }}
                    onClick={() => handleFrequencyChange(1)}
                    data-oid="subscription-add-frequency-increase"
                  >
                    <img
                      src="/images/plus.png"
                      alt="頻度を増やす"
                      width={72}
                      height={72}
                      className="h-full w-full object-contain"
                      data-oid="subscription-add-frequency-increase-img"
                    />
                  </Button>
                </div>
              </div>
              <div
                style={{
                  width: "768px",
                  height: "2px",
                  background: "#ADADAD"
                }}
                data-oid="subscription-add-divider-3"
              />
              <div
                style={{
                  display: "flex",
                  width: "768px",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "18px"
                }}
                data-oid="subscription-add-action-row"
              >
                <Button
                  variant="ghost"
                  className="border border-transparent p-0"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "78px",
                    padding: "21px 22px",
                    borderRadius: "18.5px",
                    border: "3px solid #ADADAD",
                    background: "#FFF",
                    boxSizing: "border-box",
                    filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)"
                  }}
                  onClick={() => onNavigate("subscription")}
                  data-oid="subscription-add-action-cancel"
                >
                  <span
                    style={{
                      ...ACTION_BUTTON_TEXT_STYLE,
                      lineHeight: "normal"
                    }}
                  >
                    キャンセル
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  className="border border-transparent p-0"
                  style={{
                    ...ACTION_BUTTON_STYLE,
                    borderRadius: "20px",
                    border: "3px solid #FDA900",
                    boxShadow: "4.5px 4.5px 0 0 #E4E2E2"
                  }}
                  onClick={() => onNavigate("subscriptionList")}
                  data-oid="subscription-add-action-list"
                >
                  <span style={ACTION_BUTTON_TEXT_STYLE}>定期購入一覧へ</span>
                </Button>
                <Button
                  variant="ghost"
                  className="border border-transparent p-0"
                  style={{
                    ...ACTION_BUTTON_STYLE,
                    borderRadius: "20px",
                    border: "3px solid #FDA900",
                    boxShadow: "4.5px 4.5px 0 0 #E4E2E2"
                  }}
                  onClick={handleSave}
                  data-oid="subscription-add-action-save"
                >
                  <span style={ACTION_BUTTON_TEXT_STYLE}>保存して登録</span>
                </Button>
              </div>
            </div>
          ) : (
            <div data-oid="subscription-add-no-product">商品が選択されていません。</div>
          )}
          </div>
        </div>

      </div>
    </div>
  );
}
const ACTION_BUTTON_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "max-content",
  minWidth: "160px",
  height: "78px",
  padding: "21px 22px",
  flexShrink: 0,
  boxSizing: "border-box" as const,
  borderRadius: "20px",
  border: "2px solid #FDA900",
  background: "var(--, #FFF)",
  boxShadow: "4.5px 4.5px 0 0 #E4E2E2"
} as const;

const ACTION_BUTTON_TEXT_STYLE = {
  color: "var(--, #101010)",
  fontFamily: '"BIZ UDPGothic"',
  fontSize: "32px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "normal",
  letterSpacing: "1.664px"
} as const;
