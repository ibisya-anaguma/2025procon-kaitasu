"use client";

import { useRouter } from "next/navigation";
import { CatalogLanding } from "@/components/screens/CatalogLanding";
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

export default function CatalogLandingPage() {
  const router = useRouter();
  const {
    landingPage,
    totalLandingPages,
    onLandingPageChange,
    currentLandingCards,
    onNavigate: setScreen
  } = useAppContext();

  const handleNavigate = (screen: Screen) => {
    setScreen(screen);

    if (screen === "catalog") {
      router.push("/catalog?fromLanding=1");
      return;
    }

    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  return (
    <CatalogLanding
      landingPage={landingPage}
      totalLandingPages={totalLandingPages}
      onLandingPageChange={onLandingPageChange}
      onNavigate={handleNavigate}
      currentLandingCards={currentLandingCards}
    />
  );
}

