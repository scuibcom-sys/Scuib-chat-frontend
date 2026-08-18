"use client";

import { useSyncExternalStore } from "react";
import { WelcomeLanding } from "./WelcomeLanding";

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
    return <div className="min-h-screen bg-[#FCF8F1]" />;
  }

  return <WelcomeLanding />;
}
