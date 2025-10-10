"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// サンプルデータ（実際のAPIからのデータに置き換える必要があります）
const sampleHistoryItems = [
  {
    id: 1,
    date: "2025年9月1日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 1,
    price: 350,
  },
  {
    id: 2,
    date: "2025年9月1日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 2,
    price: 350,
  },
  {
    id: 3,
    date: "2025年8月28日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 1,
    price: 350,
  },
  {
    id: 4,
    date: "2025年8月28日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 3,
    price: 350,
  },
  {
    id: 5,
    date: "2025年8月25日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 1,
    price: 350,
  },
  {
    id: 6,
    date: "2025年8月25日",
    name: "トップバリュ 特製",
    image: "/images/food-item.jpg",
    quantity: 2,
    price: 350,
  },
];

export function History() {
  const handleAddToFavorites = (item: typeof sampleHistoryItems[0]) => {
    // お気に入り追加の処理（後で実装）
    console.log("お気に入りに追加:", item.name);
  };

  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="n3s1kmy">
      <div
        className="mx-auto"
        style={{ width: "970px" }}
        data-oid="me-dwvn">
        <h2 className="text-base font-bold mb-4" data-oid="x::kret">
          購入履歴
        </h2>

        <div className="space-y-3" data-oid="4c1ea9l">
          {sampleHistoryItems.map((item) => (
            <Card
              key={item.id}
              className="bg-white border-2 border-gray-200 rounded-lg flex flex-row items-center gap-[20px] px-6 py-4 w-[970px] h-[111px]"
              data-oid="history-card">
              <div
                className="flex flex-col justify-center items-start"
                style={{
                  minWidth: "80px",
                  color: "var(--, #101010)",
                  fontFamily: '"BIZ UDPGothic"',
                  fontSize: "16px",
                  fontStyle: "normal",
                  fontWeight: 700,
                  lineHeight: "normal",
                  letterSpacing: "0.832px"
                }}
                data-oid="history-date">
                <div>{item.date.split("年")[0]}年</div>
                <div>{item.date.split("年")[1]}</div>
              </div>

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
                data-oid="history-image"
              />

              <div className="flex-1 min-w-0" data-oid="history-name-container">
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
                  data-oid="history-name">
                  {item.name}
                </h4>
              </div>

              <div className="flex items-center gap-[20px] pr-[20px]" data-oid="history-right-group">
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 border-2 border-[#FDA900] rounded-[11.936px] bg-white px-4 py-2 shadow-[2.686px_2.686px_0_0_#E4E2E2]"
                  onClick={() => handleAddToFavorites(item)}
                  data-oid="history-favorite-button">
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
                    data-oid="history-favorite-text">
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
                    data-oid="history-favorite-icon">
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

                <div className="flex flex-col items-center gap-1" data-oid="history-quantity-container">
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
                    data-oid="history-quantity-label">
                    数量
                  </span>
                  <div
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
                    data-oid="history-quantity-value">
                    {item.quantity}
                  </div>
                </div>

                <div className="text-right" data-oid="history-price-container">
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
                    data-oid="history-price">
                    ¥{item.price}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
