"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function History() {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="n3s1kmy">
      <div className="max-w-sm mx-auto" data-oid="me-dwvn">
        <h2 className="text-base font-bold mb-4" data-oid="x::kret">
          購入履歴
        </h2>

        <div className="space-y-3" data-oid="4c1ea9l">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card
              key={i}
              className="p-3 bg-white border-2 border-gray-200 rounded-lg"
              data-oid="giqzpfm">

              <div className="flex items-center gap-3" data-oid="jlp_i_y">
                <div className="text-xs" data-oid="jflct6b">
                  <div data-oid="mtapic7">2025年</div>
                  <div data-oid="op7puzz">9月1日</div>
                </div>
                <img
              src="/images/food-item.jpg"
              alt="トップリブ 特製"
              className="w-12 h-12 object-cover rounded"
              data-oid="wur3l8e" />


                <div className="flex-1" data-oid="kmj3p4f">
                  <h4 className="text-sm font-medium" data-oid="uwyj:6y">
                    トップバリュ 特製
                  </h4>
                  <p className="text-xs text-[#adadad]" data-oid="p5nlqyv">
                    ナンバー 260g
                  </p>
                  <Badge
                    variant="secondary"
                    className="text-xs border border-gray-300 rounded"
                    data-oid="_ne7wd0">

                    お気に入りに追加
                  </Badge>
                </div>
                <div className="text-right" data-oid="t6t6kx-">
                  <div className="text-xs" data-oid="9d22m2g">
                    1コ
                  </div>
                  <div className="font-bold text-sm" data-oid="8yen38r">
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
