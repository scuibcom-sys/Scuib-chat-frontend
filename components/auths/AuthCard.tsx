"use client";

import { LogoIcon } from "@/utils/icons";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Floating Logo Circle (Desktop Style) */}
      <div className="mb-5 hidden h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#4F3422] shadow-logo sm:flex md:mb-8 md:h-20 md:w-20">
        <LogoIcon className="h-10 w-10 brightness-0 invert md:h-12 md:w-12" />
      </div>

      <div className="w-full bg-transparent md:bg-transparent">
        <div className="mb-7 flex flex-col items-center sm:mb-8">
          <h1 className="text-center text-[28px] font-extrabold leading-tight tracking-[-1%] text-[#4F3422] sm:text-3xl md:text-[34px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-2 max-w-xs text-center text-sm text-[#736B66] sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
