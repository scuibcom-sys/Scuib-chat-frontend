"use client";

import { motion } from "framer-motion";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Clique, useOnboardingStore } from "@/store/onboardingStore";

const cliqueConfig: Record<
  Clique,
  { label: string; color: string; bgColor: string }
> = {
  uiux: { label: "UI/UX Designers", color: "#7B9650", bgColor: "#EEF4E3" },
  frontend: { label: "Frontend Devs", color: "#E67E22", bgColor: "#FFF1E4" },
  backend: { label: "Backend Devs", color: "#736B66", bgColor: "#F2EFED" },
  mobile: { label: "Mobile Devs", color: "#C89200", bgColor: "#FFF6DE" },
};

export function GroupSummary() {
  const router = useRouter();
  const selectedCliques = useOnboardingStore((state) => state.selectedCliques);
  const completeOnboarding = useOnboardingStore(
    (state) => state.completeOnboarding,
  );
  const reset = useOnboardingStore((state) => state.reset);
  const setStep = useOnboardingStore((state) => state.setStep);

  const hasSelection = selectedCliques.length > 0;

  const handleContinue = () => {
    completeOnboarding();
    router.push("/signup");
  };

  const handlePickAgain = () => {
    setStep(1);
  };

  const handleRestart = () => {
    reset();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FCF8F1_0%,#F6EFE6_100%)] px-5 py-7 sm:px-7 md:px-10 md:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="overflow-hidden rounded-[36px] bg-white shadow-[0_28px_80px_rgba(79,52,34,0.12)]"
        >
          <div className="bg-[linear-gradient(135deg,#E7F0D7_0%,#FFF1E4_52%,#FCF8F1_100%)] px-6 py-8 sm:px-8 md:px-12 md:py-12">
            <div className="inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-extrabold tracking-[0.24em] text-[#8F654B] shadow-[0_12px_28px_rgba(79,52,34,0.08)]">
              READY TO CONTINUE
            </div>

            <h1 className="mt-5 text-[clamp(2.2rem,6vw,4.4rem)] font-extrabold leading-[0.95] tracking-[-0.06em] text-[#4F3422]">
              {hasSelection
                ? "Your cliques are ready."
                : "You can still continue from here."}
            </h1>

            <p className="mt-5 max-w-[40rem] text-base font-medium leading-8 text-[#736B66] sm:text-lg">
              {hasSelection
                ? "Sign up next so you can move into the communities you picked and continue your onboarding inside the platform."
                : "No clique was selected yet. You can pick again now, or continue to sign up and choose later."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {selectedCliques.map((clique) => (
                <span
                  key={clique}
                  className="rounded-full px-4 py-3 text-sm font-extrabold sm:text-base"
                  style={{
                    backgroundColor: cliqueConfig[clique].bgColor,
                    color: cliqueConfig[clique].color,
                  }}
                >
                  {cliqueConfig[clique].label}
                </span>
              ))}

              {!hasSelection ? (
                <span className="rounded-full bg-[#F6F1EC] px-4 py-3 text-sm font-bold text-[#736B66] sm:text-base">
                  Pick at least one clique if you want a tailored start
                </span>
              ) : null}
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8 md:px-12 md:py-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#4F3422] px-6 py-4 text-base font-extrabold text-white shadow-[0_18px_40px_rgba(79,52,34,0.14)]"
              >
                Continue to Sign Up
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handlePickAgain}
                className="inline-flex items-center justify-center gap-3 rounded-full border border-[#4F3422]/12 bg-white px-6 py-4 text-base font-extrabold text-[#4F3422]"
              >
                Pick Again
                <RotateCcw className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center justify-center rounded-full px-2 py-4 text-sm font-bold text-[#8F654B] sm:px-4"
              >
                Back to welcome
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
