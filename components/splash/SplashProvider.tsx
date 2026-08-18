"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "./SplashScreen";

interface SplashContextType {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SplashContext = createContext<SplashContextType>({
  isLoading: false,
  setIsLoading: () => {},
});

export function useSplash() {
  return useContext(SplashContext);
}

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const [homeSplashDismissed, setHomeSplashDismissed] = useState(false);

  const showSplash = pathname === "/" && !homeSplashDismissed;

  const handleSplashComplete = () => {
    setHomeSplashDismissed(true);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <SplashContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
      {isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f5f0e8]/80 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#5d4037] border-t-transparent" />
        </div>
      ) : null}
    </SplashContext.Provider>
  );
}
