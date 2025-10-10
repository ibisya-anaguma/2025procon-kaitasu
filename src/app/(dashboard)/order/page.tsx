"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import type { Screen } from "@/types/page";

function screenToPath(screen: Screen): string | null {
  switch (screen) {
    case "dashboard":
      return "/";
    case "catalog":
      return "/catalog";
    case "catalogLanding":
      return "/catalog-landing";
    case "cart":
      return "/cart";
    case "order":
      return "/order";
    case "history":
      return "/history";
    case "profile":
      return "/profile";
    case "subscription":
      return "/subscription";
    case "subscriptionAdd":
      return "/subscription/add";
    case "subscriptionList":
      return "/subscription/list";
    default:
      return null;
  }
}

export default function OrderPage() {
  const router = useRouter();
  const { onNavigate: setScreen } = useAppContext();

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };
  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center" data-oid="syv6qb8">
      <div className="w-[900px]" data-oid="9cyq3uk">
        <h2 className="text-[36px] font-bold mb-6 text-[#101010] font-['BIZ_UDPGothic']" data-oid="ycsxz70">
          注文確認
        </h2>

        {/* Delivery Address */}
        <Card
        className="p-6 mb-6 bg-white border-[3px] border-[#FDA900] rounded-[14.469px]"
        data-oid="jk:2_ry">

          <div className="flex items-start justify-between" data-oid="ih9dsxw">
            <div data-oid="r6l2mt0">
              <h3
              className="font-bold mb-3 text-[24px] flex items-center text-[#101010] font-['BIZ_UDPGothic']"
              data-oid="fp4z1m-">

                <span className="mr-3 text-[28px]" data-oid="qyv7-tr">
                  📍
                </span>
                配達先
              </h3>
              <p className="text-[20px] mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="itribae">
                徳島県鳴門市○○○
              </p>
              <p className="text-[20px] text-[#101010] font-['BIZ_UDPGothic']" data-oid=".5ob1_r">
                西口○○
              </p>
            </div>
            <Button
            className="bg-[#FDA900] text-white text-[18px] px-6 py-3 border-2 border-[#FDA900] rounded-lg hover:bg-[#FDA900]/90 font-['BIZ_UDPGothic'] font-bold"
            data-oid="5zhtpvt">

              変更
            </Button>
          </div>
        </Card>

        {/* Order Summary */}
        <Card
        className="p-6 mb-6 bg-white border-[3px] border-[#FDA900] rounded-[14.469px]"
        data-oid="8zvem9v">

          <div className="space-y-3" data-oid=":x26-uf">
            <div className="flex justify-between text-[22px] font-['BIZ_UDPGothic']" data-oid="0qqfqwa">
              <span className="text-[#101010]" data-oid="s1w10pe">小計</span>
              <span className="font-bold text-[#101010]" data-oid="vizf-74">¥5,000</span>
            </div>
            <div className="flex justify-between text-[22px] font-['BIZ_UDPGothic']" data-oid="u9:dvh7">
              <span className="text-[#101010]" data-oid="-7g8x72">配送料</span>
              <span className="font-bold text-[#101010]" data-oid="z4m-3lx">¥100</span>
            </div>
            <div
            className="border-t-2 border-[#FDA900] pt-3 flex justify-between font-bold text-[26px] font-['BIZ_UDPGothic']"
            data-oid=".dfs9ab">

              <span className="text-[#101010]" data-oid="7b245_-">合計</span>
              <span className="text-[#101010]" data-oid="21xx5:h">¥5,100</span>
            </div>
          </div>
        </Card>

        {/* Delivery Schedule */}
        <Card
        className="p-6 mb-8 bg-white border-[3px] border-[#FDA900] rounded-[14.469px]"
        data-oid="a13j9dc">

          <h3
          className="font-bold mb-3 text-[24px] flex items-center text-[#101010] font-['BIZ_UDPGothic']"
          data-oid="qfwuago">

            <span className="mr-3 text-[28px]" data-oid="riz.ufg">
              📅
            </span>
            配達メモ
          </h3>
          <p className="text-[20px] mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="zeyhnax">
            2025年 9月1日午後16:00
          </p>
          <p className="text-[20px] text-[#101010] font-['BIZ_UDPGothic']" data-oid=":zrymkx">
            ご注文予定
          </p>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4" data-oid="nz7v1jm">
          <Button
            variant="outline"
            className="flex-1 text-[20px] px-6 py-4 h-[60px] border-[3px] border-[#FDA900] text-[#FDA900] rounded-xl bg-white hover:bg-gray-50 font-['BIZ_UDPGothic'] font-bold shadow-[2px_2px_0_0_#E4E2E2]"
            onClick={() => handleNavigate("cart")}
            data-oid="-fxs0ta">

            かごに戻る
          </Button>
          <Button
            className="flex-1 bg-[#FDA900] text-white text-[20px] px-6 py-4 h-[60px] border-[3px] border-[#FDA900] rounded-xl hover:bg-[#FDA900]/90 font-['BIZ_UDPGothic'] font-bold shadow-[2px_2px_0_0_#E4E2E2]"
            data-oid="khc3gs1">

            注文を確定してサイトへ
          </Button>
        </div>
      </div>
    </div>
  );
}
