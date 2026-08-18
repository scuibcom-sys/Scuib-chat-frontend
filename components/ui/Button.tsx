"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary: "bg-[#4F3422] text-white hover:bg-[#4a3728]",
      secondary: "bg-[#d4a574] text-white hover:bg-[#c49a64]",
      outline: "border-2 border-[#5d4037] text-[#5d4037] hover:bg-[#5d4037]/5",
      ghost: "text-[#5d4037] hover:bg-[#5d4037]/10",
    };

    const sizes = {
      sm: "px-4 py-2.5 text-sm",
      md: "px-5 py-3.5 text-base sm:px-6 sm:py-4 sm:text-lg",
      lg: "px-6 py-3.5 text-base sm:px-8 sm:py-4 sm:text-lg",
    };

    return (
      <button
        ref={ref}
        className={`
          relative inline-flex items-center justify-center gap-2 rounded-full font-semibold
          transition-all duration-200 ease-out cursor-pointer
          active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
        {!isLoading && leftIcon}
        <span className="font-extrabold leading-[100%] tracking-[-0.4%]">
          {children}
        </span>
        {!isLoading && rightIcon}
      </button>
    );
  },
);

Button.displayName = "Button";
