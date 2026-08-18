// store/onboardingStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Clique = "uiux" | "frontend" | "backend" | "mobile";

interface OnboardingState {
  selectedCliques: Clique[];
  currentStep: number;
  hasCompletedOnboarding: boolean;

  // Actions
  toggleClique: (clique: Clique) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      selectedCliques: [],
      currentStep: 0,
      hasCompletedOnboarding: false,

      toggleClique: (clique) => {
        const { selectedCliques } = get();
        if (selectedCliques.includes(clique)) {
          set({ selectedCliques: selectedCliques.filter((c) => c !== clique) });
        } else {
          set({ selectedCliques: [...selectedCliques, clique] });
        }
      },

      setStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < 4) {
          set({ currentStep: currentStep + 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 });
        }
      },

      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true });
      },

      reset: () => {
        set({
          selectedCliques: [],
          currentStep: 0,
          hasCompletedOnboarding: false,
        });
      },
    }),
    {
      name: "onboarding-storage",
    },
  ),
);
