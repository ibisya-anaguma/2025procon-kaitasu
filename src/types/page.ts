import type { JSX } from "react";

import type { Product } from "./product";
import type { Screen, SidebarNavKey } from "./navigation";

export type { Product, Screen, SidebarNavKey };

export type SidebarIconProps = {
  fill?: string;
  stroke?: string;
};

export type SidebarIconComponent = (props: SidebarIconProps) => JSX.Element;

export type LandingCardContent = {
  title: string;
  renderIcon?: () => JSX.Element | null;
};

export type SubscriptionEntry = {
  id: number;
  productId: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  frequencyDays: number;
};

export type FavoriteEntry = {
  productId: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
};
