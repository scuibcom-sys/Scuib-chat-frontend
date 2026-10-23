"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { StatusLandingPage } from "./StatusLandingPage";

export function HomeEntry() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [hasHydrated, setHasHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || isAuthenticated) {
    return <div className="min-h-screen bg-[#FAF6F1]" />;
  }

  return <StatusLandingPage />;
}
