<<<<<<< HEAD
"use client";

export default function CatalogPage() {
  return (
    <div className="flex-1 bg-white p-6 ml-[232px] min-h-screen">
      <div className="mx-auto w-[1000px]">
        <h2 className="text-2xl font-bold mb-6">カタログ</h2>
        <p className="text-gray-600">カタログページは準備中です。</p>
      </div>
    </div>
=======
﻿"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Catalog } from "@/components/screens/Catalog";
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

export default function CatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (typeof window !== "undefined") {
    const fromLanding = searchParams.get("fromLanding");
    if (fromLanding !== "1") {
      router.replace("/catalog-landing");
      return null;
    }
  }

  const { products, catalogQuantitySum, catalogPriceSum, onUpdateProductQuantity, catalogScrollRef, onNavigate: setScreen } = useAppContext();

  const onNavigate = (screen: Screen) => {
    setScreen(screen);

    const path = screenToPath(screen);
    if (path) router.push(path);
  };

  return (
    <Catalog
      products={products}
      catalogQuantitySum={catalogQuantitySum}
      catalogPriceSum={catalogPriceSum}
      onNavigate={onNavigate}
      onUpdateProductQuantity={onUpdateProductQuantity}
      catalogScrollRef={catalogScrollRef}
    />
>>>>>>> kizu/develop
  );
}
