"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  LayoutGrid,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Mail,
  MessageCircleMore,
  Pencil,
  Share2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import {
  extractApiErrorMessage,
  fetchProfile,
  fetchGroups,
  isSessionInvalidationError,
  SESSION_EXPIRED_ERROR_MESSAGE,
  toDashboardGroup,
  updateProfile,
  uploadProfileAvatar,
  type ApiGroupRecord,
} from "@/utils/scuibApi";
import {
  AvatarCircle,
  ProfileHeaderPattern,
} from "@/components/profile/ProfileEditView";
import {
  normalizeCategory,
  normalizeSkill,
  getCategoryLabel,
  getSkillLabel,
} from "@/components/profile/profileOptions";

export function ProfileDisplayView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const {
    fullName,
    username,
    emailAddress,
    bio,
    linkedin,
    xHandle,
    portfolio,
    avatarPreview,
    selectedCategories,
    selectedSkills,
    hydrateProfile,
  } = useProfileSetupStore();
  const [groups, setGroups] = useState<ApiGroupRecord[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarActionError, setAvatarActionError] = useState<string | null>(null);
  const [hasHydratedAuthStore, setHasHydratedAuthStore] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleSessionExpired = useCallback(async () => {
    setAvatarActionError(SESSION_EXPIRED_ERROR_MESSAGE);
    await logout();
    router.replace("/signin?notice=session-expired");
  }, [logout, router]);

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHasHydratedAuthStore(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!hasHydratedAuthStore || isAuthenticated) return;
    router.replace("/");
  }, [hasHydratedAuthStore, isAuthenticated, router]);

  useEffect(() => {
    let isActive = true;

    const loadGroups = async () => {
      try {
        const liveGroups = await fetchGroups(
          accessToken
            ? {
                accessToken,
                refreshToken,
                tokenType,
              }
            : null,
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );
        if (!isActive) return;

        const joinedGroups = liveGroups.filter((group) => group.isJoined);
        setGroups(joinedGroups);
      } catch {
        if (!isActive) return;
        setGroups([]);
      }
    };

    void loadGroups();

    return () => {
      isActive = false;
    };
  }, [accessToken, refreshToken, setTokens, tokenType]);

  useEffect(() => {
    if (!accessToken) return;

    let isActive = true;

    const loadProfile = async () => {
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

        if (!isActive) return;

        useProfileSetupStore.getState().hydrateProfile({
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

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          setUser({
            ...currentUser,
            name: profile.fullName || currentUser.name,
            username: profile.username || currentUser.username || null,
            avatarUrl: profile.avatarUrl ?? currentUser.avatarUrl ?? null,
          });
        }
      } catch (error) {
        if (isSessionInvalidationError(error)) {
          void handleSessionExpired();
        }
        // Keep the profile screen usable with cached local data.
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [accessToken, handleSessionExpired, refreshToken, setTokens, setUser, tokenType]);

  const profileName = fullName || user?.name || "Unnamed profile";
  const profileAvatarSeed =
    fullName || user?.name || emailAddress || user?.email || "S";
  const profileUsername =
    username ||
    deriveUsername(fullName || user?.name || "", emailAddress || user?.email || "profile@scuib.chat");
  const profileBio =
    bio || "No bio added yet.";
  const dashboardGroups = useMemo(
    () => groups.map((group, index) => toDashboardGroup(group, index)),
    [groups],
  );
  const shouldReturnToDashboard = searchParams.get("updated") === "1";

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleBackNavigation = () => {
    if (shouldReturnToDashboard) {
      router.replace("/dashboard");
      return;
    }

    router.back();
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile || !accessToken || isUpdatingAvatar) {
      return;
    }

    setAvatarActionError(null);
    setIsUpdatingAvatar(true);

    try {
      const uploadedAvatarUrl = await uploadProfileAvatar(
        selectedFile,
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        },
      );

      const savedProfile = await updateProfile(
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        {
          fullName: fullName || user?.name || undefined,
          username: username || user?.username || undefined,
          avatarUrl: uploadedAvatarUrl,
          bio,
          categories: selectedCategories,
          skills: selectedSkills,
          categoryLabels: selectedCategories.map((category) => getCategoryLabel(category)),
          skillLabels: selectedSkills.map((skill) => getSkillLabel(skill)),
          linkedin,
          xHandle,
          portfolio,
        },
        (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        },
      );

      const nextAvatarUrl = savedProfile.avatarUrl ?? uploadedAvatarUrl;
      hydrateProfile({
        avatarPreview: nextAvatarUrl,
        bio: savedProfile.bio,
        linkedin: savedProfile.linkedin,
        xHandle: savedProfile.xHandle,
        portfolio: savedProfile.portfolio,
        selectedCategories: savedProfile.categories
          .map((category) => normalizeCategory(category))
          .filter((value): value is string => Boolean(value)),
        selectedSkills: savedProfile.skills
          .map((skill) => normalizeSkill(skill))
          .filter((value): value is string => Boolean(value)),
      });

      if (user) {
        setUser({
          ...user,
          name: savedProfile.fullName || fullName || user.name,
          username:
            savedProfile.username || username || user.username || null,
          avatarUrl: nextAvatarUrl,
        });
      }
    } catch (error) {
      if (isSessionInvalidationError(error)) {
        await handleSessionExpired();
        return;
      }
      setAvatarActionError(
        extractApiErrorMessage(error, "Unable to update your profile image right now."),
      );
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  return (
    <>
      {!isAuthenticated ? (
        <div className="min-h-screen bg-[#FBF8F4] text-[#5B3B29] md:hidden">
          <div className="flex min-h-screen w-full flex-col bg-[#FBF8F4] pb-[126px]">
            <div className="relative h-[202px] overflow-hidden bg-[#465728] px-6 pb-8 pt-5">
              <ProfileHeaderPattern />
              <div className="relative z-10">
                <div className="flex items-center justify-between text-white">
                  <span className="text-[22px] font-bold tracking-[-0.03em]">
                    9:41
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-white">
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="text-[20px] font-extrabold tracking-[-0.03em]">
                    Profile
                  </h1>
                </div>
              </div>
            </div>

            <div className="relative flex-1 px-6 pt-10 text-center">
              <div className="-mt-[70px] flex justify-center">
                <div className="relative">
                  <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-full bg-[#E5EAD7] shadow-[0_18px_34px_rgba(56,41,27,0.18)]">
                    <div className="relative h-full w-full overflow-hidden rounded-full bg-[#F7F3EA]">
                      <div className="absolute inset-x-0 top-0 h-[46px] rounded-b-[24px] bg-[#A8BB69]" />
                      <div className="absolute left-1/2 top-[22px] h-[54px] w-[54px] -translate-x-1/2 rounded-full bg-[#5C3A26]" />
                      <div className="absolute bottom-0 left-1/2 h-[54px] w-[84px] -translate-x-1/2 rounded-t-[38px] bg-[#5C3A26]" />
                      <div className="absolute bottom-[28px] left-1/2 h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[26px] border-x-transparent border-t-white" />
                    </div>
                  </div>
                  <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#6A4227] text-white">
                    <LinkIcon className="h-5 w-5" />
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-12 max-w-[320px]">
                <div className="mx-auto w-[260px]">
                  <ProfileRestrictionIllustration />
                </div>
                <h2 className="mt-8 text-[28px] font-extrabold tracking-[-0.04em] text-[#5C3A26]">
                  Access Restricted
                </h2>
                <p className="mt-5 text-[18px] leading-[1.55] text-[#786E68]">
                  Profile is only available to logged-in users. Sign up or log in
                  to access profile
                </p>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
              <div className="w-full bg-[#5C3A26] px-8 pb-7 pt-6">
                <div className="grid grid-cols-3 gap-3">
                  <Link
                    href="/dashboard"
                    className="flex flex-col items-center gap-3 text-[#D8BCAC]"
                  >
                    <span className="flex h-[82px] w-[82px] items-center justify-center rounded-full">
                      <UsersRound className="h-10 w-10" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-extrabold tracking-[0.16em]">
                      GROUPS
                    </span>
                  </Link>
                  <Link
                    href="/dashboard?screen=messages"
                    className="flex flex-col items-center gap-3 text-[#D8BCAC]"
                  >
                    <span className="flex h-[82px] w-[82px] items-center justify-center rounded-full">
                      <MessageCircleMore className="h-10 w-10" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-extrabold tracking-[0.16em]">
                      MESSAGES
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-3 text-white"
                  >
                    <span className="flex h-[82px] w-[82px] items-center justify-center rounded-full bg-[#A8704C]">
                      <UserRound className="h-10 w-10" strokeWidth={1.8} />
                    </span>
                    <span className="text-[15px] font-extrabold tracking-[0.16em]">
                      PROFILE
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`${!isAuthenticated ? "hidden md:block" : ""} min-h-screen bg-[#FBF8F4] text-[#5B3B29]`}
      >
      <div className="relative h-[244px] overflow-hidden bg-[#465728]">
        <ProfileHeaderPattern />
        <div className="absolute left-8 top-8 z-10 flex items-center gap-5">
          <button
            onClick={handleBackNavigation}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[20px] font-extrabold tracking-[-0.03em] text-white">
            Profile
          </h1>
        </div>
      </div>

      <div className="relative mx-auto max-w-[980px] px-6 pb-16">
        <div className="-mt-[72px] flex justify-center">
          <div className="relative">
            <AvatarCircle
              imageSrc={avatarPreview || user?.avatarUrl || null}
              fallbackText={buildInitials(profileAvatarSeed)}
              size="xl"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUpdatingAvatar}
              className="absolute bottom-1 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_12px_24px_rgba(88,60,38,0.24)]"
              aria-label="Update profile image"
            >
              {isUpdatingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleAvatarUpload(event)}
            />
          </div>
        </div>

        <div className="mx-auto mt-5 max-w-[600px] text-center">
          <h1 className="text-[34px] font-extrabold tracking-[-0.04em] text-[#5B3B29]">
            {profileName}
          </h1>
          <p className="mt-1 text-[16px] font-bold text-[#75675F]">{profileUsername}</p>
          <p className="mx-auto mt-4 max-w-[540px] text-[18px] font-semibold leading-[1.35] text-[#6F635C]">
            {profileBio}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/setup-profile"
              className="inline-flex items-center gap-3 rounded-full border border-[#D9C6BA] bg-white px-7 py-4 text-[17px] font-extrabold text-[#6A4227]"
            >
              Edit Profile
              <Pencil className="h-5 w-5" />
            </Link>
          </div>
          {avatarActionError ? (
            <div className="mt-5 rounded-[18px] border border-[#E5B49A] bg-[#FFF2EA] px-5 py-4 text-sm font-semibold leading-6 text-[#8B4B1E]">
              {avatarActionError}
            </div>
          ) : null}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="flex items-center gap-4">
                  <UsersRound className="h-9 w-9 text-[#6A4227]" />
                  <h2 className="text-[28px] font-extrabold tracking-[-0.04em] text-[#5B3B29]">
                    Cliques
                  </h2>
                </div>
                <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#6A4227]">
                  Here are cliques below
                </p>
              </div>
              <span className="text-[44px] font-extrabold tracking-[-0.04em] text-[#8D613E]">
                {dashboardGroups.length}
              </span>
            </div>

            {dashboardGroups.length === 0 ? (
              <div className="rounded-[20px] border border-[#E7DDD4] bg-white px-5 py-8 text-[16px] leading-7 text-[#6F635C]">
                You have not joined any cliques yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[20px] border border-[#E7DDD4] bg-white">
                {dashboardGroups.map((group, index) => (
                  <div
                    key={group.id}
                    className={`flex items-center justify-between gap-4 px-5 py-4 ${
                      index > 0 ? "border-t border-[#E7DDD4]" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className="relative h-16 w-16 overflow-hidden rounded-full shadow-[0_10px_20px_rgba(56,41,27,0.1)]"
                        style={{ backgroundColor: group.avatarBackground }}
                      >
                        <Image
                          src={group.avatarSrc}
                          alt={`${group.listTitle} group`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="break-words text-[17px] font-extrabold"
                          style={{ color: group.accent }}
                        >
                          {group.listTitle}
                        </p>
                        <div className="mt-2 space-y-2 text-[14px] font-semibold text-[#6F635C]">
                          <span className="block">{group.membersLabel}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Share2 className="h-4 w-4" />
                            Share
                          </span>
                        </div>
                      </div>
                    </div>

                    {typeof group.unreadCount === "number" && group.unreadCount > 0 ? (
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] font-extrabold text-white"
                        style={{ backgroundColor: group.accent }}
                      >
                        {group.unreadCount}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-8">
            <ProfileDisplaySection
              title="Categories"
              count={selectedCategories.length}
              subtitle="Here are my categories below"
              items={selectedCategories.map((category) => getCategoryLabel(category))}
            />

            <ProfileDisplaySection
              title="Skills"
              count={selectedSkills.length}
              subtitle="Here are my skills below"
              items={selectedSkills.map((skill) => getSkillLabel(skill))}
            />
          </section>
        </div>

        <div className="mt-14 flex items-center justify-center gap-5 text-[#6A4227]">
          {xHandle?.trim() ? (
            <SocialLinkIcon href={xHandle} label="X">
              <span className="text-[30px] font-extrabold">X</span>
            </SocialLinkIcon>
          ) : null}
          {linkedin?.trim() ? (
            <SocialLinkIcon href={linkedin} label="LinkedIn">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#0A66C2] text-[17px] font-extrabold text-white">
                in
              </span>
            </SocialLinkIcon>
          ) : null}
          {portfolio?.trim() ? (
            <SocialLinkIcon href={portfolio} label="Portfolio">
              <LinkIcon className="h-7 w-7" />
            </SocialLinkIcon>
          ) : null}
          {(emailAddress || user?.email) ? (
            <EmailCopyButton email={emailAddress || user?.email || ""} />
          ) : null}
        </div>

        <div className="mt-12 border-t border-[#E7DDD4] pt-8">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="mx-auto inline-flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full border border-[#E6CFC4] bg-[#FFF5EE] px-7 py-4 text-[17px] font-extrabold text-[#A4501A] disabled:opacity-60"
          >
            {isLoggingOut ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
            {isLoggingOut ? "Signing Out..." : "Log out"}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

function ProfileDisplaySection({
  title,
  count,
  subtitle,
  items,
}: {
  title: string;
  count: number;
  subtitle: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-4">
            {title === "Categories" ? (
              <LayoutGrid className="h-8 w-8 text-[#6A4227]" />
            ) : (
              <BriefcaseBusiness className="h-8 w-8 text-[#6A4227]" />
            )}
            <h2 className="text-[28px] font-extrabold tracking-[-0.04em] text-[#5B3B29]">
              {title}
            </h2>
          </div>
          <p className="mt-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#6A4227]">
            {subtitle}
          </p>
        </div>
        <span className="text-[44px] font-extrabold tracking-[-0.04em] text-[#8D613E]">
          {count}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[14px] border border-[#D8DBDC] bg-white px-4 py-4 text-[15px] font-semibold text-[#7A6C64] shadow-[0_6px_16px_rgba(116,104,93,0.08)]">
          No {title.toLowerCase()} added yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((item) => (
            <div
              key={`${title}-${item}`}
              className="rounded-[14px] border border-[#D8DBDC] bg-white px-4 py-2 text-[15px] font-extrabold text-[#9B673E] shadow-[0_6px_16px_rgba(116,104,93,0.08)]"
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeHref(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "#";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Tries to open the system mail client via mailto: first.
 * If the browser has no mail client configured (common on developer
 * machines), it copies the email address to clipboard as a fallback
 * and briefly shows "Copied!" so the user knows something happened.
 */
function EmailCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    // Try mailto: first — if the OS handles it, great.
    // If it can't (no default mail client), copy to clipboard instead.
    const mailtoLink = document.createElement("a");
    mailtoLink.href = `mailto:${email}`;
    mailtoLink.click();

    // Copy to clipboard as a fallback regardless — worst case the user
    // gets both behaviors, which is fine.
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API not available — mailto: is the only option.
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "Email address copied!" : "Copy email address"}
      title={copied ? "Copied!" : email}
      className="relative flex flex-col items-center transition-transform hover:scale-105"
    >
      <Mail className="h-7 w-7" />
      {copied ? (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-[#3aa757]">
          Copied!
        </span>
      ) : null}
    </button>
  );
}

function SocialLinkIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const safeHref = normalizeHref(href);

  return (
    <a
      href={safeHref}
      target={safeHref.startsWith("mailto:") ? undefined : "_blank"}
      rel={safeHref.startsWith("mailto:") ? undefined : "noreferrer"}
      aria-label={label}
      className="transition-transform hover:scale-105"
    >
      {children}
    </a>
  );
}

function deriveUsername(name: string, email: string) {
  const trimmedName = name.trim();
  if (trimmedName) {
    return `@${trimmedName.toLowerCase().replace(/\s+/g, "")}`;
  }

  const emailPrefix = email.split("@")[0]?.trim();
  return emailPrefix ? `@${emailPrefix.toLowerCase()}` : "@user";
}

function buildInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "SC";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function ProfileRestrictionIllustration() {
  return (
    <svg viewBox="0 0 320 260" className="h-auto w-full">
      <ellipse cx="186" cy="124" rx="100" ry="92" fill="#F5EAE5" />
      <ellipse cx="95" cy="130" rx="18" ry="11" fill="#EADFD9" transform="rotate(-35 95 130)" />
      <ellipse cx="270" cy="98" rx="16" ry="10" fill="#EADFD9" transform="rotate(55 270 98)" />
      <path d="M96 188V101" stroke="#F6871C" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M62 113 97 54l35 59H62Z"
        fill="#fff"
        stroke="#F6871C"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path d="M97 78v20" stroke="#5C3A26" strokeWidth="8" strokeLinecap="round" />
      <circle cx="97" cy="106" r="4.5" fill="#5C3A26" />
      <path
        d="M160 219c4-28 28-48 57-48 31 0 55 20 58 48h-115Z"
        fill="#FFC12E"
      />
      <path
        d="M171 160c0-22 17-39 38-39 21 0 38 17 38 39-4 28-18 45-38 45s-34-17-38-45Z"
        fill="#F6B27A"
      />
      <path
        d="M174 154c16-31 39-39 58-28 12 7 18 17 24 32-15-6-33-6-52-2-9 2-20 1-30-2Z"
        fill="#473025"
      />
      <path
        d="M220 108c18 4 36 21 43 41-7-6-13-7-20-5 0-18-11-29-23-36Z"
        fill="#473025"
      />
      <path
        d="M163 205c18 12 45 13 74 3l-6 30h-56l-12-33Z"
        fill="#F1A05E"
      />
    </svg>
  );
}
