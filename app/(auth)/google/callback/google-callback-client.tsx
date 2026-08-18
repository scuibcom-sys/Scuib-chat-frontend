"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  getOnboardingUserKey,
  useProfileSetupStore,
} from "@/store/profileSetupStore";
import {
  ApiError,
  completeGoogleAuthCallback,
  extractApiErrorMessage,
  fetchCurrentUser,
  fetchProfile,
  isProfileComplete,
  normalizeUser,
  resolveAuthTokens,
} from "@/utils/scuibApi";
import {
  readPendingSharedGroup,
  rememberPendingSharedGroup,
} from "@/utils/sharedGroupFlow";
import {
  normalizeCategory,
  normalizeSkill,
} from "@/components/profile/profileOptions";

const DEFAULT_ERROR_MESSAGE =
  "Google sign in failed. Please try again or use email and password.";

type GoogleCallbackQueryParams = Record<string, string | string[]>;

export default function GoogleCallbackClient({
  queryParams,
}: {
  queryParams: GoogleCallbackQueryParams;
}) {
  const router = useRouter();
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const setRemoteProfileMissing = useProfileSetupStore(
    (state) => state.setRemoteProfileMissing,
  );
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const handleGoogleCallback = async () => {
      setStatus("loading");
      setError(null);

      try {
        const payload = await completeGoogleAuthCallback(queryParams);
        const tokens = resolveAuthTokens(payload);
        let user = normalizeUser(payload, tokens) ?? null;

        if (tokens.accessToken) {
          try {
            const fetchedUser = await fetchCurrentUser(tokens, (nextTokens) => {
              setTokens(
                nextTokens.accessToken,
                nextTokens.refreshToken,
                nextTokens.tokenType,
              );
            });

            if (fetchedUser) {
              user = {
                ...user,
                ...fetchedUser,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                tokenType: tokens.tokenType,
              };
            }
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 404)) {
              throw error;
            }
          }
        }

        if (!user) {
          throw new ApiError(
            "Google sign in did not return a valid user.",
            500,
            payload,
          );
        }

        if (!isActive) return;

        setUser(user);
        setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        setRemoteProfileMissing(false);
        const profileSetupStore = useProfileSetupStore.getState();
        profileSetupStore.hydrateProfile({
          emailAddress: user.email ?? "",
        });
        const onboardingUserKey = getOnboardingUserKey(user, user.email);

        const pendingSharedGroupSlug = readPendingSharedGroup()?.groupSlug ?? null;
        if (pendingSharedGroupSlug) {
          rememberPendingSharedGroup(pendingSharedGroupSlug);
        }

        try {
          const profile = await fetchProfile(tokens, (nextTokens) => {
            setTokens(
              nextTokens.accessToken,
              nextTokens.refreshToken,
              nextTokens.tokenType,
            );
          });

          if (!isActive) return;

          profileSetupStore.hydrateProfile({
            fullName: profile.fullName || undefined,
            username: profile.username || undefined,
            bio: profile.bio,
            linkedin: profile.linkedin,
            xHandle: profile.xHandle,
            portfolio: profile.portfolio,
            avatarPreview: profile.avatarUrl,
            selectedCategories: profile.categories
              .map((category) => normalizeCategory(category))
              .filter((value): value is string => Boolean(value)),
            selectedSkills: profile.skills
              .map((skill) => normalizeSkill(skill))
              .filter((value): value is string => Boolean(value)),
          });
          setRemoteProfileMissing(false);

          setUser({
            ...user,
            name: profile.fullName || user.name,
            username: profile.username || user.username || null,
            avatarUrl: profile.avatarUrl ?? user.avatarUrl ?? null,
          });

          if (isProfileComplete(profile)) {
            profileSetupStore.markOnboardingCompleted(onboardingUserKey);

            if (pendingSharedGroupSlug) {
              router.replace(
                `/dashboard?group=${encodeURIComponent(pendingSharedGroupSlug)}&join=1`,
              );
              return;
            }

            router.replace("/dashboard");
            return;
          }

          profileSetupStore.setStep(1);
          router.replace("/onboarding");
        } catch (profileError) {
          if (!isActive) return;

          if (profileError instanceof ApiError && profileError.status === 404) {
            setRemoteProfileMissing(true);

            if (profileSetupStore.hasCompletedOnboarding(onboardingUserKey)) {
              if (pendingSharedGroupSlug) {
                router.replace(
                  `/dashboard?group=${encodeURIComponent(pendingSharedGroupSlug)}&join=1`,
                );
                return;
              }

              router.replace("/dashboard");
              return;
            }

            profileSetupStore.setStep(1);
            router.replace("/onboarding");
            return;
          }

          throw profileError;
        }
      } catch (error) {
        if (!isActive) return;

        setError(extractApiErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        setStatus("error");
      }
    };

    void handleGoogleCallback();

    return () => {
      isActive = false;
    };
  }, [queryParams, router, setRemoteProfileMissing, setTokens, setUser]);

  return (
    <div className="rounded-3xl border border-[#E6DED8] bg-white px-6 py-8 shadow-[0_18px_50px_rgba(30,20,15,0.08)]">
      <h1 className="text-xl font-semibold text-[#2E221C]">
        {status === "loading" ? "Finishing Google sign in..." : "Sign in failed"}
      </h1>
      <p className="mt-3 text-sm text-[#6E625C]">
        {status === "loading"
          ? "Please wait while we finish connecting your account."
          : error}
      </p>
      {status === "error" ? (
        <div className="mt-6">
          <Link href="/signin" className="text-sm font-semibold text-[#ED7E1C]">
            Back to sign in
          </Link>
        </div>
      ) : null}
    </div>
  );
}
