import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Category = string;

export type Skill = string;

export function getOnboardingUserKey(
  user?: { email?: string | null; id?: string | null } | null,
  fallbackIdentifier?: string | null,
) {
  // Prefer user ID as the key since it's always available immediately after
  // login, unlike email which may not be in the auth store yet during initial
  // sign-up. Using email first caused a key mismatch where completion was
  // stored under the user ID but checked under the email (or vice versa),
  // causing the app to think onboarding was never completed.
  const id = user?.id?.trim().toLowerCase();
  if (id) return id;

  const fallback = fallbackIdentifier?.trim().toLowerCase();
  if (fallback) return fallback;

  const email = user?.email?.trim().toLowerCase();
  return email || null;
}

interface ProfileSetupState {
  fullName: string;
  username: string;
  emailAddress: string;
  bio: string;
  linkedin: string;
  xHandle: string;
  portfolio: string;
  avatarPreview: string | null;
  selectedCategories: Category[];
  selectedSkills: Skill[];
  currentStep: number;
  remoteProfileMissing: boolean;
  onboardingCompletedByUser: Record<string, boolean>;
  setFullName: (fullName: string) => void;
  setUsername: (username: string) => void;
  setEmailAddress: (emailAddress: string) => void;
  setBio: (bio: string) => void;
  setLinkedin: (linkedin: string) => void;
  setXHandle: (xHandle: string) => void;
  setPortfolio: (portfolio: string) => void;
  setAvatarPreview: (avatarPreview: string | null) => void;
  hydrateProfile: (profile: {
    fullName?: string;
    username?: string;
    emailAddress?: string;
    bio?: string;
    linkedin?: string;
    xHandle?: string;
    portfolio?: string;
    avatarPreview?: string | null;
    selectedCategories?: Category[];
    selectedSkills?: Skill[];
  }) => void;
  setSelectedCategories: (categories: Category[]) => void;
  setSelectedSkills: (skills: Skill[]) => void;
  setRemoteProfileMissing: (remoteProfileMissing: boolean) => void;
  hasCompletedOnboarding: (userKey: string | null | undefined) => boolean;
  markOnboardingCompleted: (userKey: string | null | undefined) => void;
  toggleCategory: (category: Category) => void;
  toggleSkill: (skill: Skill) => void;
  removeCategory: (category: Category) => void;
  removeSkill: (skill: Skill) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

const defaultState = {
  fullName: "",
  username: "",
  emailAddress: "",
  bio: "",
  linkedin: "",
  xHandle: "",
  portfolio: "",
  avatarPreview: null,
  selectedCategories: [] as Category[],
  selectedSkills: [] as Skill[],
  currentStep: 1,
  remoteProfileMissing: false,
  onboardingCompletedByUser: {} as Record<string, boolean>,
};

export const useProfileSetupStore = create<ProfileSetupState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setFullName: (fullName) => set({ fullName }),
      setUsername: (username) => set({ username }),
      setEmailAddress: (emailAddress) => set({ emailAddress }),
      setBio: (bio) => set({ bio }),
      setLinkedin: (linkedin) => set({ linkedin }),
      setXHandle: (xHandle) => set({ xHandle }),
      setPortfolio: (portfolio) => set({ portfolio }),
      setAvatarPreview: (avatarPreview) => set({ avatarPreview }),

      hydrateProfile: (profile) =>
        set((state) => ({
          fullName: profile.fullName?.trim() || state.fullName,
          username: profile.username?.trim() || state.username,
          emailAddress: profile.emailAddress?.trim() || state.emailAddress,
          bio: profile.bio?.trim() ? profile.bio : state.bio,
          linkedin: profile.linkedin?.trim() || state.linkedin,
          xHandle: profile.xHandle?.trim() || state.xHandle,
          portfolio: profile.portfolio?.trim() || state.portfolio,
          avatarPreview:
            profile.avatarPreview === undefined
              ? state.avatarPreview
              : profile.avatarPreview,
          selectedCategories:
            profile.selectedCategories ?? state.selectedCategories,
          selectedSkills: profile.selectedSkills ?? state.selectedSkills,
        })),

      setSelectedCategories: (selectedCategories) => set({ selectedCategories }),
      setSelectedSkills: (selectedSkills) => set({ selectedSkills }),
      setRemoteProfileMissing: (remoteProfileMissing) =>
        set({ remoteProfileMissing }),
      hasCompletedOnboarding: (userKey) =>
        Boolean(userKey && get().onboardingCompletedByUser[userKey]),
      markOnboardingCompleted: (userKey) => {
        if (!userKey) return;

        set((state) => ({
          onboardingCompletedByUser: {
            ...state.onboardingCompletedByUser,
            [userKey]: true,
          },
        }));
      },

      toggleCategory: (category) => {
        const { selectedCategories } = get();
        if (selectedCategories.includes(category)) {
          set({
            selectedCategories: selectedCategories.filter(
              (currentCategory) => currentCategory !== category,
            ),
          });
        } else {
          set({ selectedCategories: [...selectedCategories, category] });
        }
      },

      toggleSkill: (skill) => {
        const { selectedSkills } = get();
        if (selectedSkills.includes(skill)) {
          set({
            selectedSkills: selectedSkills.filter(
              (currentSkill) => currentSkill !== skill,
            ),
          });
        } else {
          set({ selectedSkills: [...selectedSkills, skill] });
        }
      },

      removeCategory: (category) =>
        set((state) => ({
          selectedCategories: state.selectedCategories.filter(
            (currentCategory) => currentCategory !== category,
          ),
        })),

      removeSkill: (skill) =>
        set((state) => ({
          selectedSkills: state.selectedSkills.filter(
            (currentSkill) => currentSkill !== skill,
          ),
        })),

      setStep: (step) => set({ currentStep: step }),

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(3, state.currentStep + 1),
        })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(1, state.currentStep - 1),
        })),

      reset: () =>
        set((state) => ({
          ...defaultState,
          onboardingCompletedByUser: state.onboardingCompletedByUser,
        })),
    }),
    {
      name: "profile-setup-storage",
      // avatarPreview holds a full base64-encoded image (FileReader
      // readAsDataURL output), which can easily be 10MB+ for a normal
      // photo. Persisting that to localStorage routinely exceeds the
      // browser's quota (~5-10MB total) and throws QuotaExceededError,
      // which crashes the avatar upload flow. The preview only needs to
      // last for the current session anyway — the real, durable copy
      // lives on Cloudinary/the backend once upload succeeds — so it's
      // excluded here and kept in memory-only state instead.
      partialize: (state) => {
        // Excluded from localStorage persistence to prevent QuotaExceededError:
        // - avatarPreview: base64-encoded image, can be 10MB+
        // - selectedCategories/selectedSkills: large arrays when many items
        //   are picked — the quota overflow causes a silent crash that resets
        //   the onboarding step back to 1. These are temporary onboarding
        //   selections that don't need to survive a page reload.
        // onboardingCompletedByUser MUST stay persisted — it's what prevents
        // completed users from being re-prompted for onboarding.
        const {
          avatarPreview,
          selectedCategories,
          selectedSkills,
          ...persistedState
        } = state;
        void avatarPreview;
        void selectedCategories;
        void selectedSkills;
        return persistedState;
      },
    },
  ),
);
