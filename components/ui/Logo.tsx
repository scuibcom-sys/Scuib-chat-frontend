"use client";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizes = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  return (
    <div
      className={`
        rounded-full bg-[#5d4037] flex items-center justify-center
        ${sizes[size]}
        ${className}
      `}
    >
      <svg
        viewBox="0 0 24 24"
        className={`text-white
          ${size === "sm" ? "w-5 h-5" : size === "md" ? "w-7 h-7" : "w-10 h-10"}
        `}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 8v2M12 14v2M8 12h2M14 12h2" />
      </svg>
    </div>
  );
}
