"use client";

import { useSyncExternalStore } from "react";
import { StatusLandingPage } from "./StatusLandingPage";

function subscribeToHydration() {
  return () => {};
}

export function PublicOnboardingFlow() {
  const hasHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!hasHydrated) {
    return <div className="min-h-screen bg-[#FAF6F1]" />;
  }

  return <StatusLandingPage />;
}
