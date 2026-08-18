"use client";

import { useState } from "react";
import { useProfileSetupStore } from "@/store/profileSetupStore";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { CATEGORY_OPTIONS } from "@/components/profile/profileOptions";

export function CategoriesStep() {
  const { selectedCategories, toggleCategory, nextStep } =
    useProfileSetupStore();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = CATEGORY_OPTIONS.filter((cat) =>
    cat.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full px-6 py-8">
      <h2 className="text-[28px] leading-[110%] tracking-[-1%] font-bold text-[#4F3422] text-center mb-6">
        Pick your <span className="text-[#9BB168]">Categories.</span>
      </h2>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search categories"
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

      {/* Categories grid */}
      <div className="flex-1 flex flex-wrap justify-center gap-3 content-start">
        {filteredCategories.map((category) => {
          const isSelected = selectedCategories.includes(category.id);
          return (
            <motion.button
              key={category.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleCategory(category.id)}
              className={`px-5 py-3 rounded-full font-medium transition-all ${
                isSelected
                  ? "bg-[#E67E22] text-white"
                  : "bg-[#F7F4F2] text-[#4F3422] hover:bg-[#E8E0D5]"
              }`}
            >
              {category.label}
            </motion.button>
          );
        })}
      </div>

      {/* Next button */}
      <div className="flex justify-center pt-6">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={nextStep}
          className="bg-[#9BB168] text-white px-8 py-4 rounded-full flex items-center gap-3 font-semibold hover:bg-[#8fa968] transition-colors"
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
