import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";
import type { DashboardPreset } from "@/types/dashboard";

export const metadata: Metadata = {
  title: "Dashboard - Scuib Chat",
  description: "Scuib Chat dashboard workspace",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawPreset = Array.isArray(params.screen)
    ? params.screen[0]
    : params.screen;

  return (
    <DashboardWorkspace
      initialPreset={isDashboardPreset(rawPreset) ? rawPreset : "groups"}
    />
  );
}

function isDashboardPreset(
  value: string | undefined,
): value is DashboardPreset {
  return (
    value === "groups" ||
    value === "chat" ||
    value === "member-card" ||
    value === "members" ||
    value === "messages" ||
    value === "messages-plus" ||
    value === "messages-guest" ||
    value === "guest" ||
    value === "confirm-join" ||
    value === "public-members" ||
    value === "dm" ||
    value === "dm-member-card"
  );
}
