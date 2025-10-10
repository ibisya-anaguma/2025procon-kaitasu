"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";

export default function CartPage() {
  const router = useRouter();
  const { cartItems, onUpdateProductQuantity } = useAppContext();

  const totalCartQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="qie1-gm">
      <div className="mx-auto" style={{ width: "970px" }} data-oid="-j93.-d">
        <h2 className="text-base font-bold mb-4" data-oid="gdwztq6">
          買い物かご
        </h2>

        <div className="space-y-3 mb-6" data-oid=":2r1yrd">
          {cartItems.map((item) => (
            <Card
              key={item.id}
              className="bg-white border-2 border-gray-200 rounded-lg flex flex-row items-center gap-[20px] px-6 py-4 w-[970px] h-[111px]"
              data-oid="5rgf5dd">
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
              <div className="flex items-center gap-[20px] pr-[62px]" data-oid="cart-right-group">
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
                      className="rounded bg-transparent"
                      style={{ width: "41px", height: "40px", flexShrink: 0 }}
                      onClick={() => onUpdateProductQuantity(item.id, -1)}
                      data-oid="g4qqy_k">
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
                      className="rounded bg-transparent"
                      style={{ width: "41px", height: "40px", flexShrink: 0 }}
                      onClick={() => onUpdateProductQuantity(item.id, 1)}
                      data-oid="4kc4n3t">
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

        <div className="border-t-2 border-gray-200 pt-4 mb-6" data-oid="lx.9fs:">
          <div className="flex justify-between text-base font-bold" data-oid="e-466ve">
            <span data-oid="qr0:wva">合計 {totalCartQuantity}点</span>
            <span data-oid="5tmrc4s">¥{totalCartPrice}</span>
          </div>
        </div>

        <div className="flex gap-3" data-oid="ufdhcq:">
          <Button
            variant="outline"
            className="flex-1 text-sm border-2 border-[#fda900] text-[#fda900] rounded-md bg-transparent"
            onClick={() => router.push("/order")}
            data-oid="8i_h.o.">
            注文確認
          </Button>
          <Button
            className="flex-1 bg-[#fda900] text-sm border-2 border-[#fda900] rounded-md hover:bg-[#fda900]/90"
            onClick={() => router.push("/catalog")}
            data-oid="mgchczd">
            買い物を続ける
          </Button>
        </div>
      </div>
    </div>
  );
}
