export type DashboardPreset =
  | "groups"
  | "chat"
  | "member-card"
  | "members"
  | "messages"
  | "messages-plus"
  | "messages-guest"
  | "guest"
  | "confirm-join"
  | "public-members"
  | "dm"
  | "dm-member-card";

export type DashboardSection = "groups" | "messages";

export type GroupPanelMode =
  | "chat"
  | "members-joined"
  | "members-public"
  | "restricted";

export type DashboardOverlay =
  | "member-card"
  | "confirm-join"
  | "account-menu"
  | "coming-soon"
  | null;

export type GroupRecord = {
  id: string;
  listTitle: string;
  headerTitle: string;
  membersLabel: string;
  headerMembersLabel: string;
  unreadLabel: string;
  unreadCount: number;
  accent: string;
  accentSoft: string;
  avatarBackground: string;
  joinBackground: string;
  avatarSrc: string;
};

export type DashboardMemberTone = "green" | "orange";

export type DashboardPortraitAvatar = "portrait-a" | "portrait-b";

export type MemberRecord = {
  id: string;
  name: string;
  description: string;
  time: string;
  tone: DashboardMemberTone;
  previewBio: string;
  avatar: DashboardPortraitAvatar;
};

export type PublicMemberRecord = {
  id: string;
  name: string;
  description: string;
  time: string;
  avatar: "portrait-a";
};

export type ConversationRecord = {
  id: string;
  name: string;
  preview: string;
  time: string;
  unreadCount: number;
  tone: string;
  initial: string;
};

export type MemberPreview = {
  id: string;
  initial: string;
  name: string;
  bio: string;
  avatarUrl?: string | null;
  email?: string | null;
  directMessageTargetId?: string | null;
  isCurrentUser?: boolean;
};
