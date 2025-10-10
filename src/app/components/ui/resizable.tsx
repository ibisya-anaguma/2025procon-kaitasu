"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
      data-oid=".4iw.s6" />);


}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      {...props}
      data-oid="v:x-ogb" />);


}

function ResizableHandle({
  withHandle,
  className,
  ...props


}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {withHandle?: boolean;}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      )}
      {...props}
      data-oid="ihimmp2">

      {withHandle &&
      <div
        className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border"
        data-oid="r.r-4dc">

          <GripVerticalIcon className="size-2.5" data-oid="-:z1e-k" />
        </div>
      }
    </ResizablePrimitive.PanelResizeHandle>);

}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };