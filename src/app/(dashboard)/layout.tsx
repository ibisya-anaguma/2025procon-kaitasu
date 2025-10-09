"use client";

import { AppProvider } from "@/contexts/AppContext";
import { SidebarContainer } from "@/components/screens/SidebarContainer";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <div className="flex">
        <SidebarContainer />
        {children}
      </div>
    </AppProvider>
  );
}
