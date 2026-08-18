import type { Metadata } from "next";
import { PublicProfileView } from "@/components/profile/PublicProfileView";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} — Scuib Chat`,
    description: `View ${username}'s profile and send them a message on Scuib Chat.`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;

  return <PublicProfileView username={username} />;
}
