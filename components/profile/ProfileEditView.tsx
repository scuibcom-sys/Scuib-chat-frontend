"use client";

import Image from "next/image";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  Link as LinkIcon,
  Loader2,
  Mail,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  type Category,
  type Skill,
  useProfileSetupStore,
} from "@/store/profileSetupStore";
import {
  extractApiErrorMessage,
  fetchProfile,
  isSessionInvalidationError,
  SESSION_EXPIRED_ERROR_MESSAGE,
  uploadProfileAvatar,
  updateProfile,
} from "@/utils/scuibApi";
import {
  CATEGORY_OPTIONS,
  getCategoryLabel,
  normalizeCategory,
  normalizeSkill,
  getSkillLabel,
  SKILL_OPTIONS,
} from "@/components/profile/profileOptions";

export function ProfileEditView() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
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
    setFullName,
    setUsername,
    setEmailAddress,
    setBio,
    setLinkedin,
    setXHandle,
    setPortfolio,
    setAvatarPreview,
    hydrateProfile,
    toggleCategory,
    toggleSkill,
    removeCategory,
    removeSkill,
  } = useProfileSetupStore();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasSeededFallbackProfileRef = useRef(false);

  // Wait for zustand persist to finish reading tokens from localStorage
  // before attempting any API call — same pattern as DashboardWorkspace
  // and StatusStrip. Without this guard, loadProfile fires before the
  // auth store has hydrated, gets no token, and immediately shows
  // "Unable to load your profile" even before the user has done anything.
  const [hasHydrated, setHasHydrated] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );

  useEffect(() => {
    const unsubscribe = useAuthStore.persist?.onFinishHydration(() => {
      setHasHydrated(true);
    });
    return () => unsubscribe?.();
  }, []);

  const handleSessionExpired = useCallback(async () => {
    setProfileError(SESSION_EXPIRED_ERROR_MESSAGE);
    setSaveError(SESSION_EXPIRED_ERROR_MESSAGE);
    await logout();
    router.replace("/signin?notice=session-expired");
  }, [logout, router]);

  useEffect(() => {
    if (hasSeededFallbackProfileRef.current) {
      return;
    }

    const fallbackEmail = user?.email ?? "";
    const fallbackName = user?.name ?? "";
    const fallbackUsername =
      username || deriveUsername(fallbackName, fallbackEmail);

    if (fullName || username || emailAddress) {
      hasSeededFallbackProfileRef.current = true;
      return;
    }

    hydrateProfile({
      fullName: fallbackName || undefined,
      username: fallbackUsername || undefined,
      emailAddress: fallbackEmail || undefined,
    });
    hasSeededFallbackProfileRef.current = true;
  }, [emailAddress, fullName, hydrateProfile, user, username]);

  const avatarFallbackSeed =
    fullName || user?.name || emailAddress || user?.email || "S";

  useEffect(() => {
    if (!hasHydrated || !accessToken) return;

    let isActive = true;

    const loadProfile = async () => {
      setProfileError(null);

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

        const normalizedCategories = profile.categories
          .map((category) => normalizeCategory(category))
          .filter((category): category is Category => Boolean(category));
        const normalizedSkills = profile.skills
          .map((skill) => normalizeSkill(skill))
          .filter((skill): skill is Skill => Boolean(skill));

        hydrateProfile({
          fullName: profile.fullName || undefined,
          username: profile.username || undefined,
          bio: profile.bio,
          linkedin: profile.linkedin,
          xHandle: profile.xHandle,
          portfolio: profile.portfolio,
          avatarPreview: profile.avatarUrl,
          selectedCategories: normalizedCategories,
          selectedSkills: normalizedSkills,
        });
        setPendingAvatarFile(null);
      } catch (error) {
        if (!isActive) return;
        if (isSessionInvalidationError(error)) {
          void handleSessionExpired();
          return;
        }
        // Silently fail if we can't load the fresh profile. The user
        // will still have their fallback data from the auth store, and
        // this prevents confusing backend errors (e.g. rate limits or
        // method not allowed) from showing as huge red banners on load.
        console.error("Failed to fetch fresh profile data:", error);
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [
    hasHydrated,
    accessToken,
    handleSessionExpired,
    hydrateProfile,
    refreshToken,
    setTokens,
    tokenType,
  ]);

  const filteredCategoryOptions = CATEGORY_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  );

  const filteredSkillOptions = SKILL_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(skillQuery.trim().toLowerCase()),
  );

  const MAX_AVATAR_SIZE_MB = 5;
  const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > MAX_AVATAR_SIZE_BYTES) {
      setSaveError(
        `Your photo is too large (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Please choose one under ${MAX_AVATAR_SIZE_MB}MB.`,
      );
      event.target.value = "";
      return;
    }

    setSaveError(null);
    setPendingAvatarFile(selectedFile);

    const reader = new FileReader();
    reader.onload = () => {
      const result =
        typeof reader.result === "string" ? reader.result : null;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(selectedFile);
    event.target.value = "";
  };

  const handleSaveProfile = async () => {
    setProfileError(null);
    setSaveError(null);
    setIsSaving(true);

    try {
      let savedProfile: Awaited<ReturnType<typeof updateProfile>> | null = null;
      let uploadedAvatarUrl = avatarPreview;
      let avatarUploadError: string | null = null;

      if (accessToken) {
        if (pendingAvatarFile) {
          // Avatar upload is intentionally decoupled from the rest of the
          // profile save — a Cloudinary failure (e.g. invalid backend
          // signature) should not block bio, links, skills, etc. from
          // saving. If the avatar upload fails, we keep the existing
          // avatar URL and surface a specific warning below without
          // aborting the whole save.
          try {
            uploadedAvatarUrl = await uploadProfileAvatar(
              pendingAvatarFile,
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
            );
          } catch (avatarError) {
            const errorMsg = extractApiErrorMessage(avatarError, "failed");
            avatarUploadError = `Your profile photo couldn't be uploaded (${errorMsg}) — everything else was saved.`;
            // Keep the current avatar URL rather than clearing it.
            uploadedAvatarUrl = avatarPreview;
          }
        }

        savedProfile = await updateProfile(
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          {
            fullName,
            username,
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
      }

      if (user) {
        setUser({
          ...user,
          name: savedProfile?.fullName || fullName || user.name,
          username: savedProfile?.username || username || user.username || null,
          avatarUrl:
            savedProfile?.avatarUrl ??
            uploadedAvatarUrl ??
            user.avatarUrl ??
            null,
        });
      }

      hydrateProfile({
        fullName: savedProfile?.fullName || fullName,
        username: savedProfile?.username || username,
        avatarPreview: savedProfile?.avatarUrl ?? uploadedAvatarUrl,
        bio: savedProfile?.bio ?? bio,
        linkedin: savedProfile?.linkedin ?? linkedin,
        xHandle: savedProfile?.xHandle ?? xHandle,
        portfolio: savedProfile?.portfolio ?? portfolio,
        selectedCategories:
          savedProfile?.categories
            ?.map((category) => normalizeCategory(category))
            .filter((category): category is Category => Boolean(category)) ??
          selectedCategories,
        selectedSkills:
          savedProfile?.skills
            ?.map((skill) => normalizeSkill(skill))
            .filter((skill): skill is Skill => Boolean(skill)) ??
          selectedSkills,
      });
      setPendingAvatarFile(null);

      if (avatarUploadError) {
        // Profile data saved successfully but avatar upload failed.
        // Show a specific, honest warning rather than a generic error,
        // and still navigate to the profile so the user can see their
        // other changes took effect.
        setSaveError(avatarUploadError);
        setIsSaving(false);
        return;
      }

      router.replace("/profile?updated=1");
    } catch (error) {
      if (isSessionInvalidationError(error)) {
        await handleSessionExpired();
        return;
      }
      setSaveError(
        extractApiErrorMessage(error, "Unable to update your profile right now."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F4] text-[#5B3B29]">
      <div className="relative h-[238px] overflow-hidden bg-[#465728]">
        <ProfileHeaderPattern />
        <div className="absolute left-8 top-8 z-10 flex items-center gap-5">
          <button
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[20px] font-extrabold tracking-[-0.03em] text-white">
            Profile Setup
          </h1>
        </div>
      </div>

      <div className="relative mx-auto max-w-[420px] px-6 pb-12">
        <div className="-mt-12 flex justify-center">
          <div className="relative">
            <AvatarCircle
              imageSrc={avatarPreview || user?.avatarUrl || null}
              fallbackText={buildInitials(avatarFallbackSeed)}
              size="lg"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_12px_24px_rgba(88,60,38,0.24)]"
              aria-label="Upload profile photo"
            >
              <Plus className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <ProfileField
            label="FullName"
            value={fullName}
            onChange={setFullName}
            placeholder="Enter full name"
            icon={<UserRound className="h-5 w-5 text-[#6A4227]" />}
          />
          <ProfileField
            label="Username"
            value={username}
            onChange={setUsername}
            placeholder="Enter username"
          />
          <ProfileField
            label="Email Address"
            value={emailAddress}
            onChange={setEmailAddress}
            placeholder="Enter email address"
            icon={<Mail className="h-5 w-5 text-[#6A4227]" />}
            readOnly
          />
          <ProfileField
            label="Bio"
            value={bio}
            onChange={setBio}
            placeholder="Tell people about yourself"
          />

          <ProfileDropdownSection<Category>
            title="Categories"
            query={categoryQuery}
            onQueryChange={setCategoryQuery}
            placeholder="Search categories"
            selectedItems={selectedCategories}
            getLabel={getCategoryLabel}
            onToggleItem={toggleCategory}
            onRemoveItem={removeCategory}
            options={filteredCategoryOptions}
          />

          <ProfileDropdownSection<Skill>
            title="Skills"
            query={skillQuery}
            onQueryChange={setSkillQuery}
            placeholder="Search skills"
            selectedItems={selectedSkills}
            getLabel={getSkillLabel}
            onToggleItem={toggleSkill}
            onRemoveItem={removeSkill}
            options={filteredSkillOptions}
          />

          <ProfileField
            label="Linkedin"
            value={linkedin}
            onChange={setLinkedin}
            placeholder="Add your LinkedIn link"
            icon={<AtSign className="h-5 w-5 text-[#6A4227]" />}
          />
          <ProfileField
            label="X"
            value={xHandle}
            onChange={setXHandle}
            placeholder="Add your X profile"
            icon={<AtSign className="h-5 w-5 text-[#6A4227]" />}
          />
          <ProfileField
            label="portfolio"
            value={portfolio}
            onChange={setPortfolio}
            placeholder="Add your portfolio link"
            icon={<LinkIcon className="h-5 w-5 text-[#6A4227]" />}
          />
        </div>

        {profileError ? (
          <div className="mt-5 rounded-[18px] border border-[#E5B49A] bg-[#FFF2EA] px-5 py-4 text-sm font-semibold leading-6 text-[#8B4B1E]">
            {profileError}
          </div>
        ) : null}

        {saveError ? (
          <div className="mt-5 rounded-[18px] border border-[#E5B49A] bg-[#FFF2EA] px-5 py-4 text-sm font-semibold leading-6 text-[#8B4B1E]">
            {saveError}
          </div>
        ) : null}

        <button
          onClick={handleSaveProfile}
          disabled={isSaving}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#6A4227] px-6 py-5 text-[18px] font-extrabold tracking-[-0.03em] text-white transition-colors hover:bg-[#5D3923] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {isSaving ? "Updating..." : "Update"}
        </button>
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-extrabold tracking-[-0.02em] text-[#5B3B29]">
        {label}
      </span>
      <div className="rounded-full bg-[#DCE7BC] p-[2px] shadow-[0_8px_16px_rgba(76,90,34,0.08)]">
        <div className="flex h-[54px] items-center rounded-full bg-white px-5">
          {icon ? <div className="mr-3 shrink-0">{icon}</div> : null}
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className="w-full bg-transparent text-[15px] font-semibold text-[#6A5A51] placeholder:text-[#8B817A] focus:outline-none read-only:cursor-default"
          />
        </div>
      </div>
    </label>
  );
}

function ProfileDropdownSection<T extends string>({
  title,
  query,
  onQueryChange,
  placeholder,
  selectedItems,
  getLabel,
  onToggleItem,
  onRemoveItem,
  options,
}: {
  title: string;
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  selectedItems: T[];
  getLabel: (value: T) => string;
  onToggleItem: (value: T) => void;
  onRemoveItem: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-[13px] font-extrabold tracking-[-0.02em] text-[#5B3B29]">
          {title}
        </span>
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#8B817A]">
          {selectedItems.length} selected
        </span>
      </div>
      <div className="rounded-full bg-[#DCE7BC] p-[2px] shadow-[0_8px_16px_rgba(76,90,34,0.08)]">
        <div className="flex h-[54px] items-center rounded-full bg-white px-5">
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-[15px] font-semibold text-[#6A5A51] placeholder:text-[#8B817A] focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 max-h-[220px] overflow-y-auto rounded-[20px] border border-[#E7DDD4] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(116,104,93,0.06)]">
        <div className="flex flex-wrap gap-3">
          {options.map((option) => {
            const isSelected = selectedItems.includes(option.id);

            return (
              <button
                key={`${title}-option-${option.id}`}
                type="button"
                onClick={() => onToggleItem(option.id)}
                className="rounded-full px-4 py-2 text-[14px] font-extrabold transition-colors"
                style={{
                  backgroundColor: isSelected ? "#F48519" : "#F7F3EA",
                  color: isSelected ? "#FFFFFF" : "#6A4227",
                }}
              >
                {option.label}
              </button>
            );
          })}
          {options.length === 0 ? (
            <p className="text-[14px] font-semibold text-[#8B817A]">
              No matches found.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-4">
        {selectedItems.map((item) => (
          <SelectedPill
            key={`${title}-${item}`}
            label={getLabel(item)}
            onRemove={() => onRemoveItem(item)}
          />
        ))}
      </div>
    </div>
  );
}

function SelectedPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-transparent text-[#6A4227]"
        aria-label={`Remove ${label}`}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="rounded-[14px] border border-[#D8DBDC] bg-white px-4 py-2 text-[15px] font-extrabold text-[#9B673E] shadow-[0_6px_16px_rgba(116,104,93,0.08)]">
        {label}
      </div>
    </div>
  );
}

export function ProfileHeaderPattern() {
  return (
    <>
      <div className="absolute inset-0 md:hidden">
        <Image
          src="/bg_image_mobile.svg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 hidden md:block">
        <Image
          src="/bg_image_desktop.svg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
    </>
  );
}

export function AvatarCircle({
  imageSrc,
  fallbackText,
  size,
}: {
  imageSrc: string | null;
  fallbackText: string;
  size: "lg" | "xl";
}) {
  const sizeClasses =
    size === "xl" ? "h-[120px] w-[120px]" : "h-[94px] w-[94px]";

  return (
    <div
      className={`relative overflow-hidden rounded-full bg-[#D4C1A2] shadow-[0_18px_28px_rgba(56,41,27,0.18)] ${sizeClasses}`}
    >
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt="Profile"
          fill
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#EBDCC6_0%,#C8AF8D_100%)] text-[28px] font-extrabold text-[#6A4227]">
          {fallbackText}
        </div>
      )}
    </div>
  );
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

function deriveUsername(name: string, email: string) {
  const trimmedName = name.trim();
  if (trimmedName) {
    return `@${trimmedName.toLowerCase().replace(/\s+/g, "")}`;
  }

  const emailPrefix = email.split("@")[0]?.trim();
  return emailPrefix ? `@${emailPrefix.toLowerCase()}` : "@user";
}

