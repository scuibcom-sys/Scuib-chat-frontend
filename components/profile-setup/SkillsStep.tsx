// components/profile-setup/SkillsStep.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import {
  getCategoryLabel,
  getSkillLabel,
  SKILL_OPTIONS,
} from "@/components/profile/profileOptions";
import { extractApiErrorMessage, updateProfile } from "@/utils/scuibApi";

export function SkillsStep() {
  const { bio, selectedCategories, selectedSkills, toggleSkill, reset } =
    useProfileSetupStore();
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  const filteredSkills = SKILL_OPTIONS.filter((skill) =>
    skill.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDone = async () => {
    setSaveError(null);
    setIsSaving(true);

    try {
      if (accessToken) {
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
            categoryLabels: selectedCategories.map((category) => getCategoryLabel(category)),
            skillLabels: selectedSkills.map((skill) => getSkillLabel(skill)),
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );
      }

      reset();
      router.replace("/dashboard");
    } catch (error) {
      setSaveError(
        extractApiErrorMessage(error, "Unable to save your profile right now."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <h2 className="text-[28px] leading-[110%] tracking-[-1%] font-bold text-[#4F3422] text-center mb-6">
        Pick your <span className="text-[#9BB168]">Skills.</span>
      </h2>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills"
          className="w-full bg-[#F7F4F2] rounded-full py-3 px-5 pr-12 text-[#4F3422] placeholder:text-[#8B7355] focus:outline-none focus:ring-2 focus:ring-[#9BB168]"
        />
        <Search
          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B7355]"
          size={20}
        />
      </div>

      {/* Decorative curve */}
      <div className="flex justify-center mb-4">
        <svg width="120" height="20" viewBox="0 0 120 20" fill="none">
          <path
            d="M0 10 Q60 -10 120 10"
            stroke="#9BB168"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* Skills grid */}
      <div className="flex-1 flex flex-wrap justify-center gap-3 content-start">
        {filteredSkills.map((skill) => {
          const isSelected = selectedSkills.includes(skill.id);
          return (
            <motion.button
              key={skill.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleSkill(skill.id)}
              className={`px-5 py-3 rounded-full font-medium transition-all ${
                isSelected
                  ? "bg-[#E67E22] text-white"
                  : "bg-[#F7F4F2] text-[#4F3422] hover:bg-[#E8E0D5]"
              }`}
            >
              {skill.label}
            </motion.button>
          );
        })}
      </div>

      {saveError ? (
        <div className="pt-4">
          <div className="rounded-[24px] border border-[#E5B49A] bg-[#FFF2EA] px-5 py-4 text-sm font-semibold leading-6 text-[#8B4B1E]">
            {saveError}
          </div>
        </div>
      ) : null}

      {/* Done button */}
      <div className="flex justify-center pt-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDone}
          disabled={isSaving}
          className="bg-[#9BB168] text-white px-8 py-4 rounded-full flex items-center gap-3 font-semibold hover:bg-[#8fa968] transition-colors"
        >
          {isSaving ? "Saving..." : "Done"}
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <ArrowRight size={20} />
          </div>
        </motion.button>
      </div>
    </div>
  );
}
