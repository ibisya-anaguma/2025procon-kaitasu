"use client";

import { Subscription } from "@/components/screens/Subscription";
import { useAppContext } from "@/contexts/AppContext";

export default function SubscriptionPage() {
  const {
    products,
    subscriptionScrollRef,
    onSelectSubscriptionProduct,
  } = useAppContext();

  return (
    <Subscription
      products={products}
      subscriptionScrollRef={subscriptionScrollRef}
      onSelectSubscriptionProduct={onSelectSubscriptionProduct}
    />
  );
}
