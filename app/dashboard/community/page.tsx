import type { Metadata } from "next";
import { CommunityAdminDashboard } from "@/components/community/CommunityAdminDashboard";

export const metadata: Metadata = {
  title: "Communities - Scuib Chat",
  description: "Community administration dashboard",
};

export default function CommunityPage() {
  return <CommunityAdminDashboard />;
}
