"use client";

import { AppProvider } from "@/contexts/AppContext";
import { Sidebar } from "@/components/screens/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <Sidebar />
      {children}
    </AppProvider>
  );
}
