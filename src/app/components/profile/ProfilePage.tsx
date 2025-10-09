import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProfilePageProps = {
  monthlyBudget: number;
  onMonthlyBudgetChange: (value: number) => void;
};

const ProfilePage = ({ monthlyBudget, onMonthlyBudgetChange }: ProfilePageProps) => (
  <div className="flex-1 bg-white p-6 ml-[232px]" data-oid="3pchgx4">
    <div className="max-w-sm mx-auto space-y-4" data-oid=":530dgu">
      <h2 className="text-base font-bold" data-oid="0a9t2n.">
        マイページ
      </h2>

      <Card className="p-4 bg-white border-2 border-gray-200 rounded-lg" data-oid="6:a7mk2">
        <div className="flex items-center gap-3" data-oid="mhd5qso">
          <div className="w-12 h-12 bg-[#adadad] rounded-full" data-oid="v96ohmr" />
          <div data-oid="w32:5lp">
            <h3 className="font-medium text-sm" data-oid="2y3hjo1">
              水口 和佳さん
            </h3>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-2 border-gray-300 rounded-md bg-transparent"
              data-oid="541gvwr">
              名前を変更
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-white border-2 border-gray-200 rounded-lg" data-oid="o4a2j0u">
        <h3 className="font-medium mb-3 text-sm" data-oid="xkxxiap">
          予算設定
        </h3>
        <div className="space-y-3" data-oid="prr6v6o">
          <div data-oid="zve5:m0">
            <label className="text-sm block mb-1" data-oid="d68qzu_">
              今月の予算
            </label>
            <div className="flex items-center gap-2" data-oid="lirbdor">
              <span className="text-sm" data-oid="zr1baos">
                ¥
              </span>
              <Input
                type="number"
                value={monthlyBudget}
                onChange={(event) => onMonthlyBudgetChange(Number(event.target.value))}
                className="flex-1 text-sm border-2 border-gray-300 rounded-md"
                data-oid="_x89egx"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
);

export default ProfilePage;
