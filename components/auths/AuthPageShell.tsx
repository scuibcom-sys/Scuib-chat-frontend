import Image from "next/image";
import type { ReactNode } from "react";
import { LogoIcon } from "@/utils/icons";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-start justify-center overflow-x-hidden bg-[#F7F4F2] px-0 pb-10 pt-24 sm:items-center sm:pb-0 sm:pt-0">
      <div className="absolute left-1/2 top-[-22rem] aspect-square w-[34rem] -translate-x-1/2 rounded-full bg-[#9BB168] sm:hidden">
        <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <LogoIcon className="h-10 w-10 text-white sm:h-12 sm:w-12" />
        </div>
      </div>

      <div className="pointer-events-none absolute right-0 hidden overflow-hidden sm:block">
        <Image src="/sphere.svg" alt="" width={894} height={894} />
      </div>

      <div className="relative z-10 w-full max-w-md px-5 sm:max-w-lg sm:px-6">
        {children}
      </div>
    </div>
  );
}
