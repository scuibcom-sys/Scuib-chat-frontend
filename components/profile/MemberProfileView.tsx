"use client";

import { ArrowLeft, AtSign, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { MemberPreview } from "@/types/dashboard";
import {
  AvatarCircle,
  ProfileHeaderPattern,
} from "@/components/profile/ProfileEditView";

export function MemberProfileView({
  member,
}: {
  member: MemberPreview;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FBF8F4] text-[#5B3B29]">
      <div className="relative h-[244px] overflow-hidden bg-[#465728]">
        <ProfileHeaderPattern />
        <div className="absolute left-8 top-8 z-10 flex items-center gap-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white text-white transition-colors hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[20px] font-extrabold tracking-[-0.03em] text-white">
            Member Profile
          </h1>
        </div>
      </div>

      <div className="relative mx-auto max-w-[920px] px-6 pb-16">
        <div className="-mt-[72px] flex justify-center">
          <AvatarCircle
            imageSrc={member.avatarUrl ?? null}
            fallbackText={member.initial || "M"}
            size="xl"
          />
        </div>

        <div className="mx-auto mt-5 max-w-[620px] text-center">
          <h1 className="text-[34px] font-extrabold tracking-[-0.04em] text-[#5B3B29]">
            {member.name}
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[18px] font-semibold leading-[1.5] text-[#6F635C]">
            {member.bio}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-3 rounded-full border border-[#D9C6BA] bg-white px-7 py-4 text-[17px] font-extrabold text-[#6A4227]"
            >
              Back
              <ArrowLeft className="h-5 w-5" />
            </button>
            {member.isCurrentUser ? (
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="inline-flex items-center gap-3 rounded-full bg-[#6A4227] px-7 py-4 text-[17px] font-extrabold text-white"
              >
                My Profile
                <UserRound className="h-5 w-5" />
              </button>
            ) : null}
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-3 rounded-full border border-[#6A4227] bg-white px-7 py-4 text-[17px] font-extrabold text-[#6A4227]"
              >
                Email
                <AtSign className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
