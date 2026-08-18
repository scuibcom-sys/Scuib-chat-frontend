"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NewUserOnboardingFlow } from "@/components/onboarding/NewUserOnboardingFlow";
import { useAuthStore } from "@/store/authStore";

export default function OnboardingPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/signin");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return <NewUserOnboardingFlow />;
}
