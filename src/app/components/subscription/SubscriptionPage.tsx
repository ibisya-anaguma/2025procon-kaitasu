"use client";

import { type RefObject } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Product } from "@/types/product";

type SubscriptionPageProps = {
  products: Product[];
  scrollRef: RefObject<HTMLDivElement>;
};

const SubscriptionPage = ({ products, scrollRef }: SubscriptionPageProps) => {
  const router = useRouter();
  return (
  <div className="flex-1 bg-white p-6 ml-[232px] relative min-h-screen" data-oid="subscription-page">
    <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#fda900]" data-oid="subscription-accent" />

    <div className="mx-auto w-[1000px]" data-oid="subscription-content">
      <div className="relative mb-6" data-oid="subscription-search">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fda900]"
          size={18}
          data-oid="subscription-search-icon"
        />

        <Input
          placeholder="商品名で検索"
          className="pl-12 h-12 border-2 border-[#fda900] text-sm rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20"
          data-oid="subscription-search-input"
        />
      </div>

      <div className="relative mt-[23px] mb-[24px] w-[1000px]" data-oid="subscription-card-background">
        <div
          className="pointer-events-none absolute top-0 left-0 z-0 h-[662px] w-[1000px]"
          style={{
            borderRadius: "20px",
            background: "rgba(253, 169, 0, 0.5)"
          }}
          aria-hidden="true"
        />
        <div
          ref={scrollRef}
          className="relative z-10 h-[662px] w-[1000px] overflow-x-hidden overflow-y-auto pt-[18px] flex flex-col items-center"
          data-oid="subscription-card-wrapper">
          <div className="flex justify-center gap-[25px] mb-6" data-oid="subscription-pagination">
            {[1, 2, 3, 4, 5].map((num) => {
              const isActive = num === 1;
              return (
                <Button
                  key={`subscription-page-${num}`}
                  size="sm"
                  variant="ghost"
                  className="border border-transparent p-0"
                  style={{
                    display: "flex",
                    width: "60px",
                    height: "60px",
                    padding: "14px 19px",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "10px",
                    flexShrink: 0,
                    borderRadius: "20px",
                    background: isActive ? "var(--, #FDA900)" : "var(--, #FFF)",
                    backgroundColor: isActive ? "#FDA900" : "#FFF",
                    boxShadow: isActive
                      ? "0 4px 4px 0 rgba(0, 0, 0, 0.25) inset"
                      : "0 4px 4px 0 rgba(0, 0, 0, 0.25)",
                    color: "var(--, #101010)",
                    fontFamily: '"BIZ UDPGothic"',
                    fontSize: "32px",
                    fontStyle: "normal",
                    fontWeight: 700,
                    lineHeight: "normal",
                    letterSpacing: "1.664px"
                  }}
                  data-oid={`subscription-page-button-${num}`}>
                  {num}
                </Button>
              );
            })}
            <span className="text-sm self-center font-medium" data-oid="subscription-pagination-ellipsis">
              ...
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="border border-transparent p-0"
              style={{
                display: "flex",
                width: "60px",
                height: "60px",
                padding: "14px 19px",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "10px",
                borderRadius: "20px",
                background: "var(--, #FFF)",
                backgroundColor: "#FFF",
                boxShadow: "0 4px 4px 0 rgba(0, 0, 0, 0.25)",
                color: "var(--, #101010)",
                fontFamily: '"BIZ UDPGothic"',
                fontSize: "32px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "normal",
                letterSpacing: "1.664px"
              }}
              data-oid="subscription-pagination-last">
              15
            </Button>
          </div>

          <div
            className="grid grid-cols-4 gap-y-4"
            style={{
              columnGap: "45px",
              gridTemplateColumns: "repeat(4, 188px)",
              justifyItems: "start"
            }}
            data-oid="subscription-card-grid">
            {products.map((product) => (
              <Card
                key={`subscription-${product.id}`}
                className="px-4 pt-1 pb-0 bg-white border-2 border-[#e0e0e0] rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col"
                style={{ width: "188px", height: "265px" }}
                data-oid="subscription-card">
                <div className="flex justify-end mb-2" data-oid="subscription-heart-row">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="34"
                    height="31"
                    viewBox="0 0 34 31"
                    fill="none"
                    data-oid="subscription-heart">
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
                  className="relative mb-[6.5px]"
                  style={{ height: "106px" }}
                  data-oid="subscription-image">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="h-full w-full object-cover rounded-lg"
                    data-oid="subscription-image-img"
                  />
                </div>
                <h4 className="text-sm font-bold" data-oid="subscription-name">
                  {product.name}
                </h4>
                <p className="hidden" data-oid="subscription-description">
                  {product.description}
                </p>
                <div className="flex flex-col gap-0" data-oid="subscription-price-wrapper">
                  <div
                    className="w-full"
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "20px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.04px",
                      marginTop: "12px",
                      marginBottom: "4px"
                    }}
                    data-oid="subscription-price">
                    ¥{product.price}
                  </div>
                  <div className="flex w-full justify-center" data-oid="subscription-favorite-wrapper">
                    <Button
                      variant="ghost"
                      className="p-0 bg-transparent hover:bg-transparent"
                      onClick={() => router.push("/subscription/add")}
                      data-oid="subscription-favorite-button">
                      <Image
                        src="/images/favorite.png"
                        alt="お気に入りに追加"
                        width={152}
                        height={36}
                        className="h-[36px] w-[152px] object-contain"
                        data-oid="subscription-favorite-img"
                      />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default SubscriptionPage;
