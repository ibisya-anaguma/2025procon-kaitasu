import type * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const getVariantClasses = (variant: BadgeProps["variant"] = "default") => {
  const variants = {
    default: "border-transparent bg-primary text-primary-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    destructive: "border-transparent bg-destructive text-white",
    outline: "text-foreground"
  };
  return variants[variant];
};

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap transition-colors",
        getVariantClasses(variant),
        className
      )}
      {...props}
      data-oid="a7oyca_" />);


}

export { Badge };