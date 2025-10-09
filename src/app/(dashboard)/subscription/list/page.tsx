"use client";

import { SubscriptionList } from "@/components/screens/SubscriptionList";
import { useAppContext } from "@/contexts/AppContext";

export default function SubscriptionListPage() {
  const { subscriptionEntries, onRemoveSubscriptionEntry } = useAppContext();

  return (
    <SubscriptionList
      entries={subscriptionEntries}
      onRemoveEntry={onRemoveSubscriptionEntry}
    />
  );
}
