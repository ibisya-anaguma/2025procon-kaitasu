"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_STYLE, FILTER_BUTTON_TEXT_STYLE } from "@/components/screens/filterStyles";
import type { Screen } from "@/types/page";

type ProfileProps = {
  profilePage: number;
  totalProfilePages: number;
  onPageChange: (page: number) => void;
  monthlyBudget: number;
  onMonthlyBudgetChange: (value: number) => void;
  onNavigate: (screen: Screen) => void;
};

export function Profile({
  profilePage,
  totalProfilePages,
  onPageChange,
  monthlyBudget,
  onMonthlyBudgetChange,
  onNavigate
}: ProfileProps) {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="3pchgx4">
      <div className="flex flex-col items-center gap-4" data-oid=":530dgu">

        <Card
        className="flex flex-col gap-6 p-6"
        style={{
          width: "900px",
          height: "633px",
          flexShrink: 0,
          borderRadius: "14.469px",
          border: "5px solid #FDA900",
          backgroundColor: "#FFF"
        }}
        data-oid="profile-main-card">

          <div className="flex items-center gap-3" data-oid="mhd5qso">
            {profilePage === 1 ? (
              <>
                <div
                  className="w-12 h-12 bg-[#adadad] rounded-full"
                  data-oid="v96ohmr">
                </div>
                <div data-oid="w32:5lp" className="flex items-center gap-4">
                <div className="flex items-baseline gap-1" data-oid="2y3hjo1">
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: "BIZ UDPGothic",
                      fontSize: "36px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal"
                    }}
                  >
                    水口 和佳
                  </span>
                  <span
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: "BIZ UDPGothic",
                      fontSize: "24px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal"
                    }}
                  >
                    さん
                  </span>
                </div>
                  <Button
                    variant="ghost"
                    className="border border-transparent p-0"
                    style={FILTER_BUTTON_INACTIVE_STYLE}
                    data-oid="541gvwr">
                    <span style={FILTER_BUTTON_TEXT_STYLE}>
                      名前を変更
                    </span>
                  </Button>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex-1 w-full" data-oid="o4a2j0u">
            {profilePage === 1 ? (
              <div className="space-y-6" data-oid="profile-page-one">
                <div>
                  <h3
                    className="mb-3"
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "36px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.872px"
                    }}
                    data-oid="xkxxiap">
                    今月の予算
                  </h3>
                  <div className="space-y-3" data-oid="prr6v6o">
                    <div data-oid="zve5:m0">
                      <div className="flex items-center gap-2" data-oid="lirbdor">
                        <span className="text-sm" data-oid="zr1baos">
                          ¥
                        </span>
                        <Input
                          type="number"
                          value={monthlyBudget}
                          onChange={(e) => onMonthlyBudgetChange(Number(e.target.value))}
                          className="flex-1 text-sm border-2 border-gray-300 rounded-md"
                          data-oid="_x89egx"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3
                    className="mb-3"
                    style={{
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "36px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.872px"
                    }}
                    data-oid="calc-period-label">
                    計算期間
                  </h3>
                  <div className="flex flex-wrap" style={{ gap: "37px" }} data-oid="calc-period-buttons">
                    {[1, 5, 10, 15, 20, 25].map((num) => (
                      <Button
                        key={`calc-period-${num}`}
                        variant="ghost"
                        className="border border-transparent p-0"
                        style={{
                          ...FILTER_BUTTON_INACTIVE_STYLE,
                          width: "180px",
                          minWidth: "180px",
                          height: "63px"
                        }}
                        data-oid={`calc-period-${num}`}>
                        <span style={FILTER_BUTTON_TEXT_STYLE}> 毎月{num}日</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex h-full items-start"
                data-oid="profile-page-two">
                <div className="flex flex-col items-start gap-8 w-full max-w-[520px]" data-oid="profile-page-two-content">
                  <div className="flex flex-col items-start gap-6" data-oid="profile-page-two-subsection">
                    <p
                      style={{
                        color: "var(--, #101010)",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "normal",
                        letterSpacing: "1.248px"
                      }}
                      data-oid="profile-page-two-title">
                      定期購入の確認
                    </p>
                    <Button
                      variant="ghost"
                      className="border border-transparent p-0"
                      style={FILTER_BUTTON_INACTIVE_STYLE}
                      onClick={() => onNavigate("subscriptionList")}
                      data-oid="profile-page-two-button">
                      <span style={FILTER_BUTTON_TEXT_STYLE}>定期購入の確認</span>
                    </Button>
                  </div>
                  <div className="flex flex-col items-start gap-6" data-oid="profile-page-two-favorite-subsection">
                    <p
                      style={{
                        color: "var(--, #101010)",
                        fontFamily: '"BIZ UDPGothic"',
                        fontSize: "24px",
                        fontStyle: "normal",
                        fontWeight: 700,
                        lineHeight: "normal",
                        letterSpacing: "1.248px"
                      }}
                      data-oid="profile-page-two-favorite-title">
                      お気に入り登録の確認
                    </p>
                    <Button
                      variant="ghost"
                      className="border border-transparent p-0"
                      style={FILTER_BUTTON_INACTIVE_STYLE}
                      onClick={() => onNavigate("favoriteList")}
                      data-oid="profile-page-two-favorite-button">
                      <span style={FILTER_BUTTON_TEXT_STYLE}>お気に入り一覧へ</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
          className="mt-auto flex flex-col items-center gap-[24px]"
          data-oid="profile-pagination-wrapper">
            <div
            className="flex items-center justify-center gap-[25px]"
            data-oid="profile-pagination">
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
              data-oid="profile-page-label">
                ページ
              </span>
              {Array.from({ length: totalProfilePages }, (_, i) => i + 1).map((num) => {
                const isActive = num === profilePage;
                return (
                  <Button
                    key={`profile-page-${num}`}
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
                      boxShadow: isActive ?
                        "0 4px 4px 0 rgba(0, 0, 0, 0.25) inset" :
                        "0 4px 4px 0 rgba(0, 0, 0, 0.25)",
                      color: "var(--, #101010)",
                      fontFamily: '"BIZ UDPGothic"',
                      fontSize: "32px",
                      fontStyle: "normal",
                      fontWeight: 700,
                      lineHeight: "normal",
                      letterSpacing: "1.664px"
                    }}
                    onClick={() => onPageChange(num)}
                    data-oid={`profile-page-${num}`}>
                    {num}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
