import { type RefObject, type CSSProperties } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Product } from "@/types/product";
import type { Screen } from "@/types/navigation";

const FILTER_BUTTONS = [
  { label: "健康重視", buttonDataOid: ".zvc9j.", textDataOid: "btn-text-health" },
  { label: "お気に入り", buttonDataOid: "jm:hia2", textDataOid: "btn-text-favorite" }
];

const FILTER_BUTTON_INACTIVE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "max-content",
  minWidth: "160px",
  height: "60px",
  padding: "0 24px",
  flexShrink: 0,
  borderRadius: "20px",
  border: "2px solid #FDA900",
  background: "var(--, #FFF)",
  boxShadow: "4.5px 4.5px 0 0 #E4E2E2"
};

const FILTER_BUTTON_TEXT_STYLE: CSSProperties = {
  color: "var(--, #101010)",
  fontFamily: '"BIZ UDPGothic"',
  fontSize: "32px",
  fontStyle: "normal",
  fontWeight: 700,
  lineHeight: "normal",
  letterSpacing: "1.664px"
};

type CatalogPageProps = {
  products: Product[];
  scrollRef: RefObject<HTMLDivElement>;
  onUpdateProductQuantity: (id: number, change: number) => void;
  quantitySum: number;
  priceSum: number;
  onNavigate: (screen: Screen) => void;
};

const CatalogPage = ({
  products,
  scrollRef,
  onUpdateProductQuantity,
  quantitySum,
  priceSum,
  onNavigate
}: CatalogPageProps) => (
  <div className="flex-1 bg-white p-6 ml-[232px] relative min-h-screen" data-oid="d95y1m5">
    <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#fda900]" data-oid="kh0_yce" />

    <div className="mx-auto w-[1000px]" data-oid="psedc55">
      <div className="relative mb-6" data-oid="gfk0oa_">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fda900]"
          size={18}
          data-oid="wum_nxs"
        />

        <Input
          placeholder="商品名で検索"
          className="pl-12 h-12 border-2 border-[#fda900] text-sm rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20"
          data-oid="fsk2zzr"
        />
      </div>

      <div className="flex gap-[25px] mb-6" data-oid="br-d9o3">
        {FILTER_BUTTONS.map(({ label, buttonDataOid, textDataOid }) => (
          <Button
            key={label}
            variant="ghost"
            className="border border-transparent p-0"
            style={FILTER_BUTTON_INACTIVE_STYLE}
            data-oid={buttonDataOid}>
            <span style={FILTER_BUTTON_TEXT_STYLE} data-oid={textDataOid}>
              {label}
            </span>
          </Button>
        ))}
      </div>

      <div className="relative mt-[23px] mb-[24px] w-[1000px]" data-oid="catalog-card-background">
        <div
          className="pointer-events-none absolute top-0 left-0 z-0 h-[507px] w-[1000px]"
          style={{
            borderRadius: "20px",
            background: "rgba(253, 169, 0, 0.5)"
          }}
          aria-hidden="true"
        />
        <div
          ref={scrollRef}
          className="relative z-10 h-[507px] w-[1000px] overflow-x-hidden overflow-y-auto pt-[18px] flex flex-col items-center"
          data-oid="uy6_dcp-wrapper">
          <div className="flex justify-center gap-[25px] mb-6" data-oid="uy6_dcp">
            <span
              className="flex items-center"
              style={{
                color: "var(--, #101010)",
                fontFamily: '"BIZ UDPGothic"',
                fontSize: "32px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "normal",
                letterSpacing: "1.664px"
              }}
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
              data-oid="f8qlkjv">
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
            data-oid="h7qwqv1">
            {products.map((product) => (
              <Card
                key={product.id}
                className="px-4 pt-1 pb-0 bg-white border-2 border-[#e0e0e0] rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col"
                style={{ width: "188px", height: "265px" }}
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
                  className="relative mb-[6.5px]"
                  style={{ height: "106px" }}
                  data-oid="8gipz64">
                  <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="h-full w-full object-cover rounded-lg"
                    data-oid="q.-_y:_"
                  />
                </div>
                <h4 className="text-sm font-bold" data-oid="d:mf1eo">
                  {product.name}
                </h4>
                <p className="hidden" data-oid="ms.1o9h">
                  {product.description}
                </p>
                <div className="flex flex-col items-center" data-oid="r7z2qp8">
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "20px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.04px",
                      alignSelf: "flex-start",
                      width: "100%",
                      display: "block",
                      marginTop: "12px"
                    }}
                    data-oid="eq4gt6a">
                    ¥{product.price}
                  </span>
                  <div
                    className="mt-[12px] flex w-full items-center justify-center gap-2"
                    data-oid="4z4g4a-">
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
                        data-oid="d7ycg-q"
                      />
                    </Button>
                    <div
                      className="flex items-center justify-center text-sm font-medium"
                      style={{
                        width: "73px",
                        height: "26px",
                        flexShrink: 0,
                        borderRadius: "5px",
                        border: "1px solid #FDA900",
                        background: "#FFF"
                      }}
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
                        data-oid="olbxiee"
                      />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div
        className="flex justify-between items-center bg-[#fda900] text-white p-4 rounded-xl border-2 border-[#fda900] shadow-md"
        data-oid="t2ub1nx">
        <span className="text-base font-bold" data-oid="5rigjnl">
          {quantitySum}点 ¥
          {priceSum}
        </span>
        <Button
          className="bg-white text-[#fda900] text-base font-bold px-8 h-11 border-2 border-white rounded-lg hover:bg-gray-50 shadow-sm"
          onClick={() => onNavigate("cart")}
          data-oid="b9c3xju">
          購入
        </Button>
      </div>
    </div>
  </div>
);

export default CatalogPage;
