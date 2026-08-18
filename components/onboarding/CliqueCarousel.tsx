"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { type Clique, useOnboardingStore } from "@/store/onboardingStore";
import {
  Hand1Icon,
  Hand2Icon,
  Hand3Icon,
  Hand4Icon,
} from "@/utils/illustrations";

const cliques: Array<{
  id: Clique;
  label: string;
  title: string;
  description: string;
  accent: string;
  surface: string;
  glow: string;
  illustrationBg: string;
  badgeText: string[];
  badgeClassNames: string[];
}> = [
  {
    id: "uiux",
    label: "UI/UX DESIGNERS",
    title: "Shape thoughtful product experiences.",
    description:
      "Designers inside this clique share ideas, critique flows, and discover jobs, gigs, and collaborators.",
    accent: "#9BB168",
    surface: "#EEF4E3",
    glow: "rgba(155,177,104,0.28)",
    illustrationBg: "/uxback.svg",
    badgeText: ["Research", "Design"],
    badgeClassNames: ["left-5 top-7", "right-5 top-16"],
  },
  {
    id: "frontend",
    label: "FRONTEND DEVELOPERS",
    title: "Build smooth interfaces with the right people around you.",
    description:
      "Meet frontend devs shipping web products, sharing opportunities, and helping each other grow faster.",
    accent: "#ED7E1C",
    surface: "#FFF1E4",
    glow: "rgba(237,126,28,0.22)",
    illustrationBg: "/frontback.svg",
    badgeText: ["React", "Web"],
    badgeClassNames: ["left-5 top-8", "right-6 top-16"],
  },
  {
    id: "backend",
    label: "BACKEND DEVELOPERS",
    title: "Find the builders behind stable systems.",
    description:
      "Backend engineers in this clique talk architecture, APIs, scaling, and the openings that match their strengths.",
    accent: "#736B66",
    surface: "#F2EFED",
    glow: "rgba(115,107,102,0.18)",
    illustrationBg: "/backback.svg",
    badgeText: ["API", "Scale"],
    badgeClassNames: ["left-6 top-8", "right-6 top-[4.75rem]"],
  },
  {
    id: "mobile",
    label: "MOBILE DEVELOPERS",
    title: "Connect with the people building on the go.",
    description:
      "From Android to iOS and cross-platform work, this clique keeps mobile talent close to real conversations and hiring.",
    accent: "#DDA408",
    surface: "#FFF6DE",
    glow: "rgba(221,164,8,0.22)",
    illustrationBg: "/mobileback.svg",
    badgeText: ["iOS", "Android"],
    badgeClassNames: ["left-5 top-10", "right-6 top-20"],
  },
];

