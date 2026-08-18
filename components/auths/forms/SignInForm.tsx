"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialButton } from "@/components/ui/SocialButton";
import { useForm } from "@/hooks/useForm";
import { useAuthStore } from "@/store/authStore";
import {
  getOnboardingUserKey,
  useProfileSetupStore,
} from "@/store/profileSetupStore";
import { ArrowRightIcon, LockIcon, MailIcon } from "@/utils/icons";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  extractApiErrorMessage,
  fetchGoogleAuthUrl,
  fetchCurrentUser,
  fetchProfile,
  isProfileComplete,
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

interface SignInValues {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({
  notice,
  sharedGroupSlug = null,
}: {
  notice?: "verify-email" | "session-expired" | null;
  sharedGroupSlug?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, error, clearError, setTokens, setUser } =
    useAuthStore();
  const setRemoteProfileMissing = useProfileSetupStore(
    (state) => state.setRemoteProfileMissing,
  );
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const hasHandledAuthTokens = useRef(false);
  const hasGoogleCallbackTokens = Boolean(searchParams.get("access")?.trim());

  const routeAfterAuth = useCallback(async (options: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenType: "Bearer" | "Token";
    userEmail?: string | null;
    userId?: string | null;
    sharedGroup?: string | null;
    preferDashboardRedirect?: boolean;
  }) => {
    const {
      accessToken,
      refreshToken,
      tokenType,
      userEmail,
      userId,
      sharedGroup,
      preferDashboardRedirect = false,
    } = options;

    setRoutingError(null);
    setIsRouting(true);
    setRemoteProfileMissing(false);

    const profileSetupStore = useProfileSetupStore.getState();
    profileSetupStore.hydrateProfile({
      emailAddress: userEmail ?? "",
    });
    const onboardingUserKey = getOnboardingUserKey(
      userEmail ? { email: userEmail, id: userId ?? null } : null,
      userEmail,
    );

    const pendingSharedGroupSlug =
      sharedGroup ?? readPendingSharedGroup()?.groupSlug ?? null;

    if (pendingSharedGroupSlug) {
      rememberPendingSharedGroup(pendingSharedGroupSlug);
      router.replace(
        `/dashboard?group=${encodeURIComponent(pendingSharedGroupSlug)}&join=1`,
      );
      return;
    }

    if (preferDashboardRedirect) {
      router.replace("/dashboard");
      return;
    }

    try {
      const profile = await fetchProfile(
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        },
      );

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

      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        setUser({
          ...currentUser,
          name: profile.fullName || currentUser.name,
          username: profile.username || currentUser.username || null,
          avatarUrl: profile.avatarUrl ?? currentUser.avatarUrl ?? null,
        });
      }

      if (isProfileComplete(profile)) {
        profileSetupStore.markOnboardingCompleted(onboardingUserKey);
        router.replace("/dashboard");
        return;
      }

      profileSetupStore.setStep(1);
      router.replace("/onboarding");
    } catch (fetchError) {
      if (fetchError instanceof ApiError && fetchError.status === 404) {
        setRemoteProfileMissing(true);

        if (profileSetupStore.hasCompletedOnboarding(onboardingUserKey)) {
          router.replace("/dashboard");
          return;
        }

        profileSetupStore.setStep(1);
        router.replace("/onboarding");
        return;
      }

      setRoutingError(
        extractApiErrorMessage(
          fetchError,
          "Unable to load your profile right now. Please try again.",
        ),
      );
      setIsRouting(false);
    }
  }, [router, setRemoteProfileMissing, setTokens, setUser]);

  useEffect(() => {
    if (hasHandledAuthTokens.current) return;

    const accessToken = searchParams.get("access")?.trim() ?? null;
    const refreshToken = searchParams.get("refresh")?.trim() ?? null;
    if (!accessToken) return;

    hasHandledAuthTokens.current = true;

    const tokenType = resolveAuthTokens({ access: accessToken, refresh: refreshToken })
      .tokenType;

    setTokens(accessToken, refreshToken, tokenType);

    const sharedGroupSlug = searchParams.get("group")?.trim() || null;

    const hydrateFromTokens = async () => {
      try {
        const currentUser = await fetchCurrentUser({
          accessToken,
          refreshToken,
          tokenType,
        }, (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        });

        if (currentUser) {
          setUser({
            ...currentUser,
            accessToken,
            refreshToken,
            tokenType,
          });
        }

        await routeAfterAuth({
          accessToken,
          refreshToken,
          tokenType,
          userEmail: currentUser?.email ?? null,
          userId: currentUser?.id ?? null,
          sharedGroup: sharedGroupSlug,
          preferDashboardRedirect: true,
        });
      } catch (error) {
        setRoutingError(
          extractApiErrorMessage(
            error,
            "Unable to complete Google sign in right now.",
          ),
        );
        setIsRouting(false);
      }
    };

    void hydrateFromTokens();
  }, [
    routeAfterAuth,
    searchParams,
    setTokens,
    setUser,
  ]);

  const validate = (values: SignInValues) => {
    const errors: Record<string, string> = {};
    const normalizedEmail = values.email.trim();

    if (!normalizedEmail) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.email = "Invalid email address";
    }
    if (!values.password) {
      errors.password = "Password is required";
    }
    return errors;
  };

  const { values, errors, handleChange, handleSubmit } = useForm<SignInValues>({
    initialValues: { email: "", password: "" },
    validate,
    onSubmit: async (values) => {
      const normalizedEmail = values.email.trim();

      clearError();
      setRoutingError(null);
      setIsRouting(true);
      setRemoteProfileMissing(false);
      try {
        await login(normalizedEmail, values.password);
      } catch {
        setIsRouting(false);
        return;
      }

      const {
        accessToken,
        refreshToken,
        tokenType,
        user,
      } = useAuthStore.getState();
      await routeAfterAuth({
        accessToken,
        refreshToken,
        tokenType,
        userEmail: user?.email ?? normalizedEmail,
        userId: user?.id ?? null,
        sharedGroup: sharedGroupSlug,
      });
    },
  });

  const handleGoogleSignIn = async () => {
    setGoogleError(null);
    setIsGoogleLoading(true);

    try {
      const authUrl = await fetchGoogleAuthUrl();
      window.location.assign(authUrl);
    } catch (error) {
      setGoogleError(
        extractApiErrorMessage(error, "Unable to start Google sign in right now."),
      );
      setIsGoogleLoading(false);
    }
  };

  if (hasGoogleCallbackTokens && !routingError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5d4037]" />
        <p className="text-sm font-semibold text-[#736B66]">
          Finishing Google sign in...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email Address"
        type="email"
        placeholder="Enter your email..."
        icon={<MailIcon className="text-[#4F3422]" />}
        value={values.email}
        onChange={(e) => handleChange("email", e.target.value)}
        error={errors.email}
      />

      <Input
        label="Password"
        type="password"
        placeholder="Enter your password..."
        icon={<LockIcon className="text-[#4F3422]" />}
        value={values.password}
        onChange={(e) => handleChange("password", e.target.value)}
        error={errors.password}
      />

      {notice === "verify-email" ? (
        <div className="rounded-lg border border-[#CFE3B6] bg-[#F3F8EA] p-3 text-sm text-[#4F6A2B]">
          Account created successfully. Please verify your email before signing in.
        </div>
      ) : null}
      {notice === "session-expired" ? (
        <div className="rounded-lg border border-[#F0D3B7] bg-[#FFF5EA] p-3 text-sm text-[#8B4B1E]">
          Your session expired. Please sign in again.
        </div>
      ) : null}

      {error && (
        <div className="p-3 rounded-lg bg-[#fef3e2] border border-[#e67e22] text-[#e67e22] text-sm">
          {error}
        </div>
      )}

      {googleError ? (
        <div className="p-3 rounded-lg bg-[#fef3e2] border border-[#e67e22] text-[#e67e22] text-sm">
          {googleError}
        </div>
      ) : null}

      {routingError ? (
        <div className="p-3 rounded-lg bg-[#fef3e2] border border-[#e67e22] text-[#e67e22] text-sm">
          {routingError}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading || isRouting}
        rightIcon={<ArrowRightIcon className="text-white" />}
        size="md"
      >
        Sign In
      </Button>

      <div className="flex justify-center gap-4 py-2">
        <SocialButton
          provider="google"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          aria-label="Continue with Google"
        />
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm text-[#736B66] font-bold leading-[100%] tracking-[-0.2%]">
          Don&apos;t have an account?{" "}
          <Link
            href={
              sharedGroupSlug
                ? `/signup?group=${encodeURIComponent(sharedGroupSlug)}`
                : "/signup"
            }
            className="text-[#ED7E1C] hover:underline"
          >
            Sign Up
          </Link>
        </p>
        <Link
          href="/forgot-password"
          className="text-sm font-bold text-[#ED7E1C] hover:underline block leading-[100%] tracking-[-0.2%]"
        >
          Forgot Password
        </Link>
      </div>
    </form>
  );
}
