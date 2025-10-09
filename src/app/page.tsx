"use client";

import { Catalog } from "@/components/screens/Catalog";
import { CatalogLanding } from "@/components/screens/CatalogLanding";
import { Cart } from "@/components/screens/Cart";
import { Dashboard } from "@/components/screens/Dashboard";
import { History } from "@/components/screens/History";
import { Order } from "@/components/screens/Order";
import { Profile } from "@/components/screens/Profile";
import { Sidebar } from "@/components/screens/Sidebar";
import { Subscription } from "@/components/screens/Subscription";
import { SubscriptionAdd } from "@/components/screens/SubscriptionAdd";
import { SubscriptionList } from "@/components/screens/SubscriptionList";
import { useJapaneseFoodApp } from "@/hooks/useJapaneseFoodApp";

export const JapaneseFoodApp = () => {
  const {
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
    subscriptionScrollRef,
    totalLandingPages,
    totalProfilePages,
    subscriptionEntries
  } = useJapaneseFoodApp();

  const renderScreen = () => {
    switch (currentScreen) {
      case "dashboard":
        return <Dashboard monthlyBudget={monthlyBudget} onNavigate={onNavigate} />;
      case "catalog":
        return (
          <Catalog
            products={products}
            catalogQuantitySum={catalogQuantitySum}
            catalogPriceSum={catalogPriceSum}
            onNavigate={onNavigate}
            onUpdateProductQuantity={onUpdateProductQuantity}
            catalogScrollRef={catalogScrollRef}
          />
        );
      case "cart":
        return (
          <Cart
            cartItems={cartItems}
            onNavigate={onNavigate}
            onUpdateProductQuantity={onUpdateProductQuantity}
          />
        );
      case "order":
        return <Order onNavigate={onNavigate} />;
      case "history":
        return <History />;
      case "profile":
        return (
          <Profile
            profilePage={profilePage}
            totalProfilePages={totalProfilePages}
            onPageChange={onPageChange}
            monthlyBudget={monthlyBudget}
            onMonthlyBudgetChange={onMonthlyBudgetChange}
            onNavigate={onNavigate}
          />
        );
      case "catalogLanding":
        return (
          <CatalogLanding
            landingPage={landingPage}
            totalLandingPages={totalLandingPages}
            onLandingPageChange={onLandingPageChange}
            onNavigate={onNavigate}
            currentLandingCards={currentLandingCards}
          />
        );
      case "subscription":
        return (
          <Subscription
            products={products}
            subscriptionScrollRef={subscriptionScrollRef}
            onNavigate={onNavigate}
            onSelectSubscriptionProduct={onSelectSubscriptionProduct}
          />
        );
      case "subscriptionAdd":
        return (
          <SubscriptionAdd
            onNavigate={onNavigate}
            onUpdateProductQuantity={onUpdateProductQuantity}
            onSaveSubscriptionEntry={onSaveSubscriptionEntry}
            product={selectedSubscriptionProduct}
          />
        );
      case "subscriptionList":
        return (
          <SubscriptionList
            entries={subscriptionEntries}
            onRemoveEntry={onRemoveSubscriptionEntry}
          />
        );
      default:
        return <Dashboard monthlyBudget={monthlyBudget} onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="flex">
      <Sidebar
        currentScreen={currentScreen}
        hoveredNav={hoveredNav}
        onHoverChange={onHoverChange}
        onNavigate={onNavigate}
      />
      {renderScreen()}
    </div>
  );
};
