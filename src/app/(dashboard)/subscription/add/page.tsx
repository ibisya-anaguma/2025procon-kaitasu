"use client";

import { SubscriptionAdd } from "@/components/screens/SubscriptionAdd";
import { useAppContext } from "@/contexts/AppContext";

export default function SubscriptionAddPage() {
  const {
    onUpdateProductQuantity,
    onSaveSubscriptionEntry,
    selectedSubscriptionProduct,
  } = useAppContext();

  return (
    <SubscriptionAdd
      onUpdateProductQuantity={onUpdateProductQuantity}
      onSaveSubscriptionEntry={onSaveSubscriptionEntry}
      product={selectedSubscriptionProduct}
    />
  );
}
