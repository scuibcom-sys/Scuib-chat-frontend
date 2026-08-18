export type CommunityStatus = "active" | "paused";

export type CommunityRecord = {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  members: string;
  posts: string;
  status: CommunityStatus;
  description: string;
  createdLabel: string;
  accent: string;
};
