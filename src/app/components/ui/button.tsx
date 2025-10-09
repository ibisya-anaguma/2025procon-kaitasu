import type * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ComponentProps<"button"> {
  variant?:
  "default" |
  "destructive" |
  "outline" |
  "secondary" |
  "ghost" |
  "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const getVariantClasses = (variant: ButtonProps["variant"] = "default") => {
  const variants = {
    default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
    outline:
    "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
    secondary:
    "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-[#fda900]",
    link: "text-primary underline-offset-4 hover:underline"
  };
  return variants[variant];
};

const getSizeClasses = (size: ButtonProps["size"] = "default") => {
  const sizes = {
    default: "h-9 px-4 py-2",
    sm: "h-8 rounded-md gap-1.5 px-3",
    lg: "h-10 rounded-md px-6",
    icon: "size-9"
  };
  return sizes[size];
};

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
        getVariantClasses(variant),
        getSizeClasses(size),
        className
      )}
      {...props}
      data-oid="v.hnz7p" />);


}

export { Button };
