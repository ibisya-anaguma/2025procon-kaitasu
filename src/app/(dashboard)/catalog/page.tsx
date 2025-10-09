"use client";

import { Catalog } from "@/components/screens/Catalog";
import { useAppContext } from "@/contexts/AppContext";

export default function CatalogPage() {
  const {
    products,
    catalogQuantitySum,
    catalogPriceSum,
    onUpdateProductQuantity,
    catalogScrollRef,
  } = useAppContext();

  return (
    <Catalog
      products={products}
      catalogQuantitySum={catalogQuantitySum}
      catalogPriceSum={catalogPriceSum}
      onUpdateProductQuantity={onUpdateProductQuantity}
      catalogScrollRef={catalogScrollRef}
    />
  );
}
