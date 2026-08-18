"use client";

import React, { forwardRef, useState } from "react";
import { EyeOff } from "lucide-react";
import { EyeIcon, TriangleInfoIcon } from "@/utils/icons";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  helperText?: string;
  py?: string;
  iconPl?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      icon,
      helperText,
      type = "text",
      className,
      py = "py-4 sm:py-5",
      iconPl = "pl-12",
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className="w-full">
        <label className="block text-sm font-extrabold text-[#4F3422] mb-2">
          {label}
        </label>
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`w-full bg-white rounded-full border px-5 ${py} text-sm text-[#4F3422] placeholder:text-[#736B66] placeholder:font-bold focus:outline-none focus:ring-4 focus:ring-[#9BB168]/25 focus:border-[#9BB168] transition-all duration-200 sm:text-base
              ${icon && iconPl}
              ${isPassword && "pr-12"}
              ${
                error
                  ? "border-[#ED7E1C] bg-white focus:ring-4 focus:ring-[#FE814B40]/25 focus:border-[#ED7E1C]"
                  : "border-white hover:border-[#9BB168]"
              }
              ${className}
            `}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C9C7C5] hover:text-[#4a3728] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={20} /> : <EyeIcon />}
            </button>
          )}
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-1.5 text-sm bg-[#FFEEE2] text-[#4F3422] leading-[100%] tracking-[-0.2%] p-3 border border-[#ed7e1c] rounded-[1234px] font-bold">
            <TriangleInfoIcon className="text-[#ED7E1C]" />
            <span>{error}</span>
          </div>
        )}
        {helperText && !error && (
          <p className="mt-2 text-sm text-[#8b7355]">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
