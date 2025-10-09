"use client";

import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
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

export function SidebarContainer() {
  const router = useRouter();
  const { currentScreen, hoveredNav, onHoverChange, onNavigate } = useAppContext();

  const handleNavigate = (screen: Screen) => {
    onNavigate(screen);
    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  return (
    <Sidebar
      currentScreen={currentScreen}
      hoveredNav={hoveredNav}
      onHoverChange={onHoverChange}
      onNavigate={handleNavigate}
    />
  );
}
