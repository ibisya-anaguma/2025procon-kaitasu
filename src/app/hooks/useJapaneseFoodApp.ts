import { MutableRefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LANDING_CARD_CONTENT_PAGES } from "@/components/catalog-landing/landing-icons";
import type {
  FavoriteEntry,
  LandingCardContent,
  Product,
  Screen,
  SidebarNavKey,
  SubscriptionEntry
} from "@/types/page";
import { SAMPLE_PRODUCTS } from "@/lib/data/sampleProducts";

type NavigateHandler = (screen: Screen) => void;

type HoverChangeHandler = (nav: SidebarNavKey | null) => void;

type MonthlyBudgetChangeHandler = (budget: number) => void;

type UpdateProductQuantityHandler = (id: number, change: number) => void;

type PageChangeHandler = (page: number) => void;

type LandingPageChangeHandler = (page: number) => void;

type AddFavoriteHandler = (product: Product) => void;
type RemoveFavoriteHandler = (productId: number) => void;

type JapaneseFoodAppState = {
  cartItems: Product[];
  catalogPriceSum: number;
  catalogQuantitySum: number;
  catalogScrollRef: MutableRefObject<HTMLDivElement | null>;
  currentLandingCards: LandingCardContent[];
  currentScreen: Screen;
  hoveredNav: SidebarNavKey | null;
  landingPage: number;
  monthlyBudget: number;
  onHoverChange: HoverChangeHandler;
  onLandingPageChange: LandingPageChangeHandler;
  onMonthlyBudgetChange: MonthlyBudgetChangeHandler;
  onNavigate: NavigateHandler;
  onPageChange: PageChangeHandler;
  onUpdateProductQuantity: UpdateProductQuantityHandler;
  onSelectSubscriptionProduct: (product: Product) => void;
  onSaveSubscriptionEntry: (entry: SubscriptionEntry) => void;
  onRemoveSubscriptionEntry: (productId: number) => void;
  onAddFavoriteEntry: AddFavoriteHandler;
  onRemoveFavoriteEntry: RemoveFavoriteHandler;
  profilePage: number;
  products: Product[];
  selectedSubscriptionProduct: Product | null;
  subscriptionScrollRef: MutableRefObject<HTMLDivElement | null>;
  totalLandingPages: number;
  totalProfilePages: number;
  subscriptionEntries: SubscriptionEntry[];
  favoriteEntries: FavoriteEntry[];
};

export const useJapaneseFoodApp = (): JapaneseFoodAppState => {
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [hoveredNav, setHoveredNav] = useState<SidebarNavKey | null>(null);
  const [monthlyBudget, setMonthlyBudget] = useState(7500);
  const [products, setProducts] = useState<Product[]>(() =>
    SAMPLE_PRODUCTS.map((product) => ({ ...product }))
  );
  const catalogScrollRef = useRef<HTMLDivElement | null>(null);
  const subscriptionScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingProductScrollTop = useRef<number | null>(null);
  const [profilePage, setProfilePage] = useState(1);
  const [landingPage, setLandingPage] = useState(1);
  const [selectedSubscriptionProduct, setSelectedSubscriptionProduct] = useState<Product | null>(null);
  const [subscriptionEntries, setSubscriptionEntries] = useState<SubscriptionEntry[]>([]);
  const [favoriteEntries, setFavoriteEntries] = useState<FavoriteEntry[]>([]);

  const totalLandingPages = LANDING_CARD_CONTENT_PAGES.length;
  const landingPageIndex = Math.min(Math.max(landingPage - 1, 0), totalLandingPages - 1);
  const currentLandingCards = LANDING_CARD_CONTENT_PAGES[landingPageIndex] ?? [];
  const totalProfilePages = 2;

  const cartItems = useMemo(() => products.filter((product) => product.quantity > 0), [products]);

  const catalogQuantitySum = useMemo(
    () => products.reduce((sum, product) => sum + product.quantity, 0),
    [products]
  );

  const catalogPriceSum = useMemo(
    () => products.reduce((sum, product) => sum + product.quantity * product.price, 0),
    [products]
  );

  useEffect(() => {
    if (currentScreen !== "profile" && profilePage !== 1) {
      setProfilePage(1);
    }
  }, [currentScreen, profilePage]);

  const onUpdateProductQuantity: UpdateProductQuantityHandler = (id, change) => {
    const activeScrollContainer = catalogScrollRef.current ?? subscriptionScrollRef.current;
    if (activeScrollContainer) {
      pendingProductScrollTop.current = activeScrollContainer.scrollTop;
    }

    setProducts((items) => {
      const updatedItems = items.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(0, item.quantity + change) } : item
      );
      const updatedProduct = updatedItems.find((item) => item.id === id) ?? null;
      setSelectedSubscriptionProduct((prev) =>
        prev && prev.id === id ? updatedProduct : prev
      );
      return updatedItems;
    });
  };

  useLayoutEffect(() => {
    const activeScrollContainer = catalogScrollRef.current ?? subscriptionScrollRef.current;
    if (pendingProductScrollTop.current !== null && activeScrollContainer) {
      activeScrollContainer.scrollTop = pendingProductScrollTop.current;
      pendingProductScrollTop.current = null;
    }
  }, [products]);

  const onNavigate: NavigateHandler = (screen) => {
    setCurrentScreen(screen);
  };

  const onHoverChange: HoverChangeHandler = (nav) => {
    setHoveredNav(nav);
  };

  const onMonthlyBudgetChange: MonthlyBudgetChangeHandler = (budget) => {
    setMonthlyBudget(budget);
  };

  const onPageChange: PageChangeHandler = (page) => {
    setProfilePage(page);
  };

  const onLandingPageChange: LandingPageChangeHandler = (page) => {
    setLandingPage(page);
  };

  const onSelectSubscriptionProduct = (product: Product) => {
    setSelectedSubscriptionProduct(product);
  };

  const onSaveSubscriptionEntry = (entry: SubscriptionEntry) => {
    setSubscriptionEntries((prev) => {
      const index = prev.findIndex((item) => item.productId === entry.productId);
      if (index !== -1) {
        const next = [...prev];
        next[index] = entry;
        return next;
      }
      return [...prev, entry];
    });
    setSelectedSubscriptionProduct(null);
  };

  const onRemoveSubscriptionEntry = (productId: number) => {
    setSubscriptionEntries((prev) => prev.filter((entry) => entry.productId !== productId));
  };

  const onAddFavoriteEntry: AddFavoriteHandler = (product) => {
    setFavoriteEntries((prev) => {
      const index = prev.findIndex((entry) => entry.productId === product.id);
      if (index !== -1) {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: product.quantity
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: product.quantity
        }
      ];
    });
  };

  const onRemoveFavoriteEntry: RemoveFavoriteHandler = (productId) => {
    setFavoriteEntries((prev) => prev.filter((entry) => entry.productId !== productId));
  };

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
    onAddFavoriteEntry,
    onRemoveFavoriteEntry,
    profilePage,
    products,
    selectedSubscriptionProduct,
    subscriptionScrollRef,
    totalLandingPages,
    totalProfilePages,
    subscriptionEntries,
    favoriteEntries
  };
};
