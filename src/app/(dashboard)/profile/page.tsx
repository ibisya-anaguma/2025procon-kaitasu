"use client";

import { Profile } from "@/components/screens/Profile";
import { useAppContext } from "@/contexts/AppContext";

export default function ProfilePage() {
  const {
    profilePage,
    totalProfilePages,
    onPageChange,
    monthlyBudget,
    onMonthlyBudgetChange,
  } = useAppContext();

  return (
    <Profile
      profilePage={profilePage}
      totalProfilePages={totalProfilePages}
      onPageChange={onPageChange}
      monthlyBudget={monthlyBudget}
      onMonthlyBudgetChange={onMonthlyBudgetChange}
    />
  );
}
