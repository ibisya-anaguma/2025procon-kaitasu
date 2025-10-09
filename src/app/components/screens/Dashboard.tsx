"use client";

import { SidebarCatalogIcon, SidebarHistoryIcon, SidebarProfileIcon, SidebarSubscriptionIcon } from "@/components/icons/sidebar-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Screen } from "@/types/page";

type DashboardProps = {
  monthlyBudget: number;
  onNavigate: (screen: Screen) => void;
};

export function Dashboard({ monthlyBudget, onNavigate }: DashboardProps) {
  return (
    <div
      className="flex-1 bg-white p-6 ml-[232px] min-h-screen"
      data-oid="ysuosjy">

      <div
        className="mx-auto w-[903px] space-y-4"
        data-oid=":xr07ip">

        {/* Notification Card */}
        <Card
          className="w-[903px] p-4"
          style={{
            borderRadius: "14.469px",
            border: "5px solid var(--primary, #FDA900)",
            background: "var(--card, #FFF)"
          }}
          data-oid="2bp9lo4">

          <h3
          className="text-center font-medium mb-3 text-sm"
          data-oid="aek175l">

            お知らせ
          </h3>
          <div className="h-12 bg-[#adadad] rounded" data-oid="v_esgva"></div>
        </Card>

        {/* Budget Card */}
        <Card
          className="w-[903px] h-[230px] p-4 gap-[9px]"
          style={{
            borderRadius: "14.469px",
            border: "5px solid var(--primary, #FDA900)",
            background: "var(--card, #FFF)"
          }}
          data-oid="t2fyzfc">

          <div
          className="flex justify-between  items-smart mt-[7px] mb-2"
          data-oid=":be0a2k">

            <span className="text-sm font-medium text-[30px]" data-oid=":6v2jl-">
              今月の予算 ▶
            </span>
            <div className="flex items-baseline gap-2 mt-[29px] mr-[81px] self-end" data-oid="qq2w-88">
              <span className="font-bold text-lg text-[20px]">残り</span>
              <span className="font-bold text-[36px] leading-none">
                ¥{monthlyBudget.toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
          <div className="flex w-[703px] justify-between mb-[7px] mt-[9px]" data-oid="h3m4f7m">
            <div className="text-xs text-[#adadad] text-[20px]" data-oid="woecoz3">
              ¥12,500
            </div>
            <div className="flex" data-oid="h3m4f7m">
              <div className="text-xs text-right text-[#209fde] text-[20px]" data-oid="6x91r4a">
                使用率:
              </div>
              <div className="text-xs text-right text-[#101010] text-[20px]" data-oid="6x91r4a">
                60%
              </div>
            </div>
          </div>
          <div
          className="w-[744px] bg-[#adadad] rounded-full h-[34px] mb-1 mx-auto"
          data-oid="pk6di4e">

            <div
            className="bg-[#209fde] h-[34px] rounded-full"
            style={{ width: "60%" }}
            data-oid="5_0shjj">
          </div>
          </div>
        </Card>

        <div className="mx-auto flex justify-center gap-[61px] w-[903px]" data-oid="ta8f1it">
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative"
            style={{
              filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)"
            }}
            onClick={() => onNavigate("catalog")}
            data-oid="6g1e2.x">

            <div className="flex h-[145px] flex-col items-center justify-between">
              <span
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal"
              data-oid="1417ieu">

                買い出し
              </span>
              <div className="flex w-full justify-center">
                <div style={{ width: "126px", height: "126px" }}>
                  <SidebarCatalogIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative"
            style={{
              filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)"
            }}
            onClick={() => onNavigate("subscription")}
            data-oid="eljule7">

            <div className="flex h-[145px] flex-col items-center justify-between">
              <span
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal"
              data-oid="_8lynit">

                定期購入の確認
              </span>

              <div className="flex w-full justify-center">
                <div style={{ width: "110px", height: "110px", padding: "10px" }}>
                  <SidebarSubscriptionIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative"
            style={{
              filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)"
            }}
            onClick={() => onNavigate("history")}
            data-oid="vhz4ae4">

            <div className="flex h-[145px] flex-col items-center justify-between">
              <span
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal"
              data-oid="pu-k0wb">

                購入履歴
              </span>

              <div className="flex w-full justify-center">
                <div style={{ width: "91px", height: "91px" }}>
                  <SidebarHistoryIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative"
            style={{
              filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)"
            }}
            onClick={() => onNavigate("profile")}
            data-oid="oodndhw">

            <div className="flex h-[145px] flex-col items-center justify-between">
              <span
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal"
              data-oid="5s21wmk">

                マイページ
              </span>

              <div className="flex w-full justify-center">
                <div
                style={{
                  width: "65.386px",
                  height: "84.068px",
                  flexShrink: 0
                }}>
                  <SidebarProfileIcon fill="#209fde" stroke="#209fde" />
                </div>
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}


