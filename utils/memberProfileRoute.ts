import type { MemberPreview } from "@/types/dashboard";

export function buildMemberProfileHref(member: MemberPreview) {
  const params = new URLSearchParams();

  params.set("name", member.name);
  params.set("bio", member.bio);
  params.set("initial", member.initial);
  params.set("isCurrentUser", member.isCurrentUser ? "1" : "0");

  if (member.avatarUrl?.trim()) {
    params.set("avatarUrl", member.avatarUrl.trim());
  }

  if (member.email?.trim()) {
    params.set("email", member.email.trim());
  }

  if (member.directMessageTargetId?.trim()) {
    params.set("directMessageTargetId", member.directMessageTargetId.trim());
  }

  return `/profile/member/${encodeURIComponent(member.id)}?${params.toString()}`;
}

export function readMemberPreviewFromSearchParams(
  profileId: string,
  searchParams: URLSearchParams,
): MemberPreview {
  return {
    id: profileId,
    name: searchParams.get("name")?.trim() || "Community member",
    bio: searchParams.get("bio")?.trim() || "No bio available yet.",
    initial: searchParams.get("initial")?.trim() || "M",
    avatarUrl: searchParams.get("avatarUrl")?.trim() || null,
    email: searchParams.get("email")?.trim() || null,
    directMessageTargetId: searchParams.get("directMessageTargetId")?.trim() || null,
    isCurrentUser: searchParams.get("isCurrentUser") === "1",
  };
}
