"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Product, Screen } from "@/types/page";

type CartProps = {
  cartItems: Product[];
  onNavigate: (screen: Screen) => void;
  onUpdateProductQuantity: (id: number, change: number) => void;
  onAddFavoriteEntry: (product: Product) => void;
};

export function Cart({
  cartItems,
  onNavigate,
  onUpdateProductQuantity,
  onAddFavoriteEntry
}: CartProps) {
  const totalCartQuantity = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalCartPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="qie1-gm">
      <div
        className="mx-auto"
        style={{ width: "970px" }}
        data-oid="-j93.-d">
        <h2 className="text-base font-bold mb-4" data-oid="gdwztq6">
          買い物かご
        </h2>

        <div className="space-y-3 mb-6" data-oid=":2r1yrd">
          {cartItems.map((item) => (
            <Card
              key={item.id}
              className="bg-white border-2 border-gray-200 rounded-lg flex flex-row items-center gap-[20px] px-6 py-4 w-[970px] h-[111px]"
              data-oid="5rgf5dd"
            >
              <img
                src={item.image || "/placeholder.svg"}
                alt={item.name}
                className="object-cover rounded"
                style={{
                  width: "164.548px",
                  height: "109px",
                  flexShrink: 0,
                  aspectRatio: "164.55 / 109.00"
                }}
                data-oid="b0g5711"
              />

              <div className="flex-1 min-w-0" data-oid="yd66:be">
                <h4
                  style={{
                    color: "var(--, #101010)",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "24px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.248px",
                    width: "208px"
                  }}
                  className="truncate"
                  data-oid="5tlgvsv">
                  {item.name}
                </h4>
              </div>
              <div className="flex items-center gap-[20px] pr-[20px]" data-oid="cart-right-group">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 border-2 border-[#FDA900] rounded-[11.936px] bg-white px-4 py-2 shadow-[2.686px_2.686px_0_0_#E4E2E2]"
                  onClick={() => onAddFavoriteEntry(item)}
                  data-oid="cart-favorite-button">
                  <span
                    style={{
                      color: "#000",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "19.098px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "0.993px"
                    }}
                    data-oid="cart-favorite-text">
                    お気に入りに追加
                  </span>
                  <div
                    style={{
                      width: "25px",
                      height: "25px",
                      borderRadius: "6px",
                      background: "#FFF",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center"
                    }}
                    data-oid="cart-favorite-icon">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="22"
                      height="20"
                      viewBox="0 0 22 20"
                      fill="none">
                      <path
                        d="M11.2666 5.29155C11.2666 5.29155 11.2666 5.17797 10.4897 4.15576C9.59015 2.96999 8.26127 2.11133 6.66662 2.11133C4.1213 2.11133 2.06665 4.16598 2.06665 6.7113C2.06665 7.66196 2.35287 8.54106 2.84353 9.26683C3.67153 10.5037 11.2666 18.4668 11.2666 18.4668M11.2666 5.29155C11.2666 5.29155 11.2666 5.17797 12.0435 4.15576C12.943 2.96999 14.2719 2.11133 15.8666 2.11133C18.4119 2.11133 20.4665 4.16598 20.4665 6.7113C20.4665 7.66196 20.1803 8.54106 19.6896 9.26683C18.8616 10.5037 11.2666 18.4668 11.2666 18.4668"
                        stroke="#209FDE"
                        strokeWidth="2.30369"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </Button>
                <div className="flex flex-col items-center gap-1" data-oid="f:g9-vr">
                  <span
                    style={{
                      color: "var(--, #101010)",
                      textAlign: "center",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "24px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "150%",
                      letterSpacing: "1.248px"
                    }}
                    data-oid="3_9wxay">
                    数量
                  </span>
                  <div className="flex items-center gap-1" data-oid="zdp13dt">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded bg-transparent hover:bg-transparent focus:bg-transparent focus-visible:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                      style={{ width: "41px", height: "40px", flexShrink: 0 }}
                      onClick={() => onUpdateProductQuantity(item.id, -1)}
                      data-oid="g4qqy_k"
                    >
                      <Image
                        src="/images/mainasu.png"
                        alt="数量を減らす"
                        width={20}
                        height={20}
                        className="h-full w-full object-contain"
                        data-oid="2h.nwkc"
                      />
                    </Button>
                    <div
                      className="flex items-center justify-center"
                      style={{
                        minWidth: "73px",
                        height: "40px",
                        color: "var(--, #101010)",
                        textAlign: "center",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "150%",
                        letterSpacing: "1.248px"
                      }}
                      data-oid="weymacu">
                      {item.quantity}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded bg-transparent hover:bg-transparent focus:bg-transparent focus-visible:bg-transparent active:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                      style={{ width: "41px", height: "40px", flexShrink: 0 }}
                      onClick={() => onUpdateProductQuantity(item.id, 1)}
                      data-oid="4kc4n3t"
                    >
                      <Image
                        src="/images/plus.png"
                        alt="数量を増やす"
                        width={20}
                        height={20}
                        className="h-full w-full object-contain"
                        data-oid=".gef-yq"
                      />
                    </Button>
                  </div>
                </div>
                <div className="text-right" data-oid="8ke_pvk">
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "24px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.248px"
                    }}
                    data-oid="jo1znli">
                    ¥{item.price}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div
          className="border-t-2 border-gray-200 pt-4 mb-6"
          data-oid="lx.9fs:"
        >
          <div
            className="flex justify-between text-base font-bold"
            data-oid="e-466ve"
          >
            <span data-oid="qr0:wva">合計 {totalCartQuantity}点</span>
            <span data-oid="5tmrc4s">¥{totalCartPrice}</span>
          </div>
        </div>

        <div className="flex gap-3" data-oid="ufdhcq:">
          <Button
            variant="outline"
            className="flex-1 text-sm border-2 border-[#fda900] text-[#fda900] rounded-md bg-transparent"
            onClick={() => onNavigate("order")}
            data-oid="8i_h.o."
          >
            注文確認
          </Button>
          <Button
            className="flex-1 bg-[#fda900] text-sm border-2 border-[#fda900] rounded-md hover:bg-[#fda900]/90"
            onClick={() => onNavigate("catalog")}
            data-oid="mgchczd"
          >
            買い物を続ける
          </Button>
        </div>
      </div>
    </div>
  );
}
