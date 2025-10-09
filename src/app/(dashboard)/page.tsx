"use client";

import { useRouter } from "next/navigation";
import { Dashboard as DashboardScreen } from "@/components/screens/Dashboard";
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

export default function DashboardPage() {
  const router = useRouter();
  const { monthlyBudget, onNavigate: setScreen } = useAppContext();

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  return <DashboardScreen monthlyBudget={monthlyBudget} onNavigate={handleNavigate} />;
}
