"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_STYLE, FILTER_BUTTON_TEXT_STYLE } from "@/components/screens/filterStyles";
import type { LandingCardContent, Screen } from "@/types/page";

const LANDING_FILTER_BUTTONS = [
  { label: "健康重視", buttonDataOid: ".zvc9j.", textDataOid: "btn-text-health" },
  { label: "お気に入り", buttonDataOid: "jm:hia2", textDataOid: "btn-text-favorite" }
];

type CatalogLandingProps = {
  landingPage: number;
  totalLandingPages: number;
  onLandingPageChange: (page: number) => void;
  onNavigate: (screen: Screen) => void;
  currentLandingCards: LandingCardContent[];
};

export function CatalogLanding({
  landingPage,
  totalLandingPages,
  onLandingPageChange,
  onNavigate,
  currentLandingCards
}: CatalogLandingProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);

  const handleCardToggle = (index: number) => {
    setSelectedCards((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen"
      data-oid="catalog-landing">

      <div className="mx-auto w-[1000px]">
        <div className="relative mb-6" data-oid="catalog-landing-search">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#fda900]"
            size={18}
            data-oid="catalog-landing-search-icon"
          />

          <Input
            placeholder="商品名で検索"
            className="pl-12 h-12 border-2 border-[#fda900] text-sm rounded-lg bg-white shadow-sm focus:border-[#209fde] focus:ring-2 focus:ring-[#209fde]/20"
            data-oid="catalog-landing-search-input"
          />
        </div>

        <div className="flex gap-[25px] mb-6" data-oid="catalog-landing-filters">
          {LANDING_FILTER_BUTTONS.map(({ label, buttonDataOid, textDataOid }) => (
            <Button
              key={`${label}-landing`}
              variant="ghost"
              className="border border-transparent p-0"
              style={FILTER_BUTTON_INACTIVE_STYLE}
              data-oid={`${buttonDataOid}-landing`}>
              <span style={FILTER_BUTTON_TEXT_STYLE} data-oid={`${textDataOid}-landing`}>
                {label}
              </span>
            </Button>
          ))}
        </div>

        <div
        className="relative mt-[23px] mb-[24px] w-[1000px]"
        data-oid="catalog-landing-card-background">
          <div
          className="pointer-events-none absolute top-0 left-0 z-0 h-[507px] w-[1000px]"
          style={{
            borderRadius: "20px",
            background: "rgba(253, 169, 0, 0.5)"
          }}
          aria-hidden="true"
          />
          <div
          className="relative z-10 h-[507px] w-[1000px] overflow-hidden pt-[18px] flex flex-col items-center gap-[36px]"
          data-oid="catalog-landing-pagination-wrapper">
            <div
            className="flex items-center justify-center gap-[25px]"
            data-oid="catalog-landing-pagination">
              <span
              style={{
                color: "var(--, #101010)",
                fontFamily: '"BIZ UDPGothic"',
                fontSize: "32px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "normal",
                letterSpacing: "1.664px"
              }}
              data-oid="catalog-landing-page-label">
                ページ
              </span>
              {Array.from({ length: totalLandingPages }, (_, i) => i + 1).map((num) => {
                const isActive = num === landingPage;
                return (
                  <Button
                    key={`landing-page-${num}`}
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
                    onClick={() => onLandingPageChange(num)}
                    data-oid={`catalog-landing-page-${num}`}>
                    {num}
                  </Button>
                );
              })}
            </div>
            <div
            className="grid grid-cols-4"
            style={{ gap: "45px" }}
            data-oid="catalog-landing-card-grid">
              {currentLandingCards.map((card, index) => {
                const Icon = card.renderIcon;
                const isSelected = selectedCards.includes(index);

                return (
                  <Button
                    key={`landing-card-${landingPage}-${index}`}
                    variant="ghost"
                    className="relative flex h-[160px] w-[160px] flex-col items-center pt-[13px] border border-transparent p-0 transition-colors duration-200 hover:bg-[#fda900]/20"
                    onClick={() => handleCardToggle(index)}
                    data-oid={`catalog-landing-card-${index}`}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="165"
                      height="165"
                      viewBox="0 0 165 165"
                      fill="none"
                      className="absolute inset-0"
                      data-oid={`catalog-landing-card-svg-${index}`}>
                      <g filter="url(#catalog-card-filter)">
                        <rect width="160" height="160" rx="13.3333" fill="#FDA900" />
                        <rect x="4.44434" y="4.44434" width="151.111" height="151.111" rx="10" fill="white" />
                      </g>
                      <defs>
                        <filter id="catalog-card-filter" x="0" y="0" width="164.5" height="164.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                          <feFlood floodOpacity="0" result="BackgroundImageFix" />
                          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                          <feOffset dx="4.5" dy="4.5" />
                          <feComposite in2="hardAlpha" operator="out" />
                          <feColorMatrix type="matrix" values="0 0 0 0 0.895207 0 0 0 0 0.887003 0 0 0 0 0.887003 0 0 0 1 0" />
                          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3977_578" />
                          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3977_578" result="shape" />
                        </filter>
                      </defs>
                    </svg>
                    {isSelected && (
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center"
                        data-oid={`catalog-landing-card-selected-${index}`}>
                        <div
                          style={{
                            width: "100px",
                            height: "40px",
                            flexShrink: 0,
                            borderRadius: "10px",
                            background: "#FDA900",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}>
                          <span
                            style={{
                              color: "#FFF",
                              fontFamily: '"BIZ UDPGothic"',
                              fontSize: "24px",
                              fontStyle: "normal",
                              fontWeight: 700,
                              lineHeight: "normal",
                              letterSpacing: "1.248px"
                            }}>
                            選択中
                          </span>
                        </div>
                      </div>
                    )}
                    <div
                      className="relative z-10 flex h-full w-full flex-col items-center pt-[13px]"
                      data-oid={`catalog-landing-card-content-${index}`}>
                      <span
                      style={{
                        color: "var(--, #101010)",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "24px",
                        letterSpacing: "1.248px"
                      }}
                      data-oid={`catalog-landing-card-title-${index}`}>
                        {card.title}
                      </span>
                      <div className="flex w-full flex-1 items-center justify-center pt-[13px]">
                        {Icon ? (
                          <div
                          className="flex h-[100px] w-[100px] items-center justify-center"
                          data-oid={`catalog-landing-card-icon-${index}`}>
                            <Icon />
                          </div>
                        ) : (
                          <div
                          className="h-[100px] w-[100px] rounded-lg border border-dashed border-[#cfcfcf] bg-[#f5f5f5]"
                          data-oid={`catalog-landing-card-icon-${index}`}
                          />
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end" data-oid="catalog-landing-next-wrapper">
        <Button
          variant="ghost"
          className="border border-transparent p-0"
          style={{
            borderRadius: "20px",
            border: "3px solid #FDA900",
            background: "#FFF",
            boxShadow: "4.5px 4.5px 0 0 #E4E2E2",
            width: "150px",
            height: "60px",
            flexShrink: 0
          }}
          onClick={() => onNavigate("catalog")}
          data-oid="catalog-landing-next-button">
          <span
            style={{
              color: "#000",
              fontFamily: '"BIZ UDPGothic"',
              fontSize: "32px",
              fontStyle: "normal",
              fontWeight: 700,
              lineHeight: "normal",
              letterSpacing: "1.664px"
            }}>
            次へ
          </span>
        </Button>
      </div>
    </div>
  );
}
