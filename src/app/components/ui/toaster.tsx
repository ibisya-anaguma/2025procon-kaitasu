"use client";

import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport } from
"@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider data-oid="-ni24zk">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} data-oid="ofn79wj">
            <div className="grid gap-1" data-oid="pcw0b4k">
              {title && <ToastTitle data-oid="j56lj7n">{title}</ToastTitle>}
              {description &&
              <ToastDescription data-oid=".p61_r4">
                  {description}
                </ToastDescription>
              }
            </div>
            {action}
            <ToastClose data-oid="lb74uzx" />
          </Toast>);

      })}
      <ToastViewport data-oid="8.yguoz" />
    </ToastProvider>);

}