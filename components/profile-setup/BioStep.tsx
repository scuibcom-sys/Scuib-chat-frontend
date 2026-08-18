"use client";

import { useProfileSetupStore } from "@/store/profileSetupStore";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function BioStep() {
  const { bio, setBio, nextStep } = useProfileSetupStore();

  const handleNext = () => {
    if (bio.trim()) {
      nextStep();
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <h2 className="text-[28px] leading-[110%] tracking-[-1%] font-bold text-[#4F3422] text-center mb-8">
        Enter your <span className="text-[#9BB168]">Bio</span>
      </h2>

      <div className="flex-1">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Enter a bio"
          className="w-full h-48 bg-[#F7F4F2] rounded-3xl p-6 text-[#4F3422] placeholder:text-[#8B7355] resize-none focus:outline-none focus:ring-2 focus:ring-[#9BB168] transition-all"
        />
      </div>

      <div className="flex justify-center pt-8">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleNext}
          disabled={!bio.trim()}
          className="bg-[#9BB168] text-white px-8 py-4 rounded-full flex items-center gap-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8fa968] transition-colors"
        >
          Next
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <ArrowRight size={20} />
          </div>
        </motion.button>
      </div>
    </div>
  );
}
