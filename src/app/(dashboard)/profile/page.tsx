"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FILTER_BUTTON_INACTIVE_CLASS, FILTER_BUTTON_TEXT_CLASS } from "@/components/screens/filterStyles";
import { useUserInformation } from "@/app/hooks/useUserInformation";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
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
    case "favoriteList":
      return "/favorites";
    default:
      return null;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    profilePage,
    totalProfilePages,
    onPageChange,
    onNavigate: setScreen
  } = useAppContext();

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  const { user: authUser } = useAuth();
  const { userInfo, isLoading, updateUserInformation } = useUserInformation();
  const [localBudget, setLocalBudget] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState('');
  const [selectedResetDay, setSelectedResetDay] = useState(1);

  // ユーザー情報が読み込まれたらローカル状態を更新
  useEffect(() => {
    if (userInfo) {
      setLocalBudget(userInfo.monthlyBudget || 50000);
      setLocalName(userInfo.name || authUser?.displayName || 'ユーザー');
      setSelectedResetDay(userInfo.resetDay || 1);
    } else if (authUser) {
      // userInfoがまだない場合、authUserから初期値を設定
      setLocalName(authUser.displayName || 'ユーザー');
    }
  }, [userInfo, authUser]);

  // 予算を保存
  const handleBudgetSave = async () => {
    const success = await updateUserInformation({ monthlyBudget: localBudget });
    if (success) {
      console.log('予算を更新しました');
    }
  };

  // 名前を保存
  const handleNameSave = async () => {
    const success = await updateUserInformation({ name: localName });
    if (success) {
      setIsEditingName(false);
      console.log('名前を更新しました');
    }
  };

  // リセット日を保存
  const handleResetDaySave = async (day: number) => {
    setSelectedResetDay(day);
    const success = await updateUserInformation({ resetDay: day });
    if (success) {
      console.log('リセット日を更新しました');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-white p-6 ml-[232px] flex items-center justify-center">
        <div>読み込み中...</div>
      </div>
    );
  }
  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen flex items-center justify-center" data-oid="3pchgx4">
      <div className="flex flex-col items-center gap-4" data-oid=":530dgu">

        <Card
        className="flex flex-col gap-6 p-6 w-[900px] h-[633px] shrink-0 rounded-[14.469px] border-[5px] border-[#FDA900] bg-white"
        data-oid="profile-main-card">

          <div className="flex items-center gap-3" data-oid="mhd5qso">
            {profilePage === 1 ? (
              <>
                <div
                  className="w-12 h-12 bg-[#adadad] rounded-full"
                  data-oid="v96ohmr">
                </div>
                <div data-oid="w32:5lp" className="flex items-center gap-4">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="text-lg font-bold"
                        placeholder="名前を入力"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNameSave}
                        className={`border border-transparent p-1 ${FILTER_BUTTON_INACTIVE_CLASS}`}>
                        <span className={FILTER_BUTTON_TEXT_CLASS}>保存</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIsEditingName(false);
                          setLocalName(userInfo?.name || authUser?.displayName || 'ユーザー');
                        }}
                        className={`border border-transparent p-1 ${FILTER_BUTTON_INACTIVE_CLASS}`}>
                        <span className={FILTER_BUTTON_TEXT_CLASS}>キャンセル</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1" data-oid="2y3hjo1">
                      <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[36px] font-bold leading-normal">
                        {localName || authUser?.displayName || 'ユーザー'}
                      </span>
                      <span className="text-[#101010] font-['BIZ_UDPGothic'] text-[24px] font-bold leading-normal">
                        さん
                      </span>
                    </div>
                  )}
                  {!isEditingName && (
                    <Button
                      variant="ghost"
                      className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
                      onClick={() => setIsEditingName(true)}
                      data-oid="541gvwr">
                      <span className={FILTER_BUTTON_TEXT_CLASS}>
                        名前を変更
                      </span>
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex-1 w-full" data-oid="o4a2j0u">
            {profilePage === 1 ? (
              <div className="space-y-6" data-oid="profile-page-one">
                <div>
                  <h3
                    className="mb-3 text-[#101010] font-['BIZ_UDPGothic'] text-[36px] font-bold leading-normal tracking-[1.872px]"
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
                          value={localBudget}
                          onChange={(e) => setLocalBudget(Number(e.target.value))}
                          className="flex-1 text-sm border-2 border-gray-300 rounded-md"
                          data-oid="_x89egx"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleBudgetSave}
                          className={`border border-transparent p-1 ${FILTER_BUTTON_INACTIVE_CLASS}`}>
                          <span className={FILTER_BUTTON_TEXT_CLASS}>保存</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3
                    className="mb-3 text-[#101010] font-['BIZ_UDPGothic'] text-[36px] font-bold leading-normal tracking-[1.872px]"
                    data-oid="calc-period-label">
                    計算期間
                  </h3>
                  <div className="flex flex-wrap gap-[37px]" data-oid="calc-period-buttons">
                    {[1, 5, 10, 15, 20, 25].map((num) => {
                      const isSelected = selectedResetDay === num;
                      return (
                        <Button
                          key={`calc-period-${num}`}
                          variant="ghost"
                          className={`border border-transparent p-0 w-[180px] min-w-[180px] h-[63px] flex items-center justify-center shrink-0 rounded-[20px] border-2 border-[#FDA900] px-6 ${
                            isSelected
                              ? 'bg-[#FDA900] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)_inset]'
                              : 'bg-white shadow-[4.5px_4.5px_0_0_#E4E2E2]'
                          }`}
                          onClick={() => handleResetDaySave(num)}
                          data-oid={`calc-period-${num}`}>
                          <span className={FILTER_BUTTON_TEXT_CLASS}> 毎月{num}日</span>
                        </Button>
                      );
                    })}
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
                      className="text-[#101010] font-['BIZ_UDPGothic'] text-[24px] font-bold leading-normal tracking-[1.248px]"
                      data-oid="profile-page-two-title">
                      定期購入の確認
                    </p>
                    <Button
                      variant="ghost"
                      className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
                      onClick={() => handleNavigate("subscriptionList")}
                      data-oid="profile-page-two-button">
                      <span className={FILTER_BUTTON_TEXT_CLASS}>定期購入の確認</span>
                    </Button>
                  </div>
                  <div className="flex flex-col items-start gap-6" data-oid="profile-page-two-favorite-subsection">
                    <p
                      className="text-[#101010] font-['BIZ_UDPGothic'] text-[24px] font-bold leading-normal tracking-[1.248px]"
                      data-oid="profile-page-two-favorite-title">
                      お気に入り登録の確認
                    </p>
                    <Button
                      variant="ghost"
                      className={`border border-transparent p-0 ${FILTER_BUTTON_INACTIVE_CLASS}`}
                      onClick={() => handleNavigate("favoriteList")}
                      data-oid="profile-page-two-favorite-button">
                      <span className={FILTER_BUTTON_TEXT_CLASS}>お気に入り一覧へ</span>
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
              className="text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px]"
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
                    className={`border border-transparent p-0 flex w-[60px] h-[60px] px-[19px] py-[14px] flex-col justify-center items-center gap-[10px] shrink-0 rounded-[20px] text-[#101010] font-['BIZ_UDPGothic'] text-[32px] font-bold leading-normal tracking-[1.664px] ${
                      isActive
                        ? 'bg-[#FDA900] shadow-[0_4px_4px_0_rgba(0,0,0,0.25)_inset]'
                        : 'bg-white shadow-[0_4px_4px_0_rgba(0,0,0,0.25)]'
                    }`}
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
