<<<<<<< HEAD
"use client";

import { AppProvider } from "@/contexts/AppContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Sidebar } from "@/components/screens/Sidebar";
=======
﻿"use client";

import { AppProvider } from "@/contexts/AppContext";
import { SidebarContainer } from "@/components/screens/SidebarContainer";
>>>>>>> kizu/develop

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
<<<<<<< HEAD
    <ProtectedRoute>
      <AppProvider>
        <div className="flex">
          <Sidebar />
          {children}
        </div>
      </AppProvider>
    </ProtectedRoute>
=======
    <AppProvider>
      <div className="flex">
        <SidebarContainer />
        {children}
      </div>
    </AppProvider>
>>>>>>> kizu/develop
  );
}
