"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center" data-oid="n3s1kmy">
      <div className="w-[900px]" data-oid="me-dwvn">
        <h2 className="text-[36px] font-bold mb-6 text-[#101010] font-['BIZ_UDPGothic']" data-oid="x::kret">
          購入履歴
        </h2>

        <div className="space-y-4" data-oid="4c1ea9l">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="p-6 bg-white border-[3px] border-[#FDA900] rounded-[14.469px] shadow-sm"
              data-oid="giqzpfm">

              <div className="flex items-center gap-6" data-oid="jlp_i_y">
                <div className="text-base font-['BIZ_UDPGothic'] text-[#101010] min-w-[100px]" data-oid="jflct6b">
                  <div className="font-bold text-[20px]" data-oid="mtapic7">2025年</div>
                  <div className="font-medium text-[18px]" data-oid="op7puzz">9月1日</div>
                </div>
                <img
              src="/images/food-item.jpg"
              alt="トップリブ 特製"
              className="w-[120px] h-[120px] object-cover rounded-lg"
              data-oid="wur3l8e" />


                <div className="flex-1" data-oid="kmj3p4f">
                  <h4 className="text-[24px] font-bold mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="uwyj:6y">
                    トップバリュ 特製
                  </h4>
                  <p className="text-[18px] text-[#adadad] mb-3 font-['BIZ_UDPGothic']" data-oid="p5nlqyv">
                    ナンバー 260g
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-base px-4 py-2 border-2 border-[#209fde] bg-white text-[#209fde] rounded-lg font-['BIZ_UDPGothic'] font-bold hover:bg-[#209fde] hover:text-white cursor-pointer transition-colors"
                    data-oid="_ne7wd0">

                    お気に入りに追加
                  </Badge>
                </div>
                <div className="text-right min-w-[120px]" data-oid="t6t6kx-">
                  <div className="text-[20px] mb-2 text-[#101010] font-['BIZ_UDPGothic']" data-oid="9d22m2g">
                    1コ
                  </div>
                  <div className="font-bold text-[28px] text-[#101010] font-['BIZ_UDPGothic']" data-oid="8yen38r">
                    ¥350
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
