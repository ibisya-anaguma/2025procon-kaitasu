"use client";

import { Dashboard } from "@/components/screens/Dashboard";
import { useAppContext } from "@/contexts/AppContext";

export default function DashboardPage() {
  const { monthlyBudget } = useAppContext();

  return <Dashboard monthlyBudget={monthlyBudget} />;
}
