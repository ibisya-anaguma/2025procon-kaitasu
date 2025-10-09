"use client";

import { Button } from "@/components/ui/button";
import type { Screen } from "@/types/navigation";

type OrderPageProps = {
  onNavigate: (screen: Screen) => void;
};

const OrderPage = ({ onNavigate }: OrderPageProps) => (
  <div className="flex-1 bg-gray-50 p-8 ml-[232px] min-h-screen">
    <div className="max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">注文確認</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 配達先カード */}
        <div className="lg:col-span-2">
          <div className="bg-white border-4 border-[#fda900] rounded-3xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="text-[#fda900] text-3xl">📍</span>
              配達先
            </h2>
            <div className="bg-[#f5d4a0] rounded-2xl p-6 flex items-center justify-between">
              <div>
                <p className="text-xl font-medium">
                  徳島県神山町○○-
                </p>
                <p className="text-xl font-medium">
                  □□-××
                </p>
              </div>
              <Button
                className="bg-white text-[#101010] text-lg font-bold px-8 py-6 rounded-2xl border-4 border-[#fda900] hover:bg-gray-50">
                変更
              </Button>
            </div>
          </div>
        </div>

        {/* 注文内容カード */}
        <div className="lg:col-span-1">
          <div className="bg-white border-4 border-[#fda900] rounded-3xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="text-[#fda900] text-3xl">📋</span>
              注文内容
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xl">
                <span>小計</span>
                <span className="font-bold">¥5,000</span>
              </div>
              <div className="flex justify-between items-center text-xl">
                <span>送料</span>
                <span className="font-bold">¥100</span>
              </div>
              <div className="border-t-2 border-gray-200 pt-4 mt-4"></div>
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>合計</span>
                <span>¥5,100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 配達メモカード */}
      <div className="bg-white border-4 border-[#fda900] rounded-3xl p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span className="text-[#fda900] text-3xl">📝</span>
          配達メモ
        </h2>
        <p className="text-2xl font-bold">
          2025年　9月1日午後16:00
        </p>
        <p className="text-xl mt-2">
          ごろ到着予定
        </p>
      </div>

      {/* ボタン */}
      <div className="flex justify-center gap-6">
        <Button
          variant="outline"
          className="text-xl font-bold px-12 py-6 rounded-2xl border-4 border-gray-400 bg-white text-gray-700 hover:bg-gray-50"
          onClick={() => onNavigate("cart")}>
          かごに戻る
        </Button>
        <Button
          className="text-xl font-bold px-12 py-6 rounded-2xl border-4 border-[#fda900] bg-[#fda900] text-white hover:bg-[#e69900]">
          注文を確定してサイトへ
        </Button>
      </div>
    </div>
  </div>
);

export default OrderPage;
