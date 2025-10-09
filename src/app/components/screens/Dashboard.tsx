"use client";

import { SidebarCatalogIcon, SidebarHistoryIcon, SidebarProfileIcon, SidebarSubscriptionIcon } from "@/components/icons/sidebar-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Screen } from "@/types/page";
import type { CSSProperties, ReactNode } from "react";

const STRINGS = {
  notification: "\u304a\u77e5\u3089\u305b",
  monthlyBudgetTitle: "\u4eca\u6708\u306e\u4e88\u7b97",
  remaining: "\u6b8b\u308a",
  usageRate: "\u4f7f\u7528\u7387",
  shopping: "\u8cb7\u3044\u51fa\u3057",
  subscriptionCheck: "\u5b9a\u671f\u8cfc\u5165\u306e\u78ba\u8a8d",
  purchaseHistory: "\u8cfc\u5165\u5c65\u6b74",
  myPage: "\u30de\u30a4\u30da\u30fc\u30b8"
} as const;

const YEN = "\u00a5";

type DashboardProps = {
  monthlyBudget: number;
  onNavigate: (screen: Screen) => void;
};

export function Dashboard({ monthlyBudget, onNavigate }: DashboardProps) {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen" data-oid="ysuosjy">
      <div className="mx-auto w-[903px] space-y-4" data-oid=":xr07ip">
        <Card
          className="w-[903px] p-4"
          style={{
            borderRadius: "14.469px",
            border: "5px solid var(--primary, #FDA900)",
            background: "var(--card, #FFF)"
          }}
          data-oid="2bp9lo4"
        >
          <h3 className="text-center font-medium mb-3 text-sm" data-oid="aek175l">
            {STRINGS.notification}
          </h3>
          <div className="h-12 bg-[#adadad] rounded" data-oid="v_esgva"></div>
        </Card>

        <Card
          className="w-[903px] h-[230px] p-4 gap-[9px]"
          style={{
            borderRadius: "14.469px",
            border: "5px solid var(--primary, #FDA900)",
            background: "var(--card, #FFF)"
          }}
          data-oid="t2fyzfc"
        >
          <div className="flex justify-between items-center mt-[7px] mb-2" data-oid=":be0a2k">
            <span className="text-sm font-medium text-[30px]" data-oid=":6v2jl-">
              {STRINGS.monthlyBudgetTitle}
            </span>
            <div className="flex items-baseline gap-2 mt-[29px] mr-[81px] self-end" data-oid="qq2w-88">
              <span className="font-bold text-lg text-[20px]">{STRINGS.remaining}</span>
              <span className="font-bold text-[36px] leading-none">
                {YEN}
                {monthlyBudget.toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
          <div className="flex w-[703px] justify-between mb-[7px] mt-[9px]" data-oid="h3m4f7m">
            <div className="text-xs text-[#adadad] text-[20px]" data-oid="woecoz3">
              {YEN}12,500
            </div>
            <div className="flex" data-oid="h3m4f7m">
              <div className="text-xs text-right text-[#209fde] text-[20px]" data-oid="6x91r4a">
                {STRINGS.usageRate}
              </div>
              <div className="text-xs text-right text-[#101010] text-[20px]" data-oid="6x91r4a">
                60%
              </div>
            </div>
          </div>
          <div className="w-[744px] bg-[#adadad] rounded-full h-[34px] mb-1 mx-auto" data-oid="pk6di4e">
            <div
              className="bg-[#209fde] h-[34px] rounded-full"
              style={{ width: "60%" }}
              data-oid="5_0shjj"
            ></div>
          </div>
        </Card>

        <div className="mx-auto flex justify-center gap-[61px] w-[903px]" data-oid="ta8f1it">
          <DashboardShortcut
            label={STRINGS.shopping}
            onClick={() => onNavigate("catalog")}
            icon={<SidebarCatalogIcon fill="#209fde" stroke="#209fde" />}
            iconWrapperStyle={{ width: "126px", height: "126px" }}
          />
          <DashboardShortcut
            label={STRINGS.subscriptionCheck}
            onClick={() => onNavigate("subscription")}
            icon={<SidebarSubscriptionIcon fill="#209fde" stroke="#209fde" />}
            iconWrapperStyle={{ width: "110px", height: "110px", padding: "10px" }}
          />
          <DashboardShortcut
            label={STRINGS.purchaseHistory}
            onClick={() => onNavigate("history")}
            icon={<SidebarHistoryIcon fill="#209fde" stroke="#209fde" />}
            iconWrapperStyle={{ width: "91px", height: "91px" }}
          />
          <DashboardShortcut
            label={STRINGS.myPage}
            onClick={() => onNavigate("profile")}
            icon={<SidebarProfileIcon fill="#209fde" stroke="#209fde" />}
            iconWrapperStyle={{ width: "65.386px", height: "84.068px" }}
          />
        </div>
      </div>
    </div>
  );
}

type ShortcutProps = {
  label: string;
  icon: ReactNode;
  iconWrapperStyle?: CSSProperties;
  onClick: () => void;
};

function DashboardShortcut({ label, icon, iconWrapperStyle, onClick }: ShortcutProps) {
  return (
    <Button
      variant="outline"
      className="w-[180px] h-[180px] text-center border-[5px] border-[#fda900] bg-white hover:bg-gray-50 rounded-[20px] flex-col px-6 pb-6 pt-[17px] relative"
      style={{ filter: "drop-shadow(4.5px 4.5px 0 #E4E2E2)" }}
      onClick={onClick}
    >
      <div className="flex h-[145px] flex-col items-center justify-between">
        <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[20px] font-bold leading-normal">
          {label}
        </span>
        <div className="flex w-full justify-center">
          <div style={{ ...iconWrapperStyle }}>{icon}</div>
        </div>
      </div>
    </Button>
  );
}
