"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  getOnboardingUserKey,
  type Category,
  type Skill,
  useProfileSetupStore,
} from "@/store/profileSetupStore";
import {
  CATEGORY_OPTIONS,
  normalizeCategory,
  normalizeSkill,
  SKILL_OPTIONS,
} from "@/components/profile/profileOptions";
import {
  ApiError,
  extractApiErrorMessage,
  fetchProfile,
  isProfileComplete,
  updateProfile,
} from "@/utils/scuibApi";

const HEADER_COLOR = "#455726";
const ACCENT_COLOR = "#9BB168";
const ACTION_COLOR = "#A6BA63";
const SELECTED_CHIP_COLOR = "#F48519";

export function NewUserOnboardingFlow() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);
  const {
    bio,
    emailAddress,
    selectedCategories,
    selectedSkills,
    currentStep,
    remoteProfileMissing,
    hasCompletedOnboarding,
    markOnboardingCompleted,
    setBio,
    toggleCategory,
    toggleSkill,
    hydrateProfile,
    setRemoteProfileMissing,
    nextStep,
    prevStep,
    setStep,
  } = useProfileSetupStore();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [isOptionListExpanded, setIsOptionListExpanded] = useState(false);
  const onboardingUserKey = getOnboardingUserKey(user, emailAddress);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/signin");
      return;
    }

    let isActive = true;

    const loadProfile = async () => {
      if (remoteProfileMissing) {
        if (hasCompletedOnboarding(onboardingUserKey)) {
          router.replace("/dashboard");
          return;
        }

        if (isActive) {
          setIsBootstrapping(false);
        }
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

        if (!isActive) return;

        setRemoteProfileMissing(false);

        hydrateProfile({
          fullName: profile.fullName || undefined,
          username: profile.username || undefined,
          bio: profile.bio,
          linkedin: profile.linkedin,
          xHandle: profile.xHandle,
          portfolio: profile.portfolio,
          avatarPreview: profile.avatarUrl,
          selectedCategories: profile.categories
            .map(normalizeCategory)
            .filter((value): value is Category => Boolean(value)),
          selectedSkills: profile.skills
            .map(normalizeSkill)
            .filter((value): value is Skill => Boolean(value)),
        });

        if (isProfileComplete(profile)) {
          markOnboardingCompleted(onboardingUserKey);
          router.replace("/dashboard");
          return;
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setRemoteProfileMissing(true);

          if (hasCompletedOnboarding(onboardingUserKey)) {
            router.replace("/dashboard");
            return;
          }
        }

        // Keep the onboarding screen usable even if the profile preload fails.
      } finally {
        if (isActive) {
          setIsBootstrapping(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    hasCompletedOnboarding,
    hydrateProfile,
    markOnboardingCompleted,
    onboardingUserKey,
    remoteProfileMissing,
    refreshToken,
    router,
    setRemoteProfileMissing,
    setTokens,
    tokenType,
  ]);

  useEffect(() => {
    if (currentStep < 1 || currentStep > 3) {
      setStep(1);
    }
  }, [currentStep, setStep]);

  useEffect(() => {
    setIsOptionListExpanded(false);
  }, [currentStep]);

  const filteredCategories = CATEGORY_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(categoryQuery.trim().toLowerCase()),
  );
  const filteredSkills = SKILL_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(skillQuery.trim().toLowerCase()),
  );
  const currentOptions = currentStep === 2 ? filteredCategories : filteredSkills;
  const selectedOptionCount =
    currentStep === 2 ? selectedCategories.length : selectedSkills.length;

  const heading =
    currentStep === 1 ? (
      <>
        Enter your <AccentWord>Bio</AccentWord>
      </>
    ) : currentStep === 2 ? (
      <>
        Pick your <AccentWord italic>Categories.</AccentWord>
      </>
    ) : (
      <>
        Pick your <AccentWord italic>Skills.</AccentWord>
      </>
    );

  const actionLabel =
    currentStep === 3 ? (isSaving ? "Saving..." : "Done") : "Next";
  const isActionBusy = isBootstrapping || isSaving;
  const isActionDisabled =
    isActionBusy ||
    (currentStep === 1 && bio.trim().length === 0) ||
    (currentStep === 2 && selectedCategories.length === 0) ||
    (currentStep === 3 && selectedSkills.length === 0);

  const handleBack = () => {
    if (currentStep > 1) {
      prevStep();
      return;
    }

    router.back();
  };

  const handleAction = async () => {
    if (isActionDisabled) return;

    if (currentStep === 1 || currentStep === 2) {
      nextStep();
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      await updateProfile(
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        {
          bio,
          categories: selectedCategories,
          skills: selectedSkills,
          categoryLabels: selectedCategories.map((category) =>
            CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? category,
          ),
          skillLabels: selectedSkills.map((skill) =>
            SKILL_OPTIONS.find((option) => option.id === skill)?.label ?? skill,
          ),
        },
        (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        },
      );

      setRemoteProfileMissing(false);
      markOnboardingCompleted(onboardingUserKey);
      router.replace("/dashboard");
    } catch (error) {
      // A 404 means the profile endpoint didn't accept the write, so the
      // onboarding details were never persisted. Surface that instead of
      // silently sending the user to the dashboard as if it had saved.
      setSaveError(
        extractApiErrorMessage(
          error,
          error instanceof ApiError && error.status === 404
            ? "We couldn't reach the profile service, so your details weren't saved. Please try again."
            : "Unable to save your onboarding to the backend right now.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F2EE]">
      <section
        className="relative overflow-hidden px-5 pb-24 pt-8 md:px-8 md:pb-32 md:pt-10 lg:px-10"
        style={{ backgroundColor: HEADER_COLOR }}
      >
        <OnboardingPattern />
        <div className="relative z-10 flex items-start justify-between gap-4 sm:items-center">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4 md:gap-6">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white text-white sm:h-12 sm:w-12 md:h-[72px] md:w-[72px] lg:h-[96px] lg:w-[96px]"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-7 md:w-7 lg:h-9 lg:w-9" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[clamp(1.125rem,5vw,2.875rem)] font-extrabold tracking-[-0.03em] text-white">
                Tell us About You
              </h1>
            </div>
          </div>

          <div className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-extrabold tracking-[-0.03em] text-[#8D684F] sm:px-4 sm:text-base md:px-6 md:py-3 md:text-xl lg:px-8 lg:py-4 lg:text-[26px]">
            {currentStep} of 3
          </div>
        </div>
      </section>

      <section className="relative -mt-10 flex flex-1 flex-col rounded-t-[38px] bg-white px-5 pb-6 pt-8 md:-mt-16 md:rounded-t-[56px] md:px-10 md:pb-8 md:pt-12">
        <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col items-center">
          <h2 className="text-center text-[clamp(2rem,8vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#5A3824]">
            {heading}
          </h2>

          <div className="mt-8 flex w-full flex-1 flex-col items-center md:mt-10">
            {currentStep === 1 ? (
              <div className="w-full flex-1">
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Type a brief description about yourself"
                  className="min-h-[220px] w-full rounded-[26px] bg-[#F7F5F4] px-5 py-5 text-base font-semibold text-[#5A3824] placeholder:text-[#7E756F] focus:outline-none sm:min-h-[250px] sm:px-6 sm:py-6 sm:text-lg md:min-h-[320px] md:rounded-[34px] md:px-8 md:py-8 md:text-[22px] lg:min-h-[360px] lg:rounded-[40px] lg:text-[28px]"
                />
              </div>
            ) : (
              <div className="flex w-full flex-1 flex-col items-center">
                <SearchField
                  value={currentStep === 2 ? categoryQuery : skillQuery}
                  onChange={currentStep === 2 ? setCategoryQuery : setSkillQuery}
                  placeholder={
                    currentStep === 2 ? "Search categories" : "Search skills"
                  }
                />
                <ArcDecoration />
                <div className="mt-4 flex w-full max-w-[760px] items-center justify-between gap-4 px-1 md:mt-6">
                  <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#7C6A5D] md:text-base">
                    {selectedOptionCount} selected
                  </p>
                  {currentOptions.length > 8 ? (
                    <button
                      type="button"
                      onClick={() => setIsOptionListExpanded((currentValue) => !currentValue)}
                      className="rounded-full border border-[#E8DED5] bg-[#FCFAF7] px-4 py-2 text-sm font-extrabold text-[#6C4A33] md:text-base"
                    >
                      {isOptionListExpanded ? "Collapse list" : "Show all"}
                    </button>
                  ) : null}
                </div>
                <div
                  className={`mt-4 w-full max-w-[760px] overflow-y-auto rounded-[28px] border border-[#EEE7DE] bg-[#FCFAF7] px-4 py-4 transition-[max-height] duration-200 md:mt-6 md:px-6 md:py-5 ${
                    isOptionListExpanded ? "max-h-[420px]" : "max-h-[220px]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
                    {currentOptions.map((option) => {
                      const isSelected =
                        currentStep === 2
                          ? selectedCategories.includes(option.id as Category)
                          : selectedSkills.includes(option.id as Skill);

                      return (
                        <SelectableChip
                          key={option.id}
                          label={option.label}
                          active={isSelected}
                          onClick={() =>
                            currentStep === 2
                              ? toggleCategory(option.id as Category)
                              : toggleSkill(option.id as Skill)
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {saveError ? (
              <div className="mt-6 w-full max-w-[640px] rounded-[22px] border border-[#E5B49A] bg-[#FFF2EA] px-5 py-4 text-sm font-semibold leading-6 text-[#8B4B1E]">
                {saveError}
              </div>
            ) : null}

            <div className="mt-auto w-full max-w-[640px] pt-8 md:pt-12">
              <button
                type="button"
                onClick={() => void handleAction()}
                disabled={isActionDisabled}
                className="inline-flex w-full items-center justify-center gap-3 rounded-full px-6 py-3.5 text-base font-extrabold text-white shadow-[0_18px_48px_rgba(155,177,104,0.25)] transition-transform hover:scale-[1.01] disabled:scale-100 disabled:opacity-55 sm:gap-4 sm:px-7 sm:py-4 sm:text-lg md:gap-5 md:px-8 md:py-5 md:text-[22px] lg:gap-6 lg:px-9 lg:py-6 lg:text-[28px]"
                style={{ backgroundColor: ACTION_COLOR }}
              >
                <span>{isBootstrapping ? "Loading..." : actionLabel}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8FA55A] sm:h-14 sm:w-14 md:h-16 md:w-16 lg:h-20 lg:w-20">
                  {isActionBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-9 lg:w-9" />
                  ) : (
                    <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-9 lg:w-9" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative w-full max-w-[560px]">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-14 w-full rounded-full bg-[#F7F5F4] px-6 pr-14 text-base font-semibold text-[#5A3824] placeholder:text-[#7E756F] focus:outline-none sm:h-16 sm:px-7 sm:pr-16 sm:text-lg md:h-20 md:px-8 md:pr-[4.5rem] md:text-[22px] lg:h-[100px] lg:px-9 lg:pr-20 lg:text-[28px]"
      />
      <Search className="absolute right-5 top-1/2 h-6 w-6 -translate-y-1/2 text-[#684630] sm:right-6 sm:h-7 sm:w-7 md:right-7 md:h-8 md:w-8 lg:right-8 lg:h-10 lg:w-10" />
    </label>
  );
}

function SelectableChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-5 py-3 text-sm font-extrabold tracking-[-0.03em] transition-transform hover:scale-[1.02] sm:px-6 sm:py-4 sm:text-base md:px-8 md:py-4 md:text-[20px] lg:px-10 lg:py-5 lg:text-[24px]"
      style={{
        backgroundColor: active ? SELECTED_CHIP_COLOR : "#F7F5F4",
        color: active ? "#FFFFFF" : "#5A3824",
      }}
    >
      {label}
    </button>
  );
}

function AccentWord({
  children,
  italic = false,
}: {
  children: ReactNode;
  italic?: boolean;
}) {
  return (
    <span
      className={italic ? "italic" : undefined}
      style={{ color: ACCENT_COLOR }}
    >
      {children}
    </span>
  );
}

function ArcDecoration() {
  return (
    <svg
      className="mt-6 h-[18px] w-[180px] sm:w-[220px] md:mt-8 md:h-[28px] md:w-[300px] lg:h-[36px] lg:w-[400px]"
      viewBox="0 0 400 36"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 28C95 10 210 6 392 22"
        stroke="#DCE4C6"
        strokeWidth="16"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OnboardingPattern() {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full opacity-70"
        viewBox="0 0 1600 420"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 290H210V170H336C381 170 421 206 421 250C421 294 381 330 336 330H210" stroke="#88A04B" />
        <path d="M420 80H630V290H420V256C420 201 466 170 522 170H630" stroke="#88A04B" />
        <path d="M630 170H790C836 170 875 207 875 250C875 293 836 330 790 330H630" stroke="#88A04B" />
        <path d="M875 290H1085V256C1085 201 1131 170 1187 170H1340C1385 170 1422 206 1422 250C1422 294 1385 330 1340 330H1187" stroke="#88A04B" />
        <path d="M1250 80H1460V170H1340C1290 170 1250 210 1250 260V290" stroke="#88A04B" />
      </svg>

      <div className="absolute left-8 top-1/2 z-10 flex -translate-y-2 gap-3 md:left-10">
        <span className="h-8 w-2 rotate-[-36deg] rounded-full bg-[#F6921E] md:h-12 md:w-3" />
        <span className="mt-3 h-8 w-2 rotate-[-36deg] rounded-full bg-[#F6921E] md:mt-5 md:h-12 md:w-3" />
        <span className="mt-1 h-8 w-2 rotate-[-8deg] rounded-full bg-[#F6921E] md:mt-2 md:h-12 md:w-3" />
      </div>
    </>
  );
}

