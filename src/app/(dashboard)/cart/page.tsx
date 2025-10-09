"use client";

import { Cart } from "@/components/screens/Cart";
import { useAppContext } from "@/contexts/AppContext";

export default function CartPage() {
  const { cartItems, onUpdateProductQuantity } = useAppContext();

  return (
    <Cart
      cartItems={cartItems}
      onUpdateProductQuantity={onUpdateProductQuantity}
    />
  );
}
