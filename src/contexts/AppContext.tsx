"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useJapaneseFoodApp } from "@/hooks/useJapaneseFoodApp";

type AppContextType = ReturnType<typeof useJapaneseFoodApp>;

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const appState = useJapaneseFoodApp();

  return <AppContext.Provider value={appState}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}
