"use client";

import { FavoriteList } from "@/components/screens/FavoriteList";
import { useAppContext } from "@/contexts/AppContext";

export default function FavoriteListPage() {
  const { favoriteEntries, onRemoveFavoriteEntry } = useAppContext();
  return <FavoriteList entries={favoriteEntries} onRemoveEntry={onRemoveFavoriteEntry} />;
}