export function CliqueCarousel() {
  const currentStep = useOnboardingStore((state) => state.currentStep);
  const selectedCliques = useOnboardingStore((state) => state.selectedCliques);
  const toggleClique = useOnboardingStore((state) => state.toggleClique);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const prevStep = useOnboardingStore((state) => state.prevStep);
  const setStep = useOnboardingStore((state) => state.setStep);

  const activeIndex = currentStep - 1;

  if (activeIndex < 0 || activeIndex >= cliques.length) {
    return null;
  }

  const currentClique = cliques[activeIndex];
  const isSelected = selectedCliques.includes(currentClique.id);

  const handleBack = () => {
    if (currentStep === 1) {
      setStep(0);
      return;
    }

    prevStep();
  };

  const handleNext = () => {
    if (currentStep === cliques.length) {
      setStep(cliques.length + 1);
      return;
    }

    nextStep();
  };

  return (
    <div
      className="min-h-screen px-5 py-6 sm:px-7 md:px-10 md:py-8"
      style={{
        background: `linear-gradient(180deg, #FCF8F1 0%, ${currentClique.surface} 100%)`,
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-[#4F3422]/12 bg-white/80 px-4 py-3 text-sm font-bold text-[#4F3422] shadow-[0_14px_32px_rgba(79,52,34,0.08)] backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="rounded-full bg-white/85 px-4 py-3 text-sm font-extrabold text-[#8F654B] shadow-[0_14px_32px_rgba(79,52,34,0.08)]">
            {currentStep} of {cliques.length}
          </div>
        </div>

        <div className="mt-6 grid flex-1 items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
          <motion.div
            key={currentClique.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="order-2 flex flex-col lg:order-1"
          >
            <div className="inline-flex w-fit rounded-full border border-[#4F3422]/12 bg-white/80 px-4 py-2 text-xs font-extrabold tracking-[0.22em] text-[#8F654B]">
              {currentClique.label}
            </div>

            <h1 className="mt-5 max-w-[14ch] text-[clamp(2.2rem,7vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.06em] text-[#4F3422]">
              {currentClique.title}
            </h1>

            <p className="mt-5 max-w-[36rem] text-base font-medium leading-8 text-[#736B66] sm:text-lg">
              {currentClique.description}
            </p>

            <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#5F5148] shadow-[0_14px_32px_rgba(79,52,34,0.08)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: currentClique.accent }}
              />
              {selectedCliques.length} clique
              {selectedCliques.length === 1 ? "" : "s"} selected
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => toggleClique(currentClique.id)}
                className="inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-extrabold text-white shadow-[0_18px_40px_rgba(79,52,34,0.16)]"
                style={{ backgroundColor: currentClique.accent }}
              >
                {isSelected ? <Check className="h-5 w-5" /> : null}
                {isSelected ? "Added to your cliques" : "Add to your cliques"}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-3 rounded-full border border-[#4F3422]/12 bg-white px-6 py-4 text-base font-extrabold text-[#4F3422] shadow-[0_18px_40px_rgba(79,52,34,0.1)]"
              >
                {currentStep === cliques.length ? "Review picks" : "Next clique"}
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {cliques.map((clique, index) => {
                const selected = selectedCliques.includes(clique.id);
                const active = clique.id === currentClique.id;

                return (
                  <button
                    key={clique.id}
                    type="button"
                    onClick={() => setStep(index + 1)}
                    className="rounded-full px-4 py-2 text-sm font-bold transition-transform hover:scale-[1.01]"
                    style={{
                      backgroundColor: active ? clique.surface : "#FFFFFF",
                      color: selected ? clique.accent : "#5F5148",
                      border: `1px solid ${selected ? clique.accent : "rgba(79,52,34,0.12)"}`,
                    }}
                  >
                    {selected ? "Selected" : "View"} {clique.label.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            key={`${currentClique.id}-art`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="order-1 flex justify-center lg:order-2"
          >
            <div
              className="relative aspect-[0.92] w-full max-w-[560px] overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-[0_28px_80px_rgba(79,52,34,0.12)]"
              style={{ boxShadow: `0 28px 80px ${currentClique.glow}` }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_transparent_55%)]" />
              <div
                className="absolute inset-x-[12%] bottom-[8%] top-[14%] rounded-[50%] bg-white"
                style={{
                  boxShadow: `0 30px 80px ${currentClique.glow}`,
                }}
              />
              <div className="absolute inset-0 opacity-55">
                <Image
                  fill
                  src={currentClique.illustrationBg}
                  alt=""
                  className="object-contain p-5"
                />
              </div>

              {currentClique.badgeText.map((text, index) => (
                <div
                  key={text}
                  className={`absolute rounded-full px-4 py-3 text-lg font-extrabold text-white shadow-[0_14px_30px_rgba(79,52,34,0.16)] ${currentClique.badgeClassNames[index]}`}
                  style={{ backgroundColor: currentClique.accent }}
                >
                  {text}
                </div>
              ))}

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
                <div className="relative h-[18rem] w-[19rem] sm:h-[22rem] sm:w-[22rem]">
                  <Hand1Icon className="absolute bottom-6 left-[-0.5rem] w-[7rem] text-[#C8D6AB] sm:w-[8.5rem]" />
                  <Hand4Icon className="absolute bottom-6 right-[-0.2rem] w-[7.2rem] text-[#CAD99F] sm:w-[8.8rem]" />
                  <Hand2Icon className="absolute bottom-3 left-[3.9rem] w-[5.9rem] sm:left-[4.7rem] sm:w-[7rem]" />
                  <Hand3Icon className="absolute bottom-6 right-[4rem] w-[4.3rem] sm:right-[4.7rem] sm:w-[5.1rem]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
