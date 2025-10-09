"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type {
  LandingCardContent,
  Product,
  Screen,
  SidebarNavKey,
  SubscriptionEntry
} from "@/types/page";

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "北海道産じゃがいも",
    description: "ホクホク食感のじゃがいも 3個入り",
    price: 250,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 2,
    name: "徳島産れんこん",
    description: "煮物にもぴったりのれんこん 200g",
    price: 320,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 3,
    name: "国産若鶏むね肉",
    description: "低脂質で使いやすいむね肉 300g",
    price: 480,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 4,
    name: "淡路島たまねぎ",
    description: "甘みのある玉ねぎ 2個入り",
    price: 210,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 5,
    name: "有機豆腐",
    description: "なめらかな食感の絹豆腐 2丁",
    price: 180,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 6,
    name: "長野県産りんご",
    description: "シャキシャキ食感のサンふじ 4個入り",
    price: 540,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 7,
    name: "だし香る味噌汁セット",
    description: "具材たっぷり 5食入り",
    price: 398,
    image: "/file.svg",
    quantity: 0
  },
  {
    id: 8,
    name: "こだわり卵",
    description: "平飼い卵 10個入り",
    price: 360,
    image: "/file.svg",
    quantity: 0
  }
];

const LANDING_CARD_PAGES: LandingCardContent[][] = [
  [
    { title: "手軽に作れる主菜", renderIcon: () => <span className="text-4xl">🍳</span> },
    { title: "野菜たっぷり副菜", renderIcon: () => <span className="text-4xl">🥗</span> },
    { title: "常備したい朝食", renderIcon: () => <span className="text-4xl">🍞</span> },
    { title: "お得なまとめ買い", renderIcon: () => <span className="text-4xl">💰</span> }
  ],
  [
    { title: "冷凍して便利", renderIcon: () => <span className="text-4xl">❄️</span> },
    { title: "レンジで簡単", renderIcon: () => <span className="text-4xl">⚡</span> },
    { title: "週末のご褒美", renderIcon: () => <span className="text-4xl">🎁</span> },
    { title: "季節のおすすめ", renderIcon: () => <span className="text-4xl">🍁</span> }
  ],
  [
    { title: "栄養バランス◎", renderIcon: () => <span className="text-4xl">🥦</span> },
    { title: "家族でシェア", renderIcon: () => <span className="text-4xl">👪</span> },
    { title: "お弁当のおかず", renderIcon: () => <span className="text-4xl">🍱</span> },
    { title: "ストック食材", renderIcon: () => <span className="text-4xl">📦</span> }
  ]
];

const TOTAL_PROFILE_PAGES = 2;

export function useJapaneseFoodApp() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [hoveredNav, setHoveredNav] = useState<SidebarNavKey | null>(null);
  const [landingPage, setLandingPage] = useState(1);
  const [profilePage, setProfilePage] = useState(1);
  const [monthlyBudget, setMonthlyBudget] = useState(50000);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [subscriptionEntries, setSubscriptionEntries] = useState<SubscriptionEntry[]>([]);

  const catalogScrollRef = useRef<HTMLDivElement | null>(null);
  const subscriptionScrollRef = useRef<HTMLDivElement | null>(null);

  const totalLandingPages = LANDING_CARD_PAGES.length;

  const catalogQuantitySum = useMemo(
    () => products.reduce((sum, product) => sum + product.quantity, 0),
    [products]
  );

  const catalogPriceSum = useMemo(
    () => products.reduce((sum, product) => sum + product.price * product.quantity, 0),
    [products]
  );

  const cartItems = useMemo(
    () => products.filter((product) => product.quantity > 0),
    [products]
  );

  const currentLandingCards = useMemo(() => {
    const pageIndex = Math.min(Math.max(landingPage, 1), totalLandingPages) - 1;
    return LANDING_CARD_PAGES[pageIndex] ?? LANDING_CARD_PAGES[0];
  }, [landingPage, totalLandingPages]);

  const selectedSubscriptionProduct = useMemo(() => {
    if (selectedProductId === null) {
      return null;
    }

    return products.find((product) => product.id === selectedProductId) ?? null;
  }, [products, selectedProductId]);

  const onNavigate = useCallback((screen: Screen) => {
    setCurrentScreen(screen);

    if (screen === "catalog") {
      setTimeout(() => {
        catalogScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
    }

    if (screen === "subscription") {
      setTimeout(() => {
        subscriptionScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
    }
  }, []);

  const onHoverChange = useCallback((key: SidebarNavKey | null) => {
    setHoveredNav(key);
  }, []);

  const onLandingPageChange = useCallback((page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalLandingPages);
    setLandingPage(nextPage);
  }, [totalLandingPages]);

  const onMonthlyBudgetChange = useCallback((value: number) => {
    if (Number.isNaN(value)) {
      setMonthlyBudget(0);
      return;
    }

    setMonthlyBudget(Math.max(0, Math.floor(value)));
  }, []);

  const onPageChange = useCallback((page: number) => {
    const nextPage = Math.min(Math.max(page, 1), TOTAL_PROFILE_PAGES);
    setProfilePage(nextPage);
  }, []);

  const onUpdateProductQuantity = useCallback((id: number, change: number) => {
    if (!Number.isFinite(change)) {
      return;
    }

    setProducts((prevProducts) => prevProducts.map((product) => {
      if (product.id !== id) {
        return product;
      }

      const nextQuantity = Math.max(0, product.quantity + change);
      return { ...product, quantity: nextQuantity };
    }));
  }, []);

  const onSelectSubscriptionProduct = useCallback((product: Product) => {
    setSelectedProductId(product.id);
  }, []);

  const onSaveSubscriptionEntry = useCallback((entry: SubscriptionEntry) => {
    if (!entry.quantity) {
      return;
    }

    setSubscriptionEntries((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === entry.productId);
      if (existingIndex === -1) {
        return [...prev, entry];
      }

      const next = [...prev];
      next[existingIndex] = entry;
      return next;
    });

    setSelectedProductId(null);
  }, []);

  const onRemoveSubscriptionEntry = useCallback((productId: number) => {
    setSubscriptionEntries((prev) => prev.filter((entry) => entry.productId !== productId));
  }, []);

  return {
    cartItems,
    catalogPriceSum,
    catalogQuantitySum,
    catalogScrollRef,
    currentLandingCards,
    currentScreen,
    hoveredNav,
    landingPage,
    monthlyBudget,
    onHoverChange,
    onLandingPageChange,
    onMonthlyBudgetChange,
    onNavigate,
    onPageChange,
    onUpdateProductQuantity,
    onSelectSubscriptionProduct,
    onSaveSubscriptionEntry,
    onRemoveSubscriptionEntry,
    profilePage,
    products,
    selectedSubscriptionProduct,
    subscriptionEntries,
    subscriptionScrollRef,
    totalLandingPages,
    totalProfilePages: TOTAL_PROFILE_PAGES
  };
}
