"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Screen } from "@/types/page";

type OrderProps = {
  onNavigate: (screen: Screen) => void;
};

export function Order({ onNavigate }: OrderProps) {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="syv6qb8">
      <div className="max-w-sm mx-auto" data-oid="9cyq3uk">
        <h2 className="text-base font-bold mb-4" data-oid="ycsxz70">
          注文確認
        </h2>

        {/* Delivery Address */}
        <Card
        className="p-4 mb-4 bg-white border-2 border-[#fda900] rounded-lg"
        data-oid="jk:2_ry">

          <div className="flex items-start justify-between" data-oid="ih9dsxw">
            <div data-oid="r6l2mt0">
              <h3
              className="font-medium mb-2 text-sm flex items-center"
              data-oid="fp4z1m-">

                <span className="mr-2" data-oid="qyv7-tr">
                  📍
                </span>
                配達先
              </h3>
              <p className="text-sm" data-oid="itribae">
                徳島県鳴門市○○○
              </p>
              <p className="text-sm" data-oid=".5ob1_r">
                西口○○
              </p>
            </div>
            <Button
            size="sm"
            className="bg-[#fda900] text-white text-xs border-2 border-[#fda900] rounded-md hover:bg-[#fda900]/90"
            data-oid="5zhtpvt">

              変更
            </Button>
          </div>
        </Card>

        {/* Order Summary */}
        <Card
        className="p-4 mb-4 bg-white border-2 border-[#fda900] rounded-lg"
        data-oid="8zvem9v">

          <div className="space-y-2" data-oid=":x26-uf">
            <div className="flex justify-between text-sm" data-oid="0qqfqwa">
              <span data-oid="s1w10pe">小計</span>
              <span data-oid="vizf-74">¥5,000</span>
            </div>
            <div className="flex justify-between text-sm" data-oid="u9:dvh7">
              <span data-oid="-7g8x72">配送料</span>
              <span data-oid="z4m-3lx">¥100</span>
            </div>
            <div
            className="border-t-2 border-gray-200 pt-2 flex justify-between font-bold text-sm"
            data-oid=".dfs9ab">

              <span data-oid="7b245_-">合計</span>
              <span data-oid="21xx5:h">¥5,100</span>
            </div>
          </div>
        </Card>

        {/* Delivery Schedule */}
        <Card
        className="p-4 mb-6 bg-white border-2 border-[#fda900] rounded-lg"
        data-oid="a13j9dc">

          <h3
          className="font-medium mb-2 text-sm flex items-center"
          data-oid="qfwuago">

            <span className="mr-2" data-oid="riz.ufg">
              📅
            </span>
            配達メモ
          </h3>
          <p className="text-sm" data-oid="zeyhnax">
            2025年 9月1日午後16:00
          </p>
          <p className="text-sm" data-oid=":zrymkx">
            ご注文予定
          </p>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3" data-oid="nz7v1jm">
          <Button
            variant="outline"
            className="flex-1 text-sm border-2 border-[#fda900] text-[#fda900] rounded-md bg-transparent"
            onClick={() => onNavigate("cart")}
            data-oid="-fxs0ta">

            かごに戻る
          </Button>
          <Button
            className="flex-1 bg-[#fda900] text-white text-sm border-2 border-[#fda900] rounded-md hover:bg-[#fda900]/90"
            data-oid="khc3gs1">

            注文を確定してサイトへ
          </Button>
        </div>
      </div>
    </div>
  );
}