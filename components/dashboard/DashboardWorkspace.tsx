"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  CornerDownRight,
  FileText,
  Link2,
  Loader2,
  LogOut,
  MessageCircleMore,
  Pencil,
  Plus,
  Reply,
  Search,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import {
  ChatUploadModal,
  type ChatUploadMode,
} from "@/components/dashboard/ChatUploadModal";
import { Modal } from "@/components/ui/Modal";
import { StatusStrip, type StatusStripEntry } from "@/components/dashboard/status/StatusStrip";
import { StatusViewer } from "@/components/dashboard/status/StatusViewer";
import { StatusComposer } from "@/components/dashboard/status/StatusComposer";
import { groupStatusesByAuthor, type ApiStatusRecord } from "@/utils/scuibStatusApi";
import {
  fetchGroupMembers,
  type ApiGroupMemberRecord,
} from "@/utils/scuibAdminApi";
import { useAuthStore } from "@/store/authStore";
import { useOnboardingStore } from "@/store/onboardingStore";
import {
  getOnboardingUserKey,
  useProfileSetupStore,
} from "@/store/profileSetupStore";
import type { AuthTokenType } from "@/utils/scuibApi";
import {
  ApiError,
  buildGroupShareLink,
  extractApiErrorMessage,
  fetchProfile,
  fetchGroupDetail,
  fetchGroups,
  isElevatedRole,
  isProfileComplete,
  joinGroup,
  toDashboardGroup,
  type ApiGroupRecord,
} from "@/utils/scuibApi";
import {
  clearPendingSharedGroup,
  readPendingSharedGroup,
  rememberPendingSharedGroup,
} from "@/utils/sharedGroupFlow";
import {
  persistJoinedGroup,
  replacePersistedJoinedGroups,
  readPersistedJoinedGroups,
} from "@/utils/joinedGroupsPersistence";
import {
  persistActiveGroup,
} from "@/utils/activeGroupPersistence";
import {
  buildReplyMessageContent,
  ensureGroupConversation,
  fetchConversation,
  fetchDirectMessageHistory,
  fetchConversationMessages,
  fetchConversations,
  markConversationSeen,
  markDirectMessageSeen,
  sendConversationFileMessage,
  sendDirectMessage,
  sendConversationMessage,
  toDashboardConversation,
  uploadMessageAttachments,
  type ApiAttachmentRecord,
  type ApiConversationRecord,
  type ApiConversationParticipantRecord,
  type ApiMessageRecord,
  type ApiMessageReplyRecord,
} from "@/utils/scuibMessagingApi";
import {
  normalizeCategory,
  normalizeSkill,
} from "@/components/profile/profileOptions";
import { buildMemberProfileHref } from "@/utils/memberProfileRoute";
import type {
  ConversationRecord,
  DashboardOverlay,
  DashboardPreset,
  DashboardSection,
  GroupPanelMode,
  GroupRecord,
  MemberPreview,
  MemberRecord,
  PublicMemberRecord,
} from "@/types/dashboard";
import { LogoIcon } from "@/utils/icons";

const MAX_GROUPS = 3;
const MESSAGE_LIST_BOTTOM_THRESHOLD = 96;
const MESSAGE_LIST_JUMP_BUTTON_THRESHOLD = 220;
const MOBILE_CHAT_COMPOSER_BOTTOM_OFFSET_PX = 104;
const MOBILE_CHAT_RESERVED_SCROLL_SPACE_PX = 232;
const REMAINING_GROUP_SLOT_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
};
const MESSAGE_READ_MORE_CHARACTER_LIMIT = 220;
const MESSAGE_COLLAPSED_LINE_COUNT = 6;
const MESSAGE_LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s]+)/gi;
const TRANSIENT_NOTICE_DURATION_MS = 2200;

type MobileGroupsView = "list" | "chat" | "members" | "restricted";
type MobileMessagesView = "list" | "discover" | "restricted";
type MobileDirectMessageOrigin = DashboardSection | "discover";
type MobileDiscoverPerson = {
  id: string;
  conversationId: string;
  name: string;
  subtitle: string;
  lastSeenLabel: string;
  tone: string;
  initial: string;
};

type GroupChatMemberProfile = {
  id: string;
  name: string;
  description: string;
  time: string;
  previewBio: string;
  avatar: "portrait-a" | "portrait-b";
  avatarUrl?: string | null;
  initial: string;
  badgeColor: string;
  badgeTextColor?: string;
  email?: string | null;
  directMessageTargetId?: string | null;
  isCurrentUser?: boolean;
};

type GroupChatMessageRecord = {
  id: string;
  senderId: string;
  senderName?: string;
  senderEmail?: string | null;
  text: string;
  attachments: ApiAttachmentRecord[];
  createdAt: string | null;
  replyTo?: ApiMessageReplyRecord | null;
  avatarInitial?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarTextColor?: string;
  isCurrentUser?: boolean;
  isPending?: boolean;
};

type GroupChatState = {
  members: GroupChatMemberProfile[];
  messages: GroupChatMessageRecord[];
};

type EditingMessageDraft = {
  id: string;
  source: "group" | "direct";
  text: string;
  replyTo: ApiMessageReplyRecord | null;
};

type DashboardWorkspaceCacheSnapshot = {
  activeSection: DashboardSection;
  apiGroups: ApiGroupRecord[];
  selectedGroupId: string;
  joinedGroupIds: string[];
  apiConversations: ApiConversationRecord[];
  selectedConversationId: string;
  conversationMessages: ApiMessageRecord[];
  directMessagesByConversationId: Record<string, ApiMessageRecord[]>;
  groupChatsById: Record<string, GroupChatState>;
  groupConversationIdsByGroupId: Record<string, string>;
  groupUnreadAnchorMessageIds: Record<string, string | null>;
  directUnreadAnchorMessageIds: Record<string, string | null>;
  unreadMessagesCount: number;
  groupPanelMode: GroupPanelMode;
  selectedMember: MemberPreview;
  mobileGroupsView: MobileGroupsView;
  mobileMessagesView: MobileMessagesView;
  isMobileDirectMessageOpen: boolean;
  mobileDirectMessageOrigin: MobileDirectMessageOrigin;
  groupScrollTopById: Record<string, number>;
  directScrollTopById: Record<string, number>;
  loadedGroupChatIds: Record<string, true>;
  loadedDirectConversationIds: Record<string, true>;
};

const MOBILE_FALLBACK_DIRECT_MESSAGES: ApiMessageRecord[] = [
  {
    id: "dm-1",
    text:
      "Any one shipped React Server Component in production? Curious about real DX- not the hype 😢😭",
    senderId: "self",
    senderName: "You",
    senderEmail: null,
    createdAt: null,
    isOwn: true,
    attachments: [],
    replyTo: null,
  },
  {
    id: "dm-2",
    text: "RSC is real, SEO wins are massive, Auth was tricky-keep it clean always",
    senderId: "chukwudi-osundu",
    senderName: "Chukwudi",
    senderEmail: null,
    createdAt: null,
    isOwn: false,
    attachments: [],
    replyTo: null,
  },
  {
    id: "dm-3",
    text: "RSC is real, SEO wins are massive, Auth was tricky-keep it clean always",
    senderId: "fatima",
    senderName: "Fatima",
    senderEmail: null,
    createdAt: null,
    isOwn: false,
    attachments: [],
    replyTo: null,
  },
];

const MOBILE_DISCOVER_TONES = [
  "#F68B1F",
  "#6253F7",
  "#34C759",
  "#9BB168",
  "#D96C9C",
] as const;

const EMPTY_MEMBER_PREVIEW: MemberPreview = {
  id: "",
  initial: "",
  name: "",
  bio: "",
  avatarUrl: null,
  email: null,
  directMessageTargetId: null,
  isCurrentUser: false,
};
const PREVIEW_MEMBER = EMPTY_MEMBER_PREVIEW;
const MOBILE_FALLBACK_CONVERSATIONS: ApiConversationRecord[] = [];

const PERSONAL_MESSAGES_DISABLED = false;
const PROFILE_SECTION_DISABLED = false;
const COMING_SOON_NOTE = "Coming soon";
const PROFILE_COMING_SOON_DESCRIPTION =
  "Profile features are disabled for now. This section is coming soon.";
const dashboardWorkspaceCache = new Map<string, DashboardWorkspaceCacheSnapshot>();

function buildMemberPreview(profile: GroupChatMemberProfile): MemberPreview {
  return {
    id: profile.id,
    initial: profile.initial,
    name: profile.name,
    bio: profile.previewBio,
    avatarUrl: profile.avatarUrl ?? null,
    email: profile.email ?? null,
    directMessageTargetId: profile.directMessageTargetId ?? null,
    isCurrentUser: profile.isCurrentUser ?? false,
  };
}

function isGenericGroupMemberDescription(description: string) {
  const normalizedDescription = description.trim().toLowerCase();
  return !normalizedDescription || normalizedDescription === "community member";
}

function isGenericGroupMemberBio(bio: string, name: string) {
  const normalizedBio = bio.trim();
  const normalizedName = name.trim();

  return (
    !normalizedBio ||
    normalizedBio === "You are part of this community conversation." ||
    normalizedBio === `${normalizedName} is part of this community conversation.`
  );
}

function isEmailLikeMemberName(name: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name.trim());
}

function getGroupMemberProfileScore(member: GroupChatMemberProfile) {
  let score = 0;

  if (member.isCurrentUser) score += 100;
  if (member.name.trim() && !isEmailLikeMemberName(member.name)) score += 25;
  if (member.directMessageTargetId?.trim()) score += 40;
  if (member.email?.trim()) score += 20;
  if (member.avatarUrl?.trim()) score += 5;
  if (!isGenericGroupMemberDescription(member.description)) score += 4;
  if (!isGenericGroupMemberBio(member.previewBio, member.name)) score += 4;

  return score;
}

function mergeGroupMemberProfiles(
  existingMember: GroupChatMemberProfile,
  incomingMember: GroupChatMemberProfile,
) {
  const preferredMember =
    getGroupMemberProfileScore(incomingMember) > getGroupMemberProfileScore(existingMember)
      ? incomingMember
      : existingMember;
  const fallbackMember =
    preferredMember === existingMember ? incomingMember : existingMember;
  const preferredName = preferredMember.name.trim();
  const fallbackName = fallbackMember.name.trim();
  const resolvedName =
    preferredName && !isEmailLikeMemberName(preferredName)
      ? preferredName
      : fallbackName && !isEmailLikeMemberName(fallbackName)
        ? fallbackName
        : preferredName || fallbackName || "Community member";
  const preferredBioIsGeneric = isGenericGroupMemberBio(
    preferredMember.previewBio,
    resolvedName,
  );
  const fallbackBioIsGeneric = isGenericGroupMemberBio(
    fallbackMember.previewBio,
    resolvedName,
  );

  return {
    ...fallbackMember,
    ...preferredMember,
    id: preferredMember.id.trim() || fallbackMember.id.trim() || "member",
    name: resolvedName,
    description: !isGenericGroupMemberDescription(preferredMember.description)
      ? preferredMember.description
      : fallbackMember.description,
    time: preferredMember.time.trim() || fallbackMember.time.trim() || "Now",
    previewBio: !preferredBioIsGeneric
      ? preferredMember.previewBio
      : !fallbackBioIsGeneric
        ? fallbackMember.previewBio
        : preferredMember.previewBio || fallbackMember.previewBio,
    avatarUrl:
      preferredMember.avatarUrl?.trim() ||
      fallbackMember.avatarUrl?.trim() ||
      null,
    initial:
      preferredMember.initial.trim() ||
      fallbackMember.initial.trim() ||
      getSenderInitials(resolvedName),
    badgeColor: preferredMember.badgeColor || fallbackMember.badgeColor,
    badgeTextColor:
      preferredMember.badgeTextColor || fallbackMember.badgeTextColor,
    email:
      preferredMember.email?.trim() || fallbackMember.email?.trim() || null,
    directMessageTargetId:
      preferredMember.directMessageTargetId?.trim() ||
      fallbackMember.directMessageTargetId?.trim() ||
      null,
    isCurrentUser:
      preferredMember.isCurrentUser ?? fallbackMember.isCurrentUser ?? false,
  } satisfies GroupChatMemberProfile;
}

function getSenderInitials(name: string) {
  const normalizedParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (normalizedParts.length === 0) return "C";
  if (normalizedParts.length === 1) {
    return normalizedParts[0].slice(0, 1).toUpperCase();
  }

  return `${normalizedParts[0][0] ?? ""}${normalizedParts[1][0] ?? ""}`.toUpperCase();
}

const GROUP_MEMBER_BADGE_PALETTE = [
  { background: "#F68B1F", text: "#1D1D1B" },
  { background: "#A6BA63", text: "#1D1D1B" },
  { background: "#7E726D", text: "#FFFFFF" },
  { background: "#D95C9A", text: "#FFFFFF" },
  { background: "#4B78C2", text: "#FFFFFF" },
] as const;

function hashGroupMemberKey(value: string) {
  return value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function isCurrentUserMessage(
  message: ApiMessageRecord,
  user: {
    id?: string | null;
    email?: string | null;
  } | null,
) {
  if (message.isOwn === true) return true;
  if (user?.id && message.senderId && message.senderId === user.id) return true;
  if (
    user?.email &&
    message.senderEmail &&
    message.senderEmail.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }

  if (
    user?.email &&
    message.senderName &&
    message.senderName.trim().toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }

  return false;
}

function buildGroupMemberProfileFromApiMessage(
  message: ApiMessageRecord,
  user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null,
): GroupChatMemberProfile {
  const isCurrentUser = isCurrentUserMessage(message, user);
  const resolvedName = isCurrentUser
    ? user?.name?.trim() || user?.email?.trim() || "You"
    : message.senderName.trim() || "Community";
  const paletteEntry =
    GROUP_MEMBER_BADGE_PALETTE[
      hashGroupMemberKey(message.senderId ?? resolvedName) % GROUP_MEMBER_BADGE_PALETTE.length
    ];

  return {
    id: resolveGroupMessageSenderKey(message, resolvedName),
    name: resolvedName,
    description: isCurrentUser ? "You" : "Community member",
    time: "Now",
    previewBio: isCurrentUser
      ? "You are part of this community conversation."
      : `${resolvedName} is part of this community conversation.`,
    avatar: isCurrentUser ? "portrait-a" : "portrait-b",
    avatarUrl: isCurrentUser ? user?.avatarUrl?.trim() || null : message.senderAvatarUrl ?? null,
    initial: getSenderInitials(resolvedName),
    badgeColor: isCurrentUser ? "#A6BA63" : paletteEntry.background,
    badgeTextColor: isCurrentUser ? "#1D1D1B" : paletteEntry.text,
    email: message.senderEmail?.trim() || null,
    directMessageTargetId:
      message.senderId?.trim() || message.senderEmail?.trim() || null,
    isCurrentUser,
  };
}

function buildGroupMemberProfileFromConversationParticipant(
  participant: ApiConversationParticipantRecord,
  user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null,
): GroupChatMemberProfile {
  const participantEmail = participant.email?.trim().toLowerCase() ?? null;
  const currentUserEmail = user?.email?.trim().toLowerCase() ?? null;
  const isCurrentUser =
    Boolean(user?.id && participant.id === user.id) ||
    Boolean(participantEmail && currentUserEmail && participantEmail === currentUserEmail);
  const resolvedName = isCurrentUser
    ? user?.name?.trim() || user?.email?.trim() || participant.name.trim() || "You"
    : participant.name.trim() || participant.email?.trim() || "Community member";
  const paletteEntry =
    GROUP_MEMBER_BADGE_PALETTE[
      hashGroupMemberKey(participant.id || participant.email || resolvedName) %
        GROUP_MEMBER_BADGE_PALETTE.length
    ];

  return {
    id: participant.id,
    name: resolvedName,
    description: isCurrentUser ? "You" : "Community member",
    time: "Now",
    previewBio: isCurrentUser
      ? "You are part of this community conversation."
      : `${resolvedName} is part of this community conversation.`,
    avatar: isCurrentUser ? "portrait-a" : "portrait-b",
    avatarUrl: isCurrentUser ? user?.avatarUrl?.trim() || null : participant.avatarUrl ?? null,
    initial: getSenderInitials(resolvedName),
    badgeColor: isCurrentUser ? "#A6BA63" : paletteEntry.background,
    badgeTextColor: isCurrentUser ? "#1D1D1B" : paletteEntry.text,
    email: participant.email?.trim() || null,
    directMessageTargetId:
      participant.id?.trim() || participant.email?.trim() || null,
    isCurrentUser,
  };
}

function buildGroupMemberProfileFromGroupMemberRecord(
  member: ApiGroupMemberRecord,
  user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null,
): GroupChatMemberProfile {
  const memberEmail = member.email?.trim().toLowerCase() ?? null;
  const currentUserEmail = user?.email?.trim().toLowerCase() ?? null;
  const isCurrentUser =
    Boolean(user?.id && member.id === user.id) ||
    Boolean(memberEmail && currentUserEmail && memberEmail === currentUserEmail);
  const resolvedName = isCurrentUser
    ? user?.name?.trim() || user?.email?.trim() || member.name.trim() || "You"
    : member.name.trim() || member.email?.trim() || "Community member";
  const paletteEntry =
    GROUP_MEMBER_BADGE_PALETTE[
      hashGroupMemberKey(member.id || member.email || resolvedName) %
        GROUP_MEMBER_BADGE_PALETTE.length
    ];
  const roleLabel = member.role?.trim();

  return {
    id: member.id,
    name: resolvedName,
    description: isCurrentUser ? "You" : roleLabel || "Community member",
    time: "Now",
    previewBio: isCurrentUser
      ? "You are part of this community conversation."
      : member.bio?.trim() || `${resolvedName} is part of this community conversation.`,
    avatar: isCurrentUser ? "portrait-a" : "portrait-b",
    avatarUrl: isCurrentUser ? user?.avatarUrl?.trim() || null : member.avatarUrl ?? null,
    initial: getSenderInitials(resolvedName),
    badgeColor: isCurrentUser ? "#A6BA63" : paletteEntry.background,
    badgeTextColor: isCurrentUser ? "#1D1D1B" : paletteEntry.text,
    email: member.email?.trim() || null,
    directMessageTargetId: member.id?.trim() || member.email?.trim() || null,
    isCurrentUser,
  };
}

function dedupeGroupMembers(members: GroupChatMemberProfile[]) {
  const dedupedMembers = new Map<string, GroupChatMemberProfile>();

  members.forEach((member) => {
    const normalizedDirectMessageTargetId =
      member.directMessageTargetId?.trim().toLowerCase() ?? "";
    const normalizedId = member.id.trim().toLowerCase();
    const normalizedName = member.name.trim().toLowerCase();
    const normalizedEmail = member.email?.trim().toLowerCase() ?? "";
    const dedupeKey =
      member.isCurrentUser
        ? `self:${
            normalizedEmail ||
            normalizedDirectMessageTargetId ||
            normalizedId ||
            normalizedName ||
            "current-user"
          }`
        : normalizedEmail ||
          normalizedDirectMessageTargetId ||
          normalizedId ||
          normalizedName ||
          "member";
    const existingMember = dedupedMembers.get(dedupeKey);

    if (!existingMember) {
      dedupedMembers.set(dedupeKey, member);
      return;
    }

    dedupedMembers.set(
      dedupeKey,
      mergeGroupMemberProfiles(existingMember, member),
    );
  });

  return Array.from(dedupedMembers.values());
}

function formatRemainingGroupSlotsMessage(remainingSlots: number) {
  const slotWord =
    REMAINING_GROUP_SLOT_WORDS[remainingSlots] ?? `${remainingSlots}`;

  return `You can join ${slotWord}(${remainingSlots}) more`;
}

function toGroupChatMessages(
  messages: ApiMessageRecord[],
  user: {
    id?: string | null;
    email?: string | null;
  } | null,
): GroupChatMessageRecord[] {
  return messages.map((message) => {
    const senderProfile = buildGroupMemberProfileFromApiMessage(message, user);

    return {
      id: message.id,
      senderId: senderProfile.id,
      senderName: senderProfile.name,
      senderEmail: message.senderEmail?.trim() || null,
      text: message.text,
      attachments: message.attachments,
      createdAt: message.createdAt,
      replyTo: message.replyTo,
      avatarInitial: senderProfile.initial,
      avatarUrl: senderProfile.avatarUrl ?? null,
      avatarColor: senderProfile.badgeColor,
      avatarTextColor: senderProfile.badgeTextColor,
      isCurrentUser: senderProfile.isCurrentUser,
    };
  });
}

function resolveGroupMessageSenderKey(
  message: Pick<ApiMessageRecord, "senderId" | "senderName" | "senderEmail" | "id">,
  fallbackName?: string,
) {
  const normalizedName =
    fallbackName?.trim() ||
    message.senderName?.trim() ||
    message.senderEmail?.trim() ||
    "";

  return (
    message.senderId ??
    (normalizedName
      ? normalizedName.toLowerCase().replace(/\s+/g, "-")
      : `sender-${message.id}`)
  );
}

function isDateToday(value: string | null) {
  if (!value) return false;

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return false;

  const now = new Date();

  return (
    parsedValue.getFullYear() === now.getFullYear() &&
    parsedValue.getMonth() === now.getMonth() &&
    parsedValue.getDate() === now.getDate()
  );
}

function shouldShowTodayDivider(
  messages: Array<Pick<GroupChatMessageRecord, "createdAt"> | Pick<ApiMessageRecord, "createdAt">>,
  index: number,
) {
  const currentMessage = messages[index];
  if (!currentMessage || !isDateToday(currentMessage.createdAt)) return false;

  const previousMessage = index > 0 ? messages[index - 1] : null;
  return !previousMessage || !isDateToday(previousMessage.createdAt);
}

function getMessageListBottomOffset(container: HTMLDivElement) {
  return Math.max(
    0,
    container.scrollHeight - container.scrollTop - container.clientHeight,
  );
}

function isMessageListNearBottom(container: HTMLDivElement) {
  return getMessageListBottomOffset(container) <= MESSAGE_LIST_BOTTOM_THRESHOLD;
}

function scrollMessageListToBottom(
  container: HTMLDivElement,
  behavior: ScrollBehavior = "auto",
) {
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
}

function findScrollableAncestor(element: HTMLElement) {
  let currentElement: HTMLElement | null = element.parentElement;

  while (currentElement) {
    const computedStyle = window.getComputedStyle(currentElement);
    const canScrollY =
      (computedStyle.overflowY === "auto" || computedStyle.overflowY === "scroll") &&
      currentElement.scrollHeight > currentElement.clientHeight;

    if (canScrollY) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return null;
}

function getMobileChatViewportPaddingStyle(): CSSProperties {
  return {
    paddingBottom: `calc(${MOBILE_CHAT_RESERVED_SCROLL_SPACE_PX}px + env(safe-area-inset-bottom))`,
  };
}

function getMobileChatComposerDockStyle(): CSSProperties {
  return {
    bottom: `calc(${MOBILE_CHAT_COMPOSER_BOTTOM_OFFSET_PX}px + env(safe-area-inset-bottom))`,
  };
}

function handleComposerKeyDown(
  event: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    preventDefault: () => void;
  },
  onSubmit?: (() => void) | null,
) {
  if (event.key !== "Enter" || !onSubmit) {
    return;
  }

  if (!event.ctrlKey && !event.metaKey) {
    return;
  }

  event.preventDefault();
  onSubmit();
}

function useMessageListAutoScroll({
  firstMessageId,
  lastMessageId,
  messageCount,
  isLoading,
  forceScrollToken = null,
  manageInitialViewportExternally = false,
}: {
  firstMessageId: string | null;
  lastMessageId: string | null;
  messageCount: number;
  isLoading: boolean;
  forceScrollToken?: string | null;
  manageInitialViewportExternally?: boolean;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousFirstMessageIdRef = useRef<string | null>(null);
  const previousLastMessageIdRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef<number | null>(null);
  const previousForceScrollTokenRef = useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [bottomOffset, setBottomOffset] = useState(0);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = scrollContainerRef.current;
      if (!container) return;

      scrollMessageListToBottom(container, behavior);
      shouldStickToBottomRef.current = true;
    },
    [],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateStickiness = () => {
      const nextBottomOffset = getMessageListBottomOffset(container);
      const nextIsAtBottom = nextBottomOffset <= MESSAGE_LIST_BOTTOM_THRESHOLD;
      shouldStickToBottomRef.current = nextIsAtBottom;
      setBottomOffset(nextBottomOffset);
      setIsAtBottom(nextIsAtBottom);
    };

    updateStickiness();
    container.addEventListener("scroll", updateStickiness, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateStickiness);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoading) return;

    const isInitialRender = previousMessageCountRef.current === null;
    const didSwitchMessageContext =
      previousFirstMessageIdRef.current !== null &&
      previousLastMessageIdRef.current !== null &&
      previousFirstMessageIdRef.current !== firstMessageId &&
      previousLastMessageIdRef.current !== lastMessageId;
    const didRequestForceScroll =
      forceScrollToken !== null && forceScrollToken !== previousForceScrollTokenRef.current;

    const shouldAutoScrollOnInitialization =
      !manageInitialViewportExternally && (isInitialRender || didSwitchMessageContext);
    const shouldAutoScrollBecauseSticky =
      shouldStickToBottomRef.current &&
      !(manageInitialViewportExternally && (isInitialRender || didSwitchMessageContext));

    if (
      shouldAutoScrollOnInitialization ||
      shouldAutoScrollBecauseSticky ||
      didRequestForceScroll
    ) {
      scrollToBottom(didRequestForceScroll && !isInitialRender ? "smooth" : "auto");
    }

    previousFirstMessageIdRef.current = firstMessageId;
    previousLastMessageIdRef.current = lastMessageId;
    previousMessageCountRef.current = messageCount;
    previousForceScrollTokenRef.current = forceScrollToken;
  }, [
    firstMessageId,
    forceScrollToken,
    isLoading,
    lastMessageId,
    manageInitialViewportExternally,
    messageCount,
    scrollToBottom,
  ]);

  return {
    isAtBottom,
    bottomOffset,
    scrollContainerRef,
    scrollToBottom,
  };
}

function useMessageJumpNavigation(scrollContainerRef: { current: HTMLDivElement | null }) {
  const messageElementMapRef = useRef(new Map<string, HTMLDivElement>());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  useEffect(() => clearHighlight, [clearHighlight]);

  const registerMessageElement = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageElementMapRef.current.set(messageId, element);
      return;
    }

    messageElementMapRef.current.delete(messageId);
  }, []);

  const scrollToMessage = useCallback(
    (
      messageId: string,
      options?: {
        behavior?: ScrollBehavior;
        highlight?: boolean;
      },
    ) => {
      const scrollContainer = scrollContainerRef.current;
      const targetElement = messageElementMapRef.current.get(messageId);
      if (!scrollContainer || !targetElement) return;

      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();
      const nextScrollTop =
        scrollContainer.scrollTop +
        (elementRect.top - containerRect.top) -
        Math.max(24, containerRect.height * 0.24);

      scrollContainer.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: options?.behavior ?? "smooth",
      });

      if (options?.highlight === false) {
        clearHighlight();
        return;
      }

      clearHighlight();
      setHighlightedMessageId(messageId);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId((currentValue) =>
          currentValue === messageId ? null : currentValue,
        );
        highlightTimeoutRef.current = null;
      }, 2200);
    },
    [clearHighlight, scrollContainerRef],
  );

  return {
    highlightedMessageId,
    jumpToMessage: (messageId: string) => scrollToMessage(messageId),
    registerMessageElement,
    scrollToMessage,
  };
}

function useMessageViewportRestore({
  contextKey,
  unreadAnchorMessageId,
  isLoading,
  messageCount,
  scrollContainerRef,
  scrollToBottom,
  scrollToMessage,
  scrollTopCacheRef,
}: {
  contextKey: string | null;
  unreadAnchorMessageId: string | null;
  isLoading: boolean;
  messageCount: number;
  scrollContainerRef: { current: HTMLDivElement | null };
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (
    messageId: string,
    options?: {
      behavior?: ScrollBehavior;
      highlight?: boolean;
    },
  ) => void;
  scrollTopCacheRef: { current: Record<string, number> };
}) {
  const previousContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contextKey) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const persistScrollTop = () => {
      scrollTopCacheRef.current[contextKey] = container.scrollTop;
    };

    container.addEventListener("scroll", persistScrollTop, { passive: true });

    return () => {
      persistScrollTop();
      container.removeEventListener("scroll", persistScrollTop);
    };
  }, [contextKey, scrollContainerRef, scrollTopCacheRef]);

  useEffect(() => {
    if (!contextKey || isLoading || messageCount === 0) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    if (previousContextKeyRef.current === contextKey) {
      return;
    }

    previousContextKeyRef.current = contextKey;

    const savedScrollTop = scrollTopCacheRef.current[contextKey];
    if (typeof savedScrollTop === "number") {
      container.scrollTop = savedScrollTop;
      return;
    }

    if (unreadAnchorMessageId) {
      scrollToMessage(unreadAnchorMessageId, {
        behavior: "auto",
        highlight: false,
      });
      return;
    }

    scrollToBottom("auto");
  }, [
    contextKey,
    isLoading,
    messageCount,
    scrollContainerRef,
    scrollToBottom,
    scrollToMessage,
    scrollTopCacheRef,
    unreadAnchorMessageId,
  ]);
}

function useTransientNotice(durationMs = TRANSIENT_NOTICE_DURATION_MS) {
  const [notice, setNotice] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotice = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setNotice(null);
  }, []);

  const showNotice = useCallback(
    (nextNotice: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setNotice(nextNotice);
      timeoutRef.current = setTimeout(() => {
        setNotice(null);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => clearNotice, [clearNotice]);

  return {
    notice,
    clearNotice,
    showNotice,
  };
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to a synchronous DOM copy path when the Clipboard API is unavailable.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const didCopy = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!didCopy) {
    throw new Error("Unable to copy the share link.");
  }
}

function getTimestampValue(value: string | null) {
  if (!value) return 0;

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function sortMessagesChronologically<T extends { id: string; createdAt: string | null }>(
  messages: T[],
) {
  const dedupedMessages = Array.from(
    new Map(messages.map((message) => [message.id, message])).values(),
  );

  return dedupedMessages.sort((leftMessage, rightMessage) => {
    const timestampDifference =
      getTimestampValue(leftMessage.createdAt) - getTimestampValue(rightMessage.createdAt);

    if (timestampDifference !== 0) {
      return timestampDifference;
    }

    return leftMessage.id.localeCompare(rightMessage.id);
  });
}

function buildCurrentUserGroupMember(
  user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null,
): GroupChatMemberProfile | null {
  const resolvedName = user?.name?.trim() || user?.email?.trim() || "";
  if (!resolvedName) return null;

  return {
    id: user?.id ?? "current-user",
    name: resolvedName,
    description: "You",
    time: "Now",
    previewBio: "You are part of this community conversation.",
    avatar: "portrait-a",
    avatarUrl: user?.avatarUrl?.trim() || null,
    initial: getSenderInitials(resolvedName),
    badgeColor: "#A6BA63",
    badgeTextColor: "#1D1D1B",
    email: user?.email?.trim() || null,
    directMessageTargetId: user?.id?.trim() || user?.email?.trim() || null,
    isCurrentUser: true,
  };
}

function createInitialGroupChatState(
  group: ApiGroupRecord,
  user: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  } | null,
): GroupChatState {
  const currentUserMember = buildCurrentUserGroupMember(user);
  const members = currentUserMember && group.isJoined ? [currentUserMember] : [];
  const welcomeMessage = group.description.trim()
    ? [
        {
          id: `welcome-${group.id}`,
          senderId: `group-${group.id}`,
          text: group.description.trim(),
          attachments: [],
          createdAt: group.createdAt,
        },
      ]
    : [];

  return {
    members,
    messages: welcomeMessage,
  };
}

function getJoinedGroupsUserStorageKey(user: {
  id?: string | null;
  email?: string | null;
} | null) {
  return user?.id?.trim() || user?.email?.trim() || null;
}

function areStringArraysEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function areApiGroupCollectionsEqual(
  left: ApiGroupRecord[],
  right: ApiGroupRecord[],
) {
  return (
    left.length === right.length &&
    left.every((group, index) => {
      const nextGroup = right[index];
      if (!nextGroup) {
        return false;
      }

      return (
        group.id === nextGroup.id &&
        group.slug === nextGroup.slug &&
        group.name === nextGroup.name &&
        group.description === nextGroup.description &&
        group.icon === nextGroup.icon &&
        group.memberCount === nextGroup.memberCount &&
        group.postCount === nextGroup.postCount &&
        group.isJoined === nextGroup.isJoined &&
        (group.unreadCount ?? 0) === (nextGroup.unreadCount ?? 0) &&
        (group.conversationId ?? null) === (nextGroup.conversationId ?? null) &&
        (group.status ?? null) === (nextGroup.status ?? null) &&
        (group.color ?? null) === (nextGroup.color ?? null) &&
        (group.createdAt ?? null) === (nextGroup.createdAt ?? null)
      );
    })
  );
}

function mergePersistedJoinedGroups(
  groups: ApiGroupRecord[],
  persistedJoinedGroups:
    | {
        groupIds: string[];
        groupSlugs: string[];
        updatedAt?: number;
      }
    | null
    | undefined,
) {
  if (!persistedJoinedGroups) {
    return groups;
  }

  const liveJoinedCount = groups.filter((group) => group.isJoined).length;
  if (liveJoinedCount > 0) {
    return groups;
  }

  const persistedAgeMs =
    typeof persistedJoinedGroups.updatedAt === "number"
      ? Date.now() - persistedJoinedGroups.updatedAt
      : Number.POSITIVE_INFINITY;
  if (persistedAgeMs > 5 * 60 * 1000) {
    return groups;
  }

  const persistedIds = new Set(persistedJoinedGroups.groupIds);
  const persistedSlugs = new Set(persistedJoinedGroups.groupSlugs);
  let remainingJoinedSlots =
    MAX_GROUPS - groups.filter((group) => group.isJoined).length;

  return groups.map((group) => {
    const normalizedGroupId = group.id.trim().toLowerCase();
    const normalizedGroupSlug = group.slug?.trim().toLowerCase() ?? "";
    const isPersistedJoined =
      persistedIds.has(normalizedGroupId) ||
      (normalizedGroupSlug ? persistedSlugs.has(normalizedGroupSlug) : false);

    if (!isPersistedJoined || group.isJoined || remainingJoinedSlots <= 0) {
      return group;
    }

    remainingJoinedSlots -= 1;
    return {
      ...group,
      isJoined: true,
    };
  });
}

function enforceJoinedGroupLimit(groups: ApiGroupRecord[]) {
  let joinedGroupsCount = 0;

  return groups.map((group) => {
    if (!group.isJoined) {
      return group;
    }

    if (joinedGroupsCount < MAX_GROUPS) {
      joinedGroupsCount += 1;
      return group;
    }

    return {
      ...group,
      isJoined: false,
      unreadCount: 0,
    };
  });
}

function mergeLiveGroupMessagesWithExistingState(
  liveMessages: GroupChatMessageRecord[],
  existingMessages: GroupChatMessageRecord[],
) {
  const existingMessagesById = new Map(
    existingMessages.map((message) => [message.id, message]),
  );
  const nextLiveMessages = liveMessages.map((liveMessage) => {
    const existingMessage = existingMessagesById.get(liveMessage.id);

    if (!existingMessage) {
      return liveMessage;
    }

    const lostAttachmentOnlyMessage =
      liveMessage.text === "" &&
      liveMessage.attachments.length === 0 &&
      existingMessage.attachments.length > 0;

    if (!lostAttachmentOnlyMessage) {
      return liveMessage;
    }

    return {
      ...liveMessage,
      text: existingMessage.text,
      attachments: existingMessage.attachments,
    };
  });
  const liveMessageIds = new Set(nextLiveMessages.map((message) => message.id));
  const preservedExistingMessages = existingMessages.filter((message) => {
    if (liveMessageIds.has(message.id)) {
      return false;
    }
    // Only preserve messages that are genuinely still in-flight (pending).
    // The previous 30-second window for current-user messages caused
    // confirmed messages to appear twice during slow sends: the background
    // refresh would return the real server message, but the 30-second
    // window would also preserve the optimistic copy before the send
    // handler's success path had a chance to clean it up.
    return message.isPending === true;
  });

  return [...nextLiveMessages, ...preservedExistingMessages];
}

function resolveUnreadAnchorMessageId<T extends { id: string }>(
  messages: T[],
  unreadCount: number,
) {
  if (messages.length === 0 || unreadCount <= 0) {
    return null;
  }

  const oldestUnreadIndex = Math.max(0, messages.length - unreadCount);
  return messages[oldestUnreadIndex]?.id ?? null;
}

function formatMessageTimestamp(value: string | null) {
  if (!value) return "";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedValue);
}

function splitLinkFromTrailingPunctuation(linkText: string) {
  let trailingCharacters = "";
  let normalizedLink = linkText;

  while (/[),.!?;:]$/.test(normalizedLink)) {
    trailingCharacters = `${normalizedLink.slice(-1)}${trailingCharacters}`;
    normalizedLink = normalizedLink.slice(0, -1);
  }

  return {
    trailingCharacters,
    normalizedLink,
  };
}

function normalizeMessageLinkHref(linkText: string) {
  return linkText.startsWith("http://") || linkText.startsWith("https://")
    ? linkText
    : `https://${linkText}`;
}

function buildReplyPreviewFromMessage(message: {
  id: string;
  senderName?: string;
  text: string;
  attachments: ApiAttachmentRecord[];
}): ApiMessageReplyRecord {
  const attachmentLabel = message.attachments[0]?.name?.trim();
  const normalizedText = message.text.trim();

  return {
    id: message.id,
    senderName: message.senderName?.trim() || "Community member",
    text:
      normalizedText ||
      (attachmentLabel ? `Attachment: ${attachmentLabel}` : "Message attachment"),
  };
}

function usesMessagesNavigation(preset: DashboardPreset) {
  return (
    preset === "messages" ||
    preset === "messages-plus" ||
    preset === "messages-guest" ||
    preset === "dm-member-card"
  );
}

function shouldUseDirectMessageFallback(
  error: unknown,
  participantId: string | null,
): participantId is string {
  return (
    Boolean(participantId) &&
    error instanceof ApiError &&
    [403, 404, 405, 500].includes(error.status)
  );
}

function isSyntheticDirectConversationId(conversationId: string | null | undefined) {
  const normalizedConversationId = conversationId?.trim().toLowerCase() ?? "";
  return normalizedConversationId.startsWith("dm:");
}

function getConversationParticipantEmails(conversation: ApiConversationRecord) {
  return conversation.participants
    .map((participant) => participant.email?.trim().toLowerCase() ?? "")
    .filter(Boolean);
}

function findMatchingDirectConversationByPeer(
  targetConversation: ApiConversationRecord,
  conversations: ApiConversationRecord[],
) {
  const targetParticipantId = targetConversation.participantId?.trim().toLowerCase() ?? "";
  const targetParticipantEmails = getConversationParticipantEmails(targetConversation);
  const targetParticipantName = targetConversation.participantName?.trim().toLowerCase() ?? "";
  const targetConversationName = targetConversation.name.trim().toLowerCase();

  return conversations.find((conversation) => {
    if (isGroupBackedConversation(conversation)) {
      return false;
    }

    const participantId = conversation.participantId?.trim().toLowerCase() ?? "";
    const participantEmails = getConversationParticipantEmails(conversation);
    const participantName = conversation.participantName?.trim().toLowerCase() ?? "";
    const conversationName = conversation.name.trim().toLowerCase();

    return (
      (targetParticipantId && participantId === targetParticipantId) ||
      targetParticipantEmails.some((email) => participantEmails.includes(email)) ||
      (targetParticipantName && participantName === targetParticipantName) ||
      (targetConversationName && conversationName === targetConversationName)
    );
  }) ?? null;
}

function mergeLiveConversationsWithLocalSyntheticConversations(
  liveConversations: ApiConversationRecord[],
  currentConversations: ApiConversationRecord[],
  options?: {
    selectedConversationId?: string | null;
    messagesByConversationId?: Record<string, ApiMessageRecord[]>;
  },
) {
  const selectedConversationId = options?.selectedConversationId?.trim() ?? "";
  const messagesByConversationId = options?.messagesByConversationId ?? {};

  const localConversationsToPreserve = currentConversations.filter((conversation) => {
    if (isGroupBackedConversation(conversation)) {
      return false;
    }

    if (findMatchingDirectConversationByPeer(conversation, liveConversations)) {
      return false;
    }

    const cachedMessages = messagesByConversationId[conversation.id] ?? [];
    const hasCachedMessages = cachedMessages.length > 0;

    return (
      isSyntheticDirectConversationId(conversation.id) ||
      hasCachedMessages ||
      conversation.id === selectedConversationId
    );
  });

  return [...localConversationsToPreserve, ...liveConversations];
}

function isGroupBackedConversation(conversation: ApiConversationRecord) {
  if (conversation.groupId || conversation.groupSlug) {
    return true;
  }

  const normalizedType = conversation.conversationType?.trim().toLowerCase() ?? "";
  return (
    normalizedType === "group" ||
    normalizedType === "community" ||
    normalizedType === "clique"
  );
}

function isCurrentConversationParticipant(
  participant: ApiConversationParticipantRecord,
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  if (currentUserId && participant.id === currentUserId) {
    return true;
  }

  if (
    currentUserEmail &&
    participant.email &&
    participant.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

function resolveDirectConversationPeer(
  conversation: ApiConversationRecord,
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  const matchedParticipant =
    conversation.participants.find(
      (participant) =>
        !isCurrentConversationParticipant(
          participant,
          currentUserId,
          currentUserEmail,
        ),
    ) ?? null;

  if (matchedParticipant) {
    return matchedParticipant;
  }

  const fallbackParticipantName =
    conversation.participantName?.trim() || conversation.name.trim();

  if (
    currentUserEmail &&
    fallbackParticipantName &&
    fallbackParticipantName.toLowerCase() === currentUserEmail.trim().toLowerCase()
  ) {
    return null;
  }

  return fallbackParticipantName
    ? ({
        id: conversation.participantId ?? conversation.id,
        name: fallbackParticipantName,
        email: null,
      } satisfies ApiConversationParticipantRecord)
    : null;
}

function resolveDirectConversationRecord(
  conversation: ApiConversationRecord,
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  if (isGroupBackedConversation(conversation)) {
    return conversation;
  }

  const resolvedPeer = resolveDirectConversationPeer(
    conversation,
    currentUserId,
    currentUserEmail,
  );
  const resolvedName =
    resolvedPeer?.name?.trim() ||
    conversation.participantName?.trim() ||
    conversation.name.trim() ||
    "Message";

  return {
    ...conversation,
    name: resolvedName,
    participantId: resolvedPeer?.id ?? conversation.participantId,
    participantName: resolvedName,
  } satisfies ApiConversationRecord;
}

function resolveDirectUnreadMessagesCount(
  conversations: ApiConversationRecord[],
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  return conversations
    .filter((conversation) => !isGroupBackedConversation(conversation))
    .map((conversation) =>
      resolveDirectConversationRecord(conversation, currentUserId, currentUserEmail),
    )
    .reduce((totalUnread, conversation) => totalUnread + conversation.unreadCount, 0);
}

function resolveInitialMobileGroupsView(
  preset: DashboardPreset,
): MobileGroupsView {
  switch (preset) {
    case "chat":
      return "chat";
    case "members":
    case "public-members":
      return "members";
    case "guest":
      return "restricted";
    default:
      return "list";
  }
}

function resolveInitialMobileMessagesView(
  preset: DashboardPreset,
): MobileMessagesView {
  if (preset === "messages-plus") return "discover";
  return preset === "messages-guest" ? "restricted" : "list";
}

function toDiscoverPerson(
  conversation: ApiConversationRecord,
  dashboardConversation: ConversationRecord | null,
  index: number,
): MobileDiscoverPerson {
  const name =
    conversation.participantName ??
    dashboardConversation?.name ??
    conversation.name;
  const lastSeenTime = dashboardConversation?.time?.trim();

  return {
    id: conversation.id,
    conversationId: conversation.id,
    name,
    subtitle: "Community Member",
    lastSeenLabel: lastSeenTime ? `LAST SEEN ${lastSeenTime}` : "LAST SEEN RECENTLY",
    tone: dashboardConversation?.tone ?? MOBILE_DISCOVER_TONES[index % MOBILE_DISCOVER_TONES.length],
    initial: dashboardConversation?.initial ?? name[0]?.toUpperCase() ?? "P",
  };
}

function findMatchingGroupConversation(
  group: ApiGroupRecord,
  conversations: ApiConversationRecord[],
) {
  const normalizedGroupSlug = group.slug?.trim().toLowerCase() ?? null;
  const normalizedGroupName = group.name.trim().toLowerCase();

  return conversations.find((conversation) => {
    if (conversation.groupId === group.id) {
      return true;
    }

    if (
      normalizedGroupSlug &&
      conversation.groupSlug?.trim().toLowerCase() === normalizedGroupSlug
    ) {
      return true;
    }

    if (group.conversationId && conversation.id === group.conversationId) {
      return true;
    }

    const normalizedConversationType =
      conversation.conversationType?.trim().toLowerCase() ?? null;
    if (normalizedConversationType && normalizedConversationType !== "group") {
      return false;
    }

    return conversation.name.trim().toLowerCase() === normalizedGroupName;
  });
}

function hydrateGroupsWithConversationMetadata(
  groups: ApiGroupRecord[],
  conversations: ApiConversationRecord[],
) {
  let didChange = false;
  const nextGroupConversationIdsByGroupId: Record<string, string> = {};

  const nextGroups = groups.map((group) => {
    const matchedConversation = findMatchingGroupConversation(group, conversations);
    const nextUnreadCount = matchedConversation?.unreadCount ?? 0;
    const nextConversationId = matchedConversation?.id ?? group.conversationId ?? null;
    const nextIsJoined = group.isJoined || Boolean(matchedConversation);

    if (nextConversationId) {
      nextGroupConversationIdsByGroupId[group.id] = nextConversationId;
    }

    if (
      (group.unreadCount ?? 0) === nextUnreadCount &&
      group.conversationId === nextConversationId &&
      group.isJoined === nextIsJoined
    ) {
      return group;
    }

    didChange = true;

    return {
      ...group,
      isJoined: nextIsJoined,
      unreadCount: nextUnreadCount,
      conversationId: nextConversationId,
    };
  });

  return {
    groups: nextGroups,
    didChange,
    groupConversationIdsByGroupId: nextGroupConversationIdsByGroupId,
  };
}

export function DashboardWorkspace({
  initialPreset,
}: {
  initialPreset: DashboardPreset;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const tokenType = useAuthStore((state) => state.tokenType);
  const setTokens = useAuthStore((state) => state.setTokens);
  const refreshCurrentUser = useAuthStore((state) => state.refreshCurrentUser);
  const logout = useAuthStore((state) => state.logout);
  const resetPublicOnboarding = useOnboardingStore((state) => state.reset);
  const dashboardCacheKey = getJoinedGroupsUserStorageKey(user);
  const joinedGroupsStorageKey = dashboardCacheKey;
  const cachedDashboardState = dashboardCacheKey
    ? dashboardWorkspaceCache.get(dashboardCacheKey) ?? null
    : null;
  const [hasHydratedAuthStore, setHasHydratedAuthStore] = useState(
    () => useAuthStore.persist?.hasHydrated() ?? false,
  );
  const isAdmin = (user?.isAdmin ?? false) || isElevatedRole(user?.role);

  // Status feature: which author's statuses are open in the full-screen
  // viewer (null = closed), whether the composer is open, and a bump
  // counter StatusStrip watches to know when to re-fetch its feed after a
  // successful post.
  const [openStatusEntry, setOpenStatusEntry] = useState<StatusStripEntry | null>(null);
  const [isStatusComposerOpen, setIsStatusComposerOpen] = useState(false);
  const [statusFeedRefreshKey, setStatusFeedRefreshKey] = useState(0);
  // Mirrors what StatusStrip currently has loaded so the viewer can show
  // every status from the tapped author, not just their latest one.
  const [statusFeedSnapshot, setStatusFeedSnapshot] = useState<ApiStatusRecord[]>([]);

  const openStatusAuthorStatuses = openStatusEntry
    ? groupStatusesByAuthor(statusFeedSnapshot).get(openStatusEntry.authorId) ?? [openStatusEntry.latestStatus]
    : [];

  const handleOpenStatus = useCallback((entry: StatusStripEntry) => {
    setOpenStatusEntry(entry);
  }, []);

  const handleCloseStatusViewer = useCallback(() => {
    setOpenStatusEntry(null);
  }, []);

  const handleStatusDeleted = useCallback(() => {
    setStatusFeedRefreshKey((key) => key + 1);
  }, []);

  const lastPostedStatusRef = useRef<ApiStatusRecord | null>(null);

  const handleStatusPosted = useCallback((posted: ApiStatusRecord) => {
    lastPostedStatusRef.current = posted;
    // Inject immediately into the snapshot so the viewer shows the right
    // backgroundColor without waiting for the server re-fetch.
    setStatusFeedSnapshot((prev) => {
      const without = prev.filter((s) => s.id !== posted.id);
      return [...without, posted];
    });
    setStatusFeedRefreshKey((key) => key + 1);
  }, []);

  // When the server re-sends the feed, patch any entry whose backgroundColor
  // is null with the locally-known value we recorded at post time.
  const handleStatusFeedLoaded = useCallback((feed: ApiStatusRecord[]) => {
    const last = lastPostedStatusRef.current;
    if (last?.backgroundColor) {
      const patched = feed.map((s) =>
        s.id === last.id ? { ...s, backgroundColor: last.backgroundColor } : s,
      );
      setStatusFeedSnapshot(patched);
    } else {
      setStatusFeedSnapshot(feed);
    }
  }, []);

  const [apiGroups, setApiGroups] = useState<ApiGroupRecord[]>(
    () => cachedDashboardState?.apiGroups ?? [],
  );
  const [isGroupsLoading, setIsGroupsLoading] = useState(
    () => !cachedDashboardState,
  );
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const sharingGroupId: string | null = null;
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [groupActionMessage, setGroupActionMessage] = useState<string | null>(
    null,
  );
  const [pendingSharedGroup, setPendingSharedGroup] = useState<{
    groupSlug: string;
    requestedAt: number;
  } | null>(null);
  const [shouldDeferOnboardingRedirect, setShouldDeferOnboardingRedirect] =
    useState(false);
  const [activeSection, setActiveSection] = useState<DashboardSection>(
    () => {
      const screenParam = searchParams.get("screen");
      if (screenParam === "messages") return "messages";
      return (
        cachedDashboardState?.activeSection ??
        (usesMessagesNavigation(initialPreset) ? "messages" : "groups")
      );
    },
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    () => cachedDashboardState?.selectedGroupId ?? "",
  );
  const [selectedConversationId, setSelectedConversationId] = useState(
    () => "",
  );
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>(
    () => cachedDashboardState?.joinedGroupIds ?? [],
  );
  const [apiConversations, setApiConversations] = useState<ApiConversationRecord[]>(
    () => cachedDashboardState?.apiConversations ?? [],
  );
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [conversationMessages, setConversationMessages] = useState<
    ApiMessageRecord[]
  >(() => cachedDashboardState?.conversationMessages ?? []);
  const [directMessagesByConversationId, setDirectMessagesByConversationId] = useState<
    Record<string, ApiMessageRecord[]>
  >(() => cachedDashboardState?.directMessagesByConversationId ?? {});
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(
    null,
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<ChatUploadMode>("drag");
  const [isDesktopUploadViewport, setIsDesktopUploadViewport] = useState(false);
  const [groupChatsById, setGroupChatsById] = useState<Record<string, GroupChatState>>(
    () => cachedDashboardState?.groupChatsById ?? {},
  );
  const apiGroupsRef = useRef<ApiGroupRecord[]>(cachedDashboardState?.apiGroups ?? []);
  const apiConversationsRef = useRef<ApiConversationRecord[]>(
    cachedDashboardState?.apiConversations ?? [],
  );
  const groupChatsByIdRef = useRef<Record<string, GroupChatState>>(
    cachedDashboardState?.groupChatsById ?? {},
  );
  const directMessagesByConversationIdRef = useRef<Record<string, ApiMessageRecord[]>>(
    cachedDashboardState?.directMessagesByConversationId ?? {},
  );
  const selectedConversationIdRef = useRef("");
  const groupScrollTopByIdRef = useRef<Record<string, number>>(
    cachedDashboardState?.groupScrollTopById ?? {},
  );
  const directScrollTopByIdRef = useRef<Record<string, number>>(
    cachedDashboardState?.directScrollTopById ?? {},
  );
  const [groupConversationIdsByGroupId, setGroupConversationIdsByGroupId] =
    useState<Record<string, string>>(
      () => cachedDashboardState?.groupConversationIdsByGroupId ?? {},
    );
  const [groupUnreadAnchorMessageIds, setGroupUnreadAnchorMessageIds] = useState<
    Record<string, string | null>
  >(() => cachedDashboardState?.groupUnreadAnchorMessageIds ?? {});
  const [directUnreadAnchorMessageIds, setDirectUnreadAnchorMessageIds] = useState<
    Record<string, string | null>
  >(() => cachedDashboardState?.directUnreadAnchorMessageIds ?? {});
  const autoJoiningSharedGroupIdRef = useRef<string | null>(null);
  const joinRequestGroupIdRef = useRef<string | null>(null);
  const groupMessageSendInFlightRef = useRef(false);
  const directMessageSendInFlightRef = useRef(false);
  const loadedGroupChatIdsRef = useRef<Record<string, true>>(
    cachedDashboardState?.loadedGroupChatIds ?? {},
  );
  const loadedDirectConversationIdsRef = useRef<Record<string, true>>(
    cachedDashboardState?.loadedDirectConversationIds ?? {},
  );
  const [isGroupMessagesLoading, setIsGroupMessagesLoading] = useState(false);
  const [groupMessagesError, setGroupMessagesError] = useState<string | null>(null);
  const [pendingGroupAttachments, setPendingGroupAttachments] = useState<
    ApiAttachmentRecord[]
  >([]);
  const [pendingReplyMessage, setPendingReplyMessage] =
    useState<ApiMessageReplyRecord | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(
    () =>
      resolveDirectUnreadMessagesCount(
        cachedDashboardState?.apiConversations ?? [],
        user?.id ?? null,
        user?.email ?? null,
      ),
  );
  const [groupPanelMode, setGroupPanelMode] = useState<GroupPanelMode>(() => {
    if (cachedDashboardState?.groupPanelMode) {
      return cachedDashboardState.groupPanelMode;
    }

    switch (initialPreset) {
      case "members":
        return "members-joined";
      case "guest":
        return "restricted";
      case "public-members":
        return "members-public";
      default:
        return "chat";
    }
  });
  const [overlay, setOverlay] = useState<DashboardOverlay>(() => {
    if (initialPreset === "member-card" || initialPreset === "dm-member-card") {
      return "member-card";
    }
    if (initialPreset === "confirm-join") return "confirm-join";
    return null;
  });
  const [pendingJoinGroupId, setPendingJoinGroupId] = useState<string | null>(
    null,
  );
  const [selectedMember, setSelectedMember] = useState(
    () => EMPTY_MEMBER_PREVIEW,
  );
  const [mobileGroupsView, setMobileGroupsView] = useState<MobileGroupsView>(
    () =>
      cachedDashboardState?.mobileGroupsView ??
      resolveInitialMobileGroupsView(initialPreset),
  );
  const [mobileMessagesView, setMobileMessagesView] =
    useState<MobileMessagesView>(() =>
      cachedDashboardState?.mobileMessagesView ??
      resolveInitialMobileMessagesView(initialPreset),
    );
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isDesktopGroupSearchOpen, setIsDesktopGroupSearchOpen] =
    useState(false);
  const [isMobileGroupSearchOpen, setIsMobileGroupSearchOpen] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [didOpenDiscoverFromMessagesList, setDidOpenDiscoverFromMessagesList] =
    useState(false);
  const forbiddenGroupMessageConversationIdsRef = useRef<Record<string, true>>({});
  const [isMobileDirectMessageOpen, setIsMobileDirectMessageOpen] = useState(() =>
    cachedDashboardState?.isMobileDirectMessageOpen ??
    (initialPreset === "dm" || initialPreset === "dm-member-card"),
  );
  const [mobileDirectMessageOrigin, setMobileDirectMessageOrigin] =
    useState<MobileDirectMessageOrigin>(
      cachedDashboardState?.mobileDirectMessageOrigin ??
        (initialPreset === "dm" ? "groups" : "messages"),
    );
  const {
    notice: transientGroupActionMessage,
    clearNotice: clearTransientGroupActionMessage,
    showNotice: showTransientGroupActionMessage,
  } = useTransientNotice();
  const {
    notice: transientMessageActionMessage,
    clearNotice: clearTransientMessageActionMessage,
  } = useTransientNotice();
  const [editingMessage] = useState<EditingMessageDraft | null>(null);
  const [pendingDirectReplyMessage, setPendingDirectReplyMessage] =
    useState<ApiMessageReplyRecord | null>(null);
  const visibleGroupActionMessage = transientGroupActionMessage ?? groupActionMessage;
  const visibleMessageActionMessage =
    transientMessageActionMessage ?? messageActionError;
  const groupsSource = apiGroups;
  const directConversationsSource = isAuthenticated
    ? apiConversations
        .filter((conversation) => !isGroupBackedConversation(conversation))
        .map((conversation) =>
          resolveDirectConversationRecord(
            conversation,
            user?.id ?? null,
            user?.email ?? null,
          ),
        )
    : [];
  const dashboardGroups = groupsSource.map((group, index) =>
    toDashboardGroup(group, index),
  );
  const normalizedGroupSearchQuery = groupSearchQuery.trim().toLowerCase();
  const filteredDashboardGroups = dashboardGroups.filter((group) => {
    if (!normalizedGroupSearchQuery) return true;

    const searchTarget = [
      group.listTitle,
      group.headerTitle,
      group.membersLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchTarget.includes(normalizedGroupSearchQuery);
  });
  const visibleDashboardGroups = normalizedGroupSearchQuery
    ? filteredDashboardGroups
    : dashboardGroups;
  const joinedVisibleDashboardGroups = visibleDashboardGroups.filter((group) =>
    joinedGroupIds.includes(group.id),
  );
  const joinableVisibleDashboardGroups = visibleDashboardGroups.filter(
    (group) => !joinedGroupIds.includes(group.id),
  );
  const orderedVisibleDashboardGroups = normalizedGroupSearchQuery
    ? visibleDashboardGroups
    : [...joinedVisibleDashboardGroups, ...joinableVisibleDashboardGroups];
  const dashboardConversations = directConversationsSource.map((conversation, index) =>
    toDashboardConversation(conversation, index),
  );
  const unreadGroupsCount = dashboardGroups.reduce((totalUnread, group) => {
    if (!joinedGroupIds.includes(group.id)) return totalUnread;

    return totalUnread + (group.unreadCount && group.unreadCount > 0 ? group.unreadCount : 0);
  }, 0);
  const discoverPeople = directConversationsSource.map((conversation, index) =>
    toDiscoverPerson(
      conversation,
      dashboardConversations[index] ?? null,
      index,
    ),
  );
  const showGuestState = initialPreset === "guest" || !isAuthenticated;
  const showMessagesGuestState =
    initialPreset === "messages-guest" || !isAuthenticated;
  const sharedGroupParam = searchParams.get("group");
  const normalizedSharedGroupParam = sharedGroupParam?.trim() || null;
  const selectedApiGroup =
    groupsSource.find((group) => group.id === selectedGroupId) ?? null;
  const selectedGroup =
    dashboardGroups.find((group) => group.id === selectedGroupId) ?? null;
  const selectedGroupConversationId =
    (selectedApiGroup ? groupConversationIdsByGroupId[selectedApiGroup.id] : null) ??
    selectedApiGroup?.conversationId ??
    null;
  const selectedGroupRouteKey = selectedApiGroup?.slug ?? selectedGroupId;
  const selectedApiConversation =
    directConversationsSource.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? null;
  const selectedConversationParticipantId =
    selectedApiConversation?.participantId?.trim() ||
    selectedMember.directMessageTargetId?.trim() ||
    selectedMember.email?.trim() ||
    null;
  const selectedConversationUnreadCount = selectedApiConversation?.unreadCount ?? 0;
  const selectedConversation =
    dashboardConversations.find(
      (conversation) => conversation.id === selectedConversationId,
    ) ?? null;
  const selectedMemberName = selectedMember.name.trim();
  const resolvedConversationTitle =
    selectedApiConversation?.participantName ??
    selectedConversation?.name ??
    null;
  const conversationTitle =
    resolvedConversationTitle ||
    selectedMemberName ||
    "Messages";
  const joinedCount = joinedGroupIds.length;
  const remainingGroupSlots = Math.max(MAX_GROUPS - joinedCount, 0);
  const selectedGroupJoined = joinedGroupIds.includes(selectedGroupId);
  const isDirectMessageScreenActive =
    activeSection === "messages" || isMobileDirectMessageOpen;
  const hasSyntheticDirectConversationOpen =
    isMobileDirectMessageOpen &&
    isSyntheticDirectConversationId(selectedConversationId);
  const isSharedGroupRestrictedPreview =
    Boolean(sharedGroupParam) &&
    Boolean(selectedGroup) &&
    !selectedGroupJoined;
  const restrictedSidebarGroups =
    !showGuestState && isSharedGroupRestrictedPreview
      ? joinedVisibleDashboardGroups
      : visibleDashboardGroups;
  const restrictedOrderedSidebarGroups =
    !showGuestState && isSharedGroupRestrictedPreview
      ? joinedVisibleDashboardGroups
      : orderedVisibleDashboardGroups;
  const selectedGroupChat =
    groupChatsById[selectedGroupId] ?? {
      members: [],
      messages: [],
    };
  const selectedGroupMembers = dedupeGroupMembers(selectedGroupChat.members);
  const selectedGroupMemberCount = selectedGroupMembers.length;
  const selectedGroupDisplay =
    selectedGroup && selectedGroupMemberCount > 0
      ? {
          ...selectedGroup,
          headerMembersLabel: `${selectedGroupMemberCount} member${
            selectedGroupMemberCount === 1 ? "" : "s"
          }`,
        }
      : selectedGroup;
  const joinedGroupsUserStorageKey = dashboardCacheKey;

  const writeDirectConversationCache = useCallback(
    (conversationId: string, messages: ApiMessageRecord[]) => {
      const sortedMessages = sortMessagesChronologically(messages);

      setDirectMessagesByConversationId((currentCache) => {
        const existingMessages = currentCache[conversationId] ?? null;
        if (
          existingMessages &&
          existingMessages.length === sortedMessages.length &&
          existingMessages.every(
            (message, index) => message.id === sortedMessages[index]?.id,
          )
        ) {
          return currentCache;
        }

        return {
          ...currentCache,
          [conversationId]: sortedMessages,
        };
      });
      loadedDirectConversationIdsRef.current[conversationId] = true;

      return sortedMessages;
    },
    [],
  );

  const remapDirectConversationState = useCallback(
    (
      sourceConversationId: string,
      targetConversation: ApiConversationRecord,
      additionalMessages: ApiMessageRecord[] = [],
    ) => {
      const normalizedSourceConversationId = sourceConversationId.trim();
      const normalizedTargetConversationId = targetConversation.id.trim();

      if (!normalizedSourceConversationId || !normalizedTargetConversationId) {
        return;
      }

      const resolvedTargetConversation = resolveDirectConversationRecord(
        targetConversation,
        user?.id ?? null,
        user?.email ?? null,
      );

      setApiConversations((currentConversations) => {
        const remainingConversations = currentConversations.filter(
          (conversation) =>
            conversation.id !== normalizedSourceConversationId &&
            conversation.id !== normalizedTargetConversationId,
        );

        return [resolvedTargetConversation, ...remainingConversations];
      });

      setDirectMessagesByConversationId((currentCache) => {
        const mergedMessages = sortMessagesChronologically([
          ...(currentCache[normalizedTargetConversationId] ?? []),
          ...(currentCache[normalizedSourceConversationId] ?? []),
          ...additionalMessages,
        ]);
        const nextCache = {
          ...currentCache,
          [normalizedTargetConversationId]: mergedMessages,
        };

        if (normalizedSourceConversationId !== normalizedTargetConversationId) {
          delete nextCache[normalizedSourceConversationId];
        }

        directMessagesByConversationIdRef.current = nextCache;
        return nextCache;
      });

      loadedDirectConversationIdsRef.current[normalizedTargetConversationId] = true;
      if (normalizedSourceConversationId !== normalizedTargetConversationId) {
        delete loadedDirectConversationIdsRef.current[normalizedSourceConversationId];
      }

      const savedScrollTop =
        directScrollTopByIdRef.current[normalizedSourceConversationId];
      if (
        normalizedSourceConversationId !== normalizedTargetConversationId &&
        typeof savedScrollTop === "number"
      ) {
        directScrollTopByIdRef.current[normalizedTargetConversationId] = savedScrollTop;
        delete directScrollTopByIdRef.current[normalizedSourceConversationId];
      }

      setDirectUnreadAnchorMessageIds((currentAnchorIds) => {
        const sourceAnchorId = currentAnchorIds[normalizedSourceConversationId];
        const targetAnchorId = currentAnchorIds[normalizedTargetConversationId];

        if (
          normalizedSourceConversationId === normalizedTargetConversationId ||
          (!sourceAnchorId && targetAnchorId)
        ) {
          return currentAnchorIds;
        }

        const nextAnchorIds = { ...currentAnchorIds };
        if (sourceAnchorId && !targetAnchorId) {
          nextAnchorIds[normalizedTargetConversationId] = sourceAnchorId;
        }
        delete nextAnchorIds[normalizedSourceConversationId];
        return nextAnchorIds;
      });

      if (selectedConversationIdRef.current === normalizedSourceConversationId) {
        selectedConversationIdRef.current = normalizedTargetConversationId;
        setSelectedConversationId(normalizedTargetConversationId);
      }
    },
    [user],
  );

  const resolveFreshDirectConversation = useCallback(
    async (
      targetConversation: ApiConversationRecord,
      participantId: string | null,
    ) => {
      const normalizedParticipantId = participantId?.trim().toLowerCase() ?? "";
      const liveConversations = await fetchConversations(
        {
          accessToken,
          refreshToken,
          tokenType,
        },
        (tokens) => {
          setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
        },
      );
      const liveDirectConversations = liveConversations
        .filter((conversation) => !isGroupBackedConversation(conversation))
        .map((conversation) =>
          resolveDirectConversationRecord(
            conversation,
            user?.id ?? null,
            user?.email ?? null,
          ),
        );

      return (
        liveDirectConversations.find(
          (conversation) => conversation.id === targetConversation.id,
        ) ??
        findMatchingDirectConversationByPeer(
          targetConversation,
          liveDirectConversations,
        ) ??
        liveDirectConversations.find((conversation) => {
          const normalizedConversationParticipantId =
            conversation.participantId?.trim().toLowerCase() ?? "";
          return (
            Boolean(normalizedParticipantId) &&
            normalizedConversationParticipantId === normalizedParticipantId
          );
        }) ??
        null
      );
    },
    [accessToken, refreshToken, setTokens, tokenType, user],
  );

  const fetchDirectConversationMessages = useCallback(
    async (conversationId: string, participantId: string | null) => {
      let usedDirectMessageEndpoint = false;
      let liveMessages: ApiMessageRecord[];
      const resolvedSyntheticParticipantId =
        participantId?.trim() ||
        apiConversationsRef.current.find((conversation) => conversation.id === conversationId)
          ?.participantId?.trim() ||
        (isSyntheticDirectConversationId(conversationId)
          ? conversationId.slice(3).trim()
          : "");

      if (isSyntheticDirectConversationId(conversationId)) {
        if (!resolvedSyntheticParticipantId) {
          return {
            messages: writeDirectConversationCache(
              conversationId,
              directMessagesByConversationIdRef.current[conversationId] ?? [],
            ),
            usedDirectMessageEndpoint: true,
          };
        }

        liveMessages = await fetchDirectMessageHistory(
          resolvedSyntheticParticipantId,
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        ).catch((historyError) => {
          if (historyError instanceof ApiError && historyError.status === 404) {
            return [] as ApiMessageRecord[];
          }

          throw historyError;
        });

        return {
          messages: writeDirectConversationCache(conversationId, liveMessages),
          usedDirectMessageEndpoint: true,
        };
      }

      try {
        liveMessages = await fetchConversationMessages(
          conversationId,
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );
      } catch (error) {
        if (!shouldUseDirectMessageFallback(error, participantId)) {
          throw error;
        }

        liveMessages = await fetchDirectMessageHistory(
          participantId,
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        ).catch((historyError) => {
          if (historyError instanceof ApiError && historyError.status === 404) {
            return [] as ApiMessageRecord[];
          }

          throw historyError;
        });
        usedDirectMessageEndpoint = true;
      }

      return {
        messages: writeDirectConversationCache(conversationId, liveMessages),
        usedDirectMessageEndpoint,
      };
    },
    [
      accessToken,
      refreshToken,
      setTokens,
      tokenType,
      writeDirectConversationCache,
    ],
  );

  const syncGroupsSnapshotFromApi = useCallback(async () => {
    if (!accessToken) return;

    const auth = {
      accessToken,
      refreshToken,
      tokenType,
    };
    const [liveGroups, liveConversations] = await Promise.all([
      fetchGroups(auth, (tokens) => {
        setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
      }),
      fetchConversations(auth, (tokens) => {
        setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
      }).catch(() => []),
    ]);
    const { groups: hydratedGroups } = hydrateGroupsWithConversationMetadata(
      liveGroups,
      liveConversations,
    );
    const resolvedGroups = enforceJoinedGroupLimit(hydratedGroups);
    replacePersistedJoinedGroups(
      joinedGroupsUserStorageKey,
      resolvedGroups
        .filter((group) => group.isJoined)
        .map((group) => ({
          id: group.id,
          slug: group.slug,
        })),
    );
    setApiGroups(resolvedGroups);
    setApiConversations((currentConversations) =>
      mergeLiveConversationsWithLocalSyntheticConversations(
        liveConversations,
        currentConversations,
        {
          selectedConversationId: selectedConversationIdRef.current,
          messagesByConversationId: directMessagesByConversationIdRef.current,
        },
      ),
    );
    setJoinedGroupIds(
      resolvedGroups.filter((group) => group.isJoined).map((group) => group.id),
    );

    return {
      groups: resolvedGroups,
      conversations: liveConversations,
    };
  }, [
    accessToken,
    joinedGroupsUserStorageKey,
    refreshToken,
    setTokens,
    tokenType,
  ]);

  const finalizeJoinedGroup = useCallback((
    groupId: string,
    options?: { activateChat?: boolean },
  ) => {
    const shouldActivateChat = options?.activateChat ?? true;
    const matchedGroup =
      apiGroupsRef.current.find((group) => group.id === groupId) ??
      apiGroups.find((group) => group.id === groupId) ??
      null;

    persistJoinedGroup(joinedGroupsUserStorageKey, {
      id: matchedGroup?.id ?? groupId,
      slug: matchedGroup?.slug ?? null,
    });
    persistActiveGroup(joinedGroupsUserStorageKey, {
      id: matchedGroup?.id ?? groupId,
      slug: matchedGroup?.slug ?? null,
    });

    setJoinedGroupIds((currentGroups) => {
      if (currentGroups.includes(groupId)) return currentGroups;
      if (currentGroups.length >= MAX_GROUPS) return currentGroups;
      return [...currentGroups, groupId];
    });
    setApiGroups((currentGroups) => {
      let didChange = false;
      const nextGroups = currentGroups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        if (group.isJoined && (group.unreadCount ?? 0) === 0) {
          return group;
        }

        didChange = true;
        return { ...group, isJoined: true, unreadCount: 0 };
      });

      return didChange ? nextGroups : currentGroups;
    });
    setGroupChatsById((currentChats) => {
      const currentUserMember = buildCurrentUserGroupMember(user);
      if (!currentUserMember) return currentChats;

      const existingChat =
        currentChats[groupId] ??
        createInitialGroupChatState(
          apiGroups.find((group) => group.id === groupId) ?? {
            id: groupId,
            slug: null,
            name: selectedGroup?.headerTitle ?? "Community",
            description: "",
            memberCount: 0,
            postCount: 0,
            isJoined: true,
            createdAt: null,
          },
          user,
        );

      if (existingChat.members.some((member) => member.id === currentUserMember.id)) {
        return currentChats;
      }

      return {
        ...currentChats,
        [groupId]: {
          ...existingChat,
          members: [...existingChat.members, currentUserMember],
        },
      };
    });
    if (shouldActivateChat) {
      setSelectedGroupId(groupId);
      setGroupPanelMode("chat");
      setMobileGroupsView("chat");
    } else if (selectedGroupId === groupId) {
      setGroupPanelMode("members-joined");
      setMobileGroupsView("members");
    }
    setPendingJoinGroupId(null);
    setOverlay(null);
    setGroupActionMessage(null);
    clearPendingSharedGroup();
    setPendingSharedGroup(null);
    autoJoiningSharedGroupIdRef.current = null;
  }, [apiGroups, joinedGroupsUserStorageKey, selectedGroup?.headerTitle, selectedGroupId, user]);

  useEffect(() => {
    apiGroupsRef.current = apiGroups;
  }, [apiGroups]);

  useEffect(() => {
    groupChatsByIdRef.current = groupChatsById;
  }, [groupChatsById]);

  useEffect(() => {
    apiConversationsRef.current = apiConversations;
  }, [apiConversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    const currentUserMember = buildCurrentUserGroupMember(user);
    if (!currentUserMember) return;

    setGroupChatsById((currentChats) => {
      let didChange = false;
      const nextChats: Record<string, GroupChatState> = {};

      for (const [groupId, chat] of Object.entries(currentChats)) {
        const nextMembers = chat.members.some((member) => member.isCurrentUser)
          ? chat.members.map((member) =>
              member.isCurrentUser
                ? {
                    ...member,
                    name: currentUserMember.name,
                    previewBio: currentUserMember.previewBio,
                    avatarUrl: currentUserMember.avatarUrl,
                    initial: currentUserMember.initial,
                    email: currentUserMember.email,
                    directMessageTargetId: currentUserMember.directMessageTargetId,
                  }
                : member,
            )
          : chat.members;
        const nextMessages = chat.messages.some((message) => message.isCurrentUser)
          ? chat.messages.map((message) =>
              message.isCurrentUser
                ? {
                    ...message,
                    senderName: currentUserMember.name,
                    avatarInitial: currentUserMember.initial,
                    avatarUrl: currentUserMember.avatarUrl,
                    avatarColor: currentUserMember.badgeColor,
                    avatarTextColor: currentUserMember.badgeTextColor,
                  }
                : message,
            )
          : chat.messages;

        if (nextMembers !== chat.members || nextMessages !== chat.messages) {
          didChange = true;
          nextChats[groupId] = {
            members: nextMembers,
            messages: nextMessages,
          };
          continue;
        }

        nextChats[groupId] = chat;
      }

      return didChange ? nextChats : currentChats;
    });

    setSelectedMember((currentMember) =>
      currentMember.isCurrentUser
        ? {
            ...currentMember,
            name: currentUserMember.name,
            bio: currentUserMember.previewBio,
            initial: currentUserMember.initial,
            avatarUrl: currentUserMember.avatarUrl,
            email: currentUserMember.email,
            directMessageTargetId: currentUserMember.directMessageTargetId,
          }
        : currentMember,
    );
  }, [user]);

  useEffect(() => {
    directMessagesByConversationIdRef.current = directMessagesByConversationId;
  }, [directMessagesByConversationId]);

  useEffect(() => {
    if (!isAuthenticated || PERSONAL_MESSAGES_DISABLED) {
      setUnreadMessagesCount(0);
      return;
    }

    const nextUnreadMessagesCount = resolveDirectUnreadMessagesCount(
      apiConversations,
      user?.id ?? null,
      user?.email ?? null,
    );

    setUnreadMessagesCount((currentCount) =>
      currentCount === nextUnreadMessagesCount
        ? currentCount
        : nextUnreadMessagesCount,
    );
  }, [apiConversations, isAuthenticated, user?.email, user?.id]);

  useEffect(() => {
    if (!dashboardCacheKey || !hasHydratedAuthStore || !isAuthenticated) {
      return;
    }

    dashboardWorkspaceCache.set(dashboardCacheKey, {
      activeSection,
      apiGroups,
      selectedGroupId,
      joinedGroupIds,
      apiConversations,
      selectedConversationId,
      conversationMessages,
      directMessagesByConversationId,
      groupChatsById,
      groupConversationIdsByGroupId,
      groupUnreadAnchorMessageIds,
      directUnreadAnchorMessageIds,
      unreadMessagesCount,
      groupPanelMode,
      selectedMember,
      mobileGroupsView,
      mobileMessagesView,
      isMobileDirectMessageOpen,
      mobileDirectMessageOrigin,
      groupScrollTopById: { ...groupScrollTopByIdRef.current },
      directScrollTopById: { ...directScrollTopByIdRef.current },
      loadedGroupChatIds: { ...loadedGroupChatIdsRef.current },
      loadedDirectConversationIds: { ...loadedDirectConversationIdsRef.current },
    });
  }, [
    activeSection,
    apiConversations,
    apiGroups,
    conversationMessages,
    dashboardCacheKey,
    directMessagesByConversationId,
    directUnreadAnchorMessageIds,
    groupChatsById,
    groupConversationIdsByGroupId,
    groupPanelMode,
    groupUnreadAnchorMessageIds,
    hasHydratedAuthStore,
    isAuthenticated,
    isMobileDirectMessageOpen,
    joinedGroupIds,
    mobileDirectMessageOrigin,
    mobileGroupsView,
    mobileMessagesView,
    selectedConversationId,
    selectedGroupId,
    selectedMember,
    unreadMessagesCount,
  ]);

  useEffect(() => {
    if (!isAuthenticated && dashboardCacheKey) {
      dashboardWorkspaceCache.delete(dashboardCacheKey);
    }
  }, [dashboardCacheKey, isAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewport = () => {
      setIsDesktopUploadViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      setPendingReplyMessage(null);
    }
  }, [selectedGroupId]);

  const canSearchGroups =
    !showGuestState && joinedCount > 0 && !isSharedGroupRestrictedPreview;

  useEffect(() => {
    if (canSearchGroups) return;

    setGroupSearchQuery("");
    setIsDesktopGroupSearchOpen(false);
    setIsMobileGroupSearchOpen(false);
  }, [canSearchGroups]);

  const listHeaderCount =
    activeSection === "messages"
      ? PERSONAL_MESSAGES_DISABLED
        ? 0
        : showMessagesGuestState
          ? 0
          : dashboardConversations.length
      : restrictedSidebarGroups.length;
  const listHeaderLabel =
    activeSection === "messages"
      ? PERSONAL_MESSAGES_DISABLED
        ? "COMING SOON"
        : showMessagesGuestState
          ? "ACCESS RESTRICTED"
          : isConversationsLoading
            ? "LOADING CONVERSATIONS"
            : dashboardConversations.length === 0
              ? "NO CONVERSATIONS YET"
              : "PERSONAL CONVERSATIONS"
      : !showGuestState && isSharedGroupRestrictedPreview
        ? normalizedGroupSearchQuery
          ? restrictedSidebarGroups.length === 0
            ? "NO SEARCH RESULTS"
            : "SEARCH RESULTS"
          : "ALL CLIQUES"
      : isGroupsLoading
        ? "LOADING COMMUNITIES"
        : normalizedGroupSearchQuery
          ? restrictedSidebarGroups.length === 0
            ? "NO SEARCH RESULTS"
            : "SEARCH RESULTS"
          : restrictedSidebarGroups.length === 0
            ? "NO COMMUNITIES YET"
          : "ALL CLIQUES";
  const showJoinBanner =
    activeSection === "groups" &&
    !showGuestState &&
    !isSharedGroupRestrictedPreview &&
    !normalizedGroupSearchQuery &&
    joinedCount > 0 &&
    remainingGroupSlots > 0 &&
    joinableVisibleDashboardGroups.length > 0;
  const joinBannerMessage =
    remainingGroupSlots > 0
      ? formatRemainingGroupSlotsMessage(remainingGroupSlots)
      : null;
  const shouldUseDesktopSharedGroupSidebar =
    activeSection === "groups" &&
    showGuestState &&
    isSharedGroupRestrictedPreview &&
    Boolean(selectedGroup);
  const desktopSidebarGroups =
    shouldUseDesktopSharedGroupSidebar && selectedGroup
      ? [selectedGroup]
      : restrictedOrderedSidebarGroups;
  const desktopListHeaderCount = shouldUseDesktopSharedGroupSidebar
    ? 1
    : listHeaderCount;
  const desktopListHeaderLabel = shouldUseDesktopSharedGroupSidebar
    ? "SHARED CLIQUE"
    : listHeaderLabel;

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHasHydratedAuthStore(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      !hasHydratedAuthStore ||
      isAuthenticated ||
      normalizedSharedGroupParam ||
      initialPreset === "guest" ||
      initialPreset === "messages-guest"
    ) {
      return;
    }

    router.replace("/");
  }, [
    hasHydratedAuthStore,
    initialPreset,
    isAuthenticated,
    normalizedSharedGroupParam,
    router,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !accessToken ||
      shouldDeferOnboardingRedirect
    ) {
      return;
    }
    void refreshCurrentUser();
  }, [
    accessToken,
    isAuthenticated,
    refreshCurrentUser,
    shouldDeferOnboardingRedirect,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextPendingSharedGroup = readPendingSharedGroup();
    setPendingSharedGroup(nextPendingSharedGroup);
    setShouldDeferOnboardingRedirect(
      Boolean(
        normalizedSharedGroupParam &&
          (
            nextPendingSharedGroup?.groupSlug ||
            !joinedGroupIds.includes(selectedGroupId || "__missing__")
          ),
      ),
    );
  }, [
    isAuthenticated,
    joinedGroupIds,
    normalizedSharedGroupParam,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !accessToken ||
      (normalizedSharedGroupParam && !selectedGroupJoined)
    ) {
      return;
    }

    let isActive = true;

    const ensureOnboardingIsComplete = async () => {
      const localProfileSetup = useProfileSetupStore.getState();
      const currentAuthUser = useAuthStore.getState().user;
      const onboardingUserKey = getOnboardingUserKey(
        currentAuthUser,
        localProfileSetup.emailAddress,
      );
      const hasLocalOnboardingData =
        localProfileSetup.bio.trim().length > 0 &&
        localProfileSetup.selectedCategories.length > 0 &&
        localProfileSetup.selectedSkills.length > 0;

      if (
        localProfileSetup.remoteProfileMissing &&
        (hasLocalOnboardingData ||
          localProfileSetup.hasCompletedOnboarding(onboardingUserKey))
      ) {
        return;
      }

      try {
        const profile = await fetchProfile(
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        useProfileSetupStore.getState().setRemoteProfileMissing(false);

        useProfileSetupStore.getState().hydrateProfile({
          fullName: profile.fullName || undefined,
          username: profile.username || undefined,
          bio: profile.bio,
          linkedin: profile.linkedin,
          xHandle: profile.xHandle,
          portfolio: profile.portfolio,
          avatarPreview: profile.avatarUrl,
          selectedCategories: profile.categories
            .map((category) => normalizeCategory(category))
            .filter((value): value is string => Boolean(value)),
          selectedSkills: profile.skills
            .map((skill) => normalizeSkill(skill))
            .filter((value): value is string => Boolean(value)),
        });

        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const nextName = profile.fullName || currentUser.name;
          const nextUsername = profile.username || currentUser.username || null;
          const nextAvatarUrl = profile.avatarUrl ?? currentUser.avatarUrl ?? null;

          if (
            nextName !== currentUser.name ||
            nextUsername !== (currentUser.username || null) ||
            nextAvatarUrl !== (currentUser.avatarUrl ?? null)
          ) {
            useAuthStore.getState().setUser({
              ...currentUser,
              name: nextName,
              username: nextUsername,
              avatarUrl: nextAvatarUrl,
            });
          }
        }

        if (!isActive) return;

        if (isProfileComplete(profile)) {
          useProfileSetupStore
            .getState()
            .markOnboardingCompleted(onboardingUserKey);
          return;
        }

        // Only redirect back to onboarding if the user genuinely hasn't
        // completed it yet. If they have (e.g. the backend saved slowly or
        // returned incomplete data on this fetch), trust the local completion
        // record and keep them on the dashboard rather than bouncing them
        // back to step 1 — which is confusing and loses their progress.
        if (
          useProfileSetupStore
            .getState()
            .hasCompletedOnboarding(onboardingUserKey)
        ) {
          return;
        }

        useProfileSetupStore.getState().setStep(1);
        router.replace("/onboarding");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          useProfileSetupStore.getState().setRemoteProfileMissing(true);

          if (
            hasLocalOnboardingData ||
            useProfileSetupStore
              .getState()
              .hasCompletedOnboarding(onboardingUserKey)
          ) {
            return;
          }

          useProfileSetupStore.getState().setStep(1);
          router.replace("/onboarding");
          return;
        }

        // Keep the dashboard usable if the profile check is temporarily unavailable.
      }
    };

    void ensureOnboardingIsComplete();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    isAuthenticated,
    refreshToken,
    router,
    setTokens,
    tokenType,
    normalizedSharedGroupParam,
    selectedGroupJoined,
    shouldDeferOnboardingRedirect,
  ]);

  useEffect(() => {
    if (!sharedGroupParam || apiGroups.length === 0) return;

    const sharedGroup = apiGroups.find(
      (group) => group.id === sharedGroupParam || group.slug === sharedGroupParam,
    );
    if (!sharedGroup) return;

    setActiveSection("groups");
    setGroupSearchQuery("");
    setIsDesktopGroupSearchOpen(false);
    setIsMobileGroupSearchOpen(false);
    setSelectedGroupId(sharedGroup.id);
    setGroupPanelMode(sharedGroup.isJoined ? "chat" : "restricted");
    setMobileGroupsView(sharedGroup.isJoined ? "chat" : "restricted");
  }, [apiGroups, sharedGroupParam]);

  useEffect(() => {
    const sharedGroupJoinTarget =
      pendingSharedGroup?.groupSlug ?? normalizedSharedGroupParam;

    if (!isAuthenticated || !accessToken || !sharedGroupJoinTarget || apiGroups.length === 0) {
      return;
    }

    const normalizedPendingGroupSlug = sharedGroupJoinTarget.trim().toLowerCase();
    const matchedGroup = apiGroups.find((group) => {
      const normalizedGroupSlug = group.slug?.trim().toLowerCase() ?? "";
      const normalizedGroupId = group.id.trim().toLowerCase();

      return (
        normalizedGroupSlug === normalizedPendingGroupSlug ||
        normalizedGroupId === normalizedPendingGroupSlug
      );
    });

    if (!matchedGroup) return;

    if (matchedGroup.isJoined || joinedGroupIds.includes(matchedGroup.id)) {
      finalizeJoinedGroup(matchedGroup.id);
      return;
    }

    if (autoJoiningSharedGroupIdRef.current === matchedGroup.id) {
      return;
    }

    autoJoiningSharedGroupIdRef.current = matchedGroup.id;

    let isActive = true;

    const joinSharedGroup = async () => {
      setIsJoining(true);
      setJoinError(null);
      setGroupActionMessage(null);

      try {
        await joinGroup(
          {
            id: matchedGroup.id,
            slug: matchedGroup.slug,
          },
          {
            accessToken,
            refreshToken,
            tokenType: tokenType as AuthTokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        finalizeJoinedGroup(matchedGroup.id);
      } catch (error) {
        if (!isActive) return;

        if (isAlreadyMemberJoinError(error)) {
          finalizeJoinedGroup(matchedGroup.id);
          return;
        }

        try {
          const syncedSnapshot = await syncGroupsSnapshotFromApi();
          const syncedGroup =
            syncedSnapshot?.groups.find((group) => group.id === matchedGroup.id) ??
            apiGroupsRef.current.find((group) => group.id === matchedGroup.id) ??
            null;

          if (syncedGroup?.isJoined) {
            finalizeJoinedGroup(matchedGroup.id);
            return;
          }
        } catch {
          // Keep the original join error visible if the resync fails.
        }

        autoJoiningSharedGroupIdRef.current = null;
        setGroupActionMessage(
          normalizeJoinActionMessage(
            extractApiErrorMessage(
              error,
              "Unable to join this community right now.",
            ),
          ),
        );
      } finally {
        if (isActive) {
          setIsJoining(false);
        }
      }
    };

    void joinSharedGroup();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    apiGroups,
    finalizeJoinedGroup,
    isAuthenticated,
    joinedGroupIds,
    normalizedSharedGroupParam,
    pendingSharedGroup?.groupSlug,
    refreshToken,
    syncGroupsSnapshotFromApi,
    setTokens,
    tokenType,
  ]);

  useEffect(() => {
    if (apiGroups.length === 0) return;

    setGroupChatsById((currentChats) => {
      let didChange = false;
      const nextChats = { ...currentChats };

      for (const group of apiGroups) {
        if (!nextChats[group.id]) {
          nextChats[group.id] = createInitialGroupChatState(group, user);
          didChange = true;
          continue;
        }

        if (
          nextChats[group.id].members.length === 0 &&
          group.isJoined &&
          buildCurrentUserGroupMember(user)
        ) {
          nextChats[group.id] = {
            ...nextChats[group.id],
            members: [buildCurrentUserGroupMember(user)!],
          };
          didChange = true;
        }

        if (
          nextChats[group.id].messages.length === 0 &&
          group.description.trim().length > 0
        ) {
          nextChats[group.id] = {
            ...nextChats[group.id],
            messages: [
              {
                id: `welcome-${group.id}`,
                senderId: `group-${group.id}`,
                text: group.description.trim(),
                attachments: [],
                createdAt: group.createdAt,
              },
            ],
          };
          didChange = true;
        }
      }

      return didChange ? nextChats : currentChats;
    });
  }, [apiGroups, user]);

  useEffect(() => {
    setPendingGroupAttachments([]);
    setMessageDraft("");
  }, [selectedGroupId]);

  useEffect(() => {
    let isActive = true;

    const loadGroups = async () => {
      const hasCachedGroups = apiGroupsRef.current.length > 0;
      setIsGroupsLoading(!hasCachedGroups);
      setGroupsError(null);

      try {
        const liveGroups = await fetchGroups(
          accessToken
            ? {
                accessToken,
                refreshToken,
                tokenType,
              }
            : null,
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );
        if (!isActive) return;

        const persistedJoinedGroups = readPersistedJoinedGroups(
          joinedGroupsStorageKey,
        );
        const resolvedGroups = enforceJoinedGroupLimit(
          mergePersistedJoinedGroups(
            liveGroups,
            persistedJoinedGroups,
          ),
        );
        replacePersistedJoinedGroups(
          joinedGroupsStorageKey,
          resolvedGroups
            .filter((group) => group.isJoined)
            .map((group) => ({
              id: group.id,
              slug: group.slug,
            })),
        );
        setApiGroups((currentGroups) =>
          areApiGroupCollectionsEqual(currentGroups, resolvedGroups)
            ? currentGroups
            : resolvedGroups,
        );
        const nextJoinedGroupIds = resolvedGroups
          .filter((group) => group.isJoined)
          .map((group) => group.id);
        setJoinedGroupIds((currentGroupIds) =>
          areStringArraysEqual(currentGroupIds, nextJoinedGroupIds)
            ? currentGroupIds
            : nextJoinedGroupIds,
        );
        if (resolvedGroups.length === 0) {
          setSelectedGroupId("");
          return;
        }

        setSelectedGroupId((currentGroupId) =>
          resolvedGroups.some((group) => group.id === currentGroupId)
            ? currentGroupId
            : "",
        );
      } catch (error) {
        if (!isActive) return;

        if (apiGroupsRef.current.length === 0) {
          setApiGroups([]);
          setSelectedGroupId("");
          setGroupsError(
            extractApiErrorMessage(
              error,
              "Unable to load communities from the live API.",
            ),
          );
        }
      } finally {
        if (isActive) {
          setIsGroupsLoading(false);
        }
      }
    };

    void loadGroups();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    joinedGroupsStorageKey,
    refreshToken,
    setTokens,
    sharedGroupParam,
    tokenType,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setApiConversations([]);
      return;
    }

    if (hasSyntheticDirectConversationOpen) {
      return;
    }

    let isActive = true;

    const loadConversationMetadata = async () => {
      try {
        const authTokens = {
          accessToken,
          refreshToken,
          tokenType,
        };
        const liveConversations = await fetchConversations(
          authTokens,
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        setApiConversations((currentConversations) =>
          mergeLiveConversationsWithLocalSyntheticConversations(
            liveConversations,
            currentConversations,
            {
              selectedConversationId: selectedConversationIdRef.current,
              messagesByConversationId: directMessagesByConversationIdRef.current,
            },
          ),
        );
      } catch {
        if (isActive && apiConversations.length === 0) {
          setApiConversations([]);
        }
      }
    };

    void loadConversationMetadata();
    const refreshInterval = window.setInterval(() => {
      void loadConversationMetadata();
    }, 12000);

    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, [
    accessToken,
    hasSyntheticDirectConversationOpen,
    isAuthenticated,
    refreshToken,
    setTokens,
    tokenType,
  ]);

  useEffect(() => {
    const {
      groups: nextGroups,
      didChange,
      groupConversationIdsByGroupId: nextGroupConversationIdsByGroupId,
    } = hydrateGroupsWithConversationMetadata(
      apiGroupsRef.current,
      isAuthenticated ? apiConversations : [],
    );

    setGroupConversationIdsByGroupId((currentConversationIds) => {
      let nextConversationIds = currentConversationIds;
      let hasChanges = false;

      for (const [groupId, conversationId] of Object.entries(
        nextGroupConversationIdsByGroupId,
      )) {
        if (nextConversationIds[groupId] === conversationId) {
          continue;
        }

        if (!hasChanges) {
          nextConversationIds = { ...currentConversationIds };
          hasChanges = true;
        }

        nextConversationIds[groupId] = conversationId;
      }

      return hasChanges ? nextConversationIds : currentConversationIds;
    });

    if (didChange) {
      setApiGroups(nextGroups);
    }

    setJoinedGroupIds((currentJoinedGroupIds) => {
      const nextJoinedGroupIds = nextGroups
        .filter((group) => group.isJoined)
        .map((group) => group.id);

      if (
        currentJoinedGroupIds.length === nextJoinedGroupIds.length &&
        currentJoinedGroupIds.every((groupId, index) => groupId === nextJoinedGroupIds[index])
      ) {
        return currentJoinedGroupIds;
      }

      return nextJoinedGroupIds;
    });
  }, [apiConversations, apiGroups, isAuthenticated]);

  useEffect(() => {
    if (!selectedGroupId || !selectedGroupRouteKey) return;

    let isActive = true;

    const loadGroupDetail = async () => {
      try {
        const groupDetail = await fetchGroupDetail(selectedGroupRouteKey);
        if (!isActive) return;

        setApiGroups((currentGroups) =>
          currentGroups.map((group) =>
            group.id === selectedGroupId
              ? {
                  ...group,
                  ...groupDetail,
                  id: group.id,
                  isJoined: group.isJoined || groupDetail.isJoined,
                  unreadCount:
                    typeof group.unreadCount === "number"
                      ? group.unreadCount
                      : groupDetail.unreadCount,
                  conversationId: group.conversationId ?? groupDetail.conversationId,
                }
              : group,
          ),
        );
      } catch (error) {
        if (
          !isActive ||
          (error instanceof ApiError && error.status === 404)
        ) {
          return;
        }

        setGroupActionMessage(
          extractApiErrorMessage(
            error,
            "Unable to refresh this community right now.",
          ),
        );
      }
    };

    void loadGroupDetail();

    return () => {
      isActive = false;
    };
  }, [selectedGroupId, selectedGroupRouteKey]);

  useEffect(() => {
    if (
      activeSection !== "groups" ||
      isDirectMessageScreenActive ||
      !selectedGroupId ||
      !selectedApiGroup ||
      !selectedGroupJoined ||
      !isAuthenticated ||
      !accessToken
    ) {
      setIsGroupMessagesLoading(false);
      setGroupMessagesError(null);
      return;
    }

    let isActive = true;
    const shouldUseSilentInitialLoad = Boolean(
      loadedGroupChatIdsRef.current[selectedApiGroup.id],
    );

    const loadGroupMessages = async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setIsGroupMessagesLoading(true);
      } else {
        setIsGroupMessagesLoading(false);
      }
      setGroupMessagesError(null);

      const currentConversationId = selectedGroupConversationId;
      if (
        currentConversationId &&
        forbiddenGroupMessageConversationIdsRef.current[currentConversationId]
      ) {
        if (!silent) {
          setIsGroupMessagesLoading(false);
        }
        return;
      }

      try {
        const liveConversation = await ensureGroupConversation(
          {
            id: selectedApiGroup.id,
            slug: selectedApiGroup.slug,
            name: selectedApiGroup.name,
            conversationId: selectedGroupConversationId,
          },
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        let resolvedConversation = liveConversation;
        if (liveConversation.participants.length === 0) {
          try {
            resolvedConversation = await fetchConversation(
              liveConversation.id,
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
            );
          } catch {
            resolvedConversation = liveConversation;
          }
        }

        if (!isActive) return;

        setGroupConversationIdsByGroupId((currentConversationIds) => ({
          ...currentConversationIds,
          [selectedApiGroup.id]: resolvedConversation.id,
        }));
        delete forbiddenGroupMessageConversationIdsRef.current[resolvedConversation.id];

        const liveMessages = await fetchConversationMessages(
          resolvedConversation.id,
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        const sortedLiveMessages = sortMessagesChronologically(
          mergeLiveGroupMessagesWithExistingState(
            toGroupChatMessages(liveMessages, user),
            groupChatsByIdRef.current[selectedApiGroup.id]?.messages ?? [],
          ),
        );
        const nextGroupUnreadAnchorMessageId =
          typeof groupScrollTopByIdRef.current[selectedApiGroup.id] === "number"
            ? null
            : resolveUnreadAnchorMessageId(
                sortedLiveMessages,
                selectedApiGroup.unreadCount ?? 0,
              );
        setGroupUnreadAnchorMessageIds((currentAnchorIds) =>
          currentAnchorIds[selectedApiGroup.id] === nextGroupUnreadAnchorMessageId
            ? currentAnchorIds
            : {
                ...currentAnchorIds,
                [selectedApiGroup.id]: nextGroupUnreadAnchorMessageId,
              },
        );
        let exactMemberProfiles: GroupChatMemberProfile[] = [];
        try {
          const exactMembers = await fetchGroupMembers(
            selectedApiGroup.id,
            {
              accessToken,
              refreshToken,
              tokenType,
            },
            (tokens) => {
              setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
            },
          );

          exactMemberProfiles = dedupeGroupMembers(
            exactMembers.map((member) =>
              buildGroupMemberProfileFromGroupMemberRecord(member, user),
            ),
          );
        } catch {
          exactMemberProfiles = [];
        }
        const participantMembers = dedupeGroupMembers(
          resolvedConversation.participants.map((participant) =>
            buildGroupMemberProfileFromConversationParticipant(participant, user),
          ),
        );
        const liveMembers = dedupeGroupMembers(
          Array.from(
          new Map(
            liveMessages.map((message) => {
              const profile = buildGroupMemberProfileFromApiMessage(message, user);
              return [profile.id, profile];
            }),
          ).values(),
          ),
        );
        const currentUserMember = buildCurrentUserGroupMember(user);
        const nextMembers = dedupeGroupMembers(
          [
            ...exactMemberProfiles,
            ...participantMembers,
            ...liveMembers,
            ...(currentUserMember &&
            !exactMemberProfiles.some((member) => member.isCurrentUser) &&
            !participantMembers.some((member) => member.isCurrentUser) &&
            !liveMembers.some((member) => member.isCurrentUser)
              ? [currentUserMember]
              : []),
          ],
        );

        setGroupChatsById((currentChats) => {
          const existingChat = currentChats[selectedApiGroup.id];
          const pendingMessages =
            existingChat?.messages.filter((message) => message.isPending) ?? [];
          const nextMessages = sortMessagesChronologically([
            ...sortedLiveMessages,
            ...pendingMessages.filter(
              (pendingMessage) =>
                !sortedLiveMessages.some(
                  (liveMessage) =>
                    liveMessage.senderId === pendingMessage.senderId &&
                    liveMessage.text === pendingMessage.text &&
                    Math.abs(
                      getTimestampValue(liveMessage.createdAt) -
                        getTimestampValue(pendingMessage.createdAt),
                    ) < 15_000,
                ),
            ),
          ]);

          return {
            ...currentChats,
            [selectedApiGroup.id]: {
              members: nextMembers,
              messages: nextMessages,
            },
          };
        });
        loadedGroupChatIdsRef.current[selectedApiGroup.id] = true;
        setApiGroups((currentGroups) =>
          currentGroups.map((group) =>
            group.id === selectedApiGroup.id
              ? {
                  ...group,
                  conversationId: resolvedConversation.id,
                  postCount: liveMessages.length,
                }
              : group,
          ),
        );
        setGroupActionMessage(null);

        await markConversationSeen(
          resolvedConversation.id,
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        setApiGroups((currentGroups) =>
          currentGroups.map((group) =>
            group.id === selectedApiGroup.id
              ? { ...group, unreadCount: 0 }
              : group,
          ),
        );
        setApiConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === resolvedConversation.id
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      } catch (error) {
        if (!isActive) return;

        if (error instanceof ApiError && error.status === 403) {
          const forbiddenConversationId = selectedGroupConversationId;
          if (forbiddenConversationId) {
            forbiddenGroupMessageConversationIdsRef.current[forbiddenConversationId] =
              true;
          }

          if (silent) {
            return;
          }
        }

        if (silent) {
          return;
        }

        setGroupMessagesError(
          extractApiErrorMessage(
            error,
            "Unable to load this community conversation right now.",
          ),
        );
      } finally {
        if (isActive) {
          setIsGroupMessagesLoading(false);
        }
      }
    };

    void loadGroupMessages({ silent: shouldUseSilentInitialLoad });
    const refreshInterval = window.setInterval(() => {
      void loadGroupMessages({ silent: true });
    }, 12000);

    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, [
    accessToken,
    activeSection,
    isDirectMessageScreenActive,
    isAuthenticated,
    refreshToken,
    selectedGroupId,
    selectedGroupJoined,
    setTokens,
    selectedApiGroup?.conversationId,
    selectedApiGroup?.id,
    selectedApiGroup?.name,
    selectedApiGroup?.slug,
    selectedGroupConversationId,
    tokenType,
    user,
  ]);

  useEffect(() => {
    if (activeSection !== "messages" || PERSONAL_MESSAGES_DISABLED) {
      setConversationMessages([]);
      setSelectedConversationId("");
      setConversationsError(null);
      setMessagesError(null);
      setIsConversationsLoading(false);
      return;
    }

    if (!isAuthenticated || !accessToken) {
      setApiConversations([]);
      setConversationMessages([]);
      setSelectedConversationId("");
      setUnreadMessagesCount(0);
      setConversationsError(null);
      setMessagesError(null);
      return;
    }

    let isActive = true;

    const loadConversations = async () => {
      const hasCachedConversations = apiConversations.length > 0;
      setIsConversationsLoading(!hasCachedConversations);
      setConversationsError(null);

      try {
        const authTokens = {
          accessToken,
          refreshToken,
          tokenType,
        };
        const liveConversations = await fetchConversations(
          authTokens,
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        if (!isActive) return;

        const mergedConversations = mergeLiveConversationsWithLocalSyntheticConversations(
          liveConversations,
          apiConversationsRef.current,
          {
            selectedConversationId: selectedConversationIdRef.current,
            messagesByConversationId: directMessagesByConversationIdRef.current,
          },
        );
        const liveDirectConversations = mergedConversations
          .filter((conversation) => !isGroupBackedConversation(conversation))
          .map((conversation) =>
            resolveDirectConversationRecord(
              conversation,
              user?.id ?? null,
              user?.email ?? null,
            ),
          );

        setApiConversations(mergedConversations);
        setSelectedConversationId((currentConversationId) => {
          if (
            liveDirectConversations.some(
              (conversation) => conversation.id === currentConversationId,
            )
          ) {
            return currentConversationId;
          }

          const currentSyntheticConversation = apiConversationsRef.current.find(
            (conversation) => conversation.id === currentConversationId,
          );
          const replacementConversation = currentSyntheticConversation
            ? findMatchingDirectConversationByPeer(
                currentSyntheticConversation,
                mergedConversations,
              )
            : null;

          return replacementConversation?.id ?? "";
        });

        for (const conversation of liveDirectConversations.slice(0, 3)) {
          if (loadedDirectConversationIdsRef.current[conversation.id]) {
            continue;
          }

          void fetchDirectConversationMessages(
            conversation.id,
            conversation.participantId ?? null,
          ).catch(() => undefined);
        }
      } catch (error) {
        if (!isActive) return;

        if (apiConversations.length === 0) {
          setApiConversations([]);
          setSelectedConversationId("");
          setConversationsError(
            extractApiErrorMessage(
              error,
              "Unable to load conversations from the live API.",
            ),
          );
        }
      } finally {
        if (isActive) {
          setIsConversationsLoading(false);
        }
      }
    };

    void loadConversations();

    return () => {
      isActive = false;
    };
  }, [
    accessToken,
    activeSection,
    isAuthenticated,
    refreshToken,
    setTokens,
    tokenType,
    fetchDirectConversationMessages,
    user?.email,
    user?.id,
  ]);

  useEffect(() => {
    if (activeSection !== "messages" || PERSONAL_MESSAGES_DISABLED) {
      setConversationMessages((currentMessages) =>
        currentMessages.length === 0 ? currentMessages : [],
      );
      setPendingDirectReplyMessage((currentReply) =>
        currentReply ? null : currentReply,
      );
      setSelectedConversationId((currentConversationId) =>
        currentConversationId ? "" : currentConversationId,
      );
      setMessagesError((currentError) => (currentError ? null : currentError));
      setMessageActionError((currentError) => (currentError ? null : currentError));
      setIsMessagesLoading((currentValue) => (currentValue ? false : currentValue));
      return;
    }

    if (!isAuthenticated || !accessToken || !selectedConversationId) {
      setConversationMessages((currentMessages) =>
        currentMessages.length === 0 ? currentMessages : [],
      );
      setPendingDirectReplyMessage((currentReply) =>
        currentReply ? null : currentReply,
      );
      setMessagesError((currentError) => (currentError ? null : currentError));
      return;
    }

    let isActive = true;

    const loadMessages = async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const cachedMessages =
        directMessagesByConversationIdRef.current[selectedConversationId] ?? null;
      const hasCachedMessages = Boolean(cachedMessages && cachedMessages.length > 0);

      if (!silent) {
        setIsMessagesLoading(!hasCachedMessages);
        setMessagesError(null);
        setMessageActionError(null);
        if (cachedMessages) {
          setConversationMessages(cachedMessages);
        } else {
          setConversationMessages([]);
        }
      }

      try {
        const participantId = selectedConversationParticipantId;
        const { messages: liveMessages, usedDirectMessageEndpoint } =
          await fetchDirectConversationMessages(
            selectedConversationId,
            participantId,
          );

        if (!isActive) return;

        const nextDirectUnreadAnchorMessageId =
          typeof directScrollTopByIdRef.current[selectedConversationId] === "number"
            ? null
            : resolveUnreadAnchorMessageId(
                liveMessages,
                selectedConversationUnreadCount,
              );
        setDirectUnreadAnchorMessageIds((currentAnchorIds) =>
          currentAnchorIds[selectedConversationId] === nextDirectUnreadAnchorMessageId
            ? currentAnchorIds
            : {
                ...currentAnchorIds,
                [selectedConversationId]: nextDirectUnreadAnchorMessageId,
              },
        );
        setConversationMessages(liveMessages);
        setApiConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
        setUnreadMessagesCount((currentCount) =>
          Math.max(0, currentCount - selectedConversationUnreadCount),
        );

        try {
          if (usedDirectMessageEndpoint && participantId) {
            try {
              await markDirectMessageSeen(
                participantId,
                {
                  accessToken,
                  refreshToken,
                  tokenType,
                },
                (tokens) => {
                  setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
                },
              );
            } catch (error) {
              if (!(error instanceof ApiError) || error.status !== 404) {
                throw error;
              }
            }
          } else {
            await markConversationSeen(
              selectedConversationId,
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
            );
          }

          if (!isActive) return;
        } catch {
          if (isActive) {
            setUnreadMessagesCount((currentCount) => Math.max(0, currentCount));
          }
        }
      } catch (error) {
        if (!isActive) return;

        if (!silent) {
          setConversationMessages((currentMessages) =>
            currentMessages.length === 0 ? currentMessages : [],
          );
          setMessagesError(
            extractApiErrorMessage(
              error,
              "Unable to load messages for this conversation right now.",
            ),
          );
        }
      } finally {
        if (isActive && !silent) {
          setIsMessagesLoading(false);
        }
      }
    };

    void loadMessages({ silent: false });
    const refreshInterval = window.setInterval(() => {
      void loadMessages({ silent: true });
    }, 12000);

    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, [
    accessToken,
    activeSection,
    fetchDirectConversationMessages,
    isAuthenticated,
    refreshToken,
    selectedConversationId,
    selectedConversationParticipantId,
    selectedConversationUnreadCount,
    setTokens,
    tokenType,
  ]);

  useEffect(() => {
    if (!selectedGroupId && !showGuestState) {
      setGroupPanelMode("members-public");
      return;
    }

    if (!selectedGroupId) {
      setGroupPanelMode("restricted");
      return;
    }

    if (Boolean(sharedGroupParam) && !joinedGroupIds.includes(selectedGroupId)) {
      setGroupPanelMode("restricted");
      return;
    }

    setGroupPanelMode(
      resolveGroupsPanel({
        isGuest: showGuestState,
        joinedGroupIds,
        groupId: selectedGroupId,
      }),
    );
  }, [joinedGroupIds, selectedGroupId, sharedGroupParam, showGuestState]);

  const handleGroupsNavigation = () => {
    clearTransientGroupActionMessage();
    clearTransientMessageActionMessage();
    setIsMobileDirectMessageOpen(false);
    setActiveSection("groups");
    setMobileGroupsView("list");
    setDidOpenDiscoverFromMessagesList(false);
    setOverlay(null);
  };

  const handleDesktopGroupSearchToggle = () => {
    if (!canSearchGroups) return;

    setIsDesktopGroupSearchOpen((currentValue) => {
      const nextValue = !currentValue;

      if (nextValue) {
        setGroupPanelMode("chat");
      }

      if (!nextValue) {
        setGroupSearchQuery("");
      }

      return nextValue;
    });
  };

  const handleMobileGroupSearchToggle = () => {
    if (!canSearchGroups) return;

    setIsMobileGroupSearchOpen((currentValue) => {
      const nextValue = !currentValue;

      if (!nextValue) {
        setGroupSearchQuery("");
      }

      return nextValue;
    });
  };

  const handleOpenMobileGroupSearch = () => {
    if (!canSearchGroups) return;

    setActiveSection("groups");
    setMobileGroupsView("list");
    setOverlay(null);
    setIsMobileDirectMessageOpen(false);
    setIsMobileGroupSearchOpen(true);
  };

  const handleMessagesNavigation = () => {
    clearTransientMessageActionMessage();
    setIsMobileDirectMessageOpen(false);
    setActiveSection("messages");
    setMobileMessagesView("list");
    setDidOpenDiscoverFromMessagesList(false);
    setSelectedConversationId("");
    setSelectedMember(EMPTY_MEMBER_PREVIEW);
    setConversationMessages([]);
    setPendingDirectReplyMessage(null);
    setMessagesError(null);
    setMessageActionError(null);
    setOverlay(null);

    if (PERSONAL_MESSAGES_DISABLED) {
      return;
    }

    /*
    if (showMessagesGuestState) {
      setMobileMessagesView("restricted");
      setDidOpenDiscoverFromMessagesList(false);
      setOverlay(null);
      return;
    }

    if (activeSection === "messages" && !isMobileDirectMessageOpen) {
      const nextMessagesView =
        mobileMessagesView === "discover" ? "list" : "discover";
      setMobileMessagesView(nextMessagesView);
      setDidOpenDiscoverFromMessagesList(nextMessagesView === "discover");
      setOverlay(null);
      return;
    }

    setMobileMessagesView("list");
    setDidOpenDiscoverFromMessagesList(false);
    setOverlay(null);
    */
  };

  const handleOpenUploadModal = (nextMode: ChatUploadMode = "drag") => {
    setUploadMode(isDesktopUploadViewport ? nextMode : "browse");
    setIsUploadModalOpen(true);
  };

  const handleReplyToGroupMessage = (message: GroupChatMessageRecord) => {
    clearTransientMessageActionMessage();
    setMessageActionError(null);
    setPendingReplyMessage(buildReplyPreviewFromMessage(message));
  };

  const handleReplyToDirectMessage = (message: ApiMessageRecord) => {
    clearTransientMessageActionMessage();
    setMessageActionError(null);
    setPendingDirectReplyMessage(buildReplyPreviewFromMessage(message));
  };

  const handleClearReplyMessage = () => {
    setPendingReplyMessage(null);
  };

  const handleClearDirectReplyMessage = () => {
    setPendingDirectReplyMessage(null);
  };

  const handleCancelEditingMessage = useCallback(() => {
    clearTransientMessageActionMessage();
    setMessageActionError(null);
  }, [clearTransientMessageActionMessage]);

  const handleProfileNavigation = () => {
    if (PROFILE_SECTION_DISABLED) {
      setOverlay("coming-soon");
      return;
    }

    setOverlay(null);
    setIsMobileDirectMessageOpen(false);
    router.push("/profile");
  };

  const handleGroupSelection = (groupId: string) => {
    const selectedGroupRecord =
      apiGroups.find((group) => group.id === groupId) ?? null;

    setJoinError(null);
    setGroupActionMessage(null);
    clearTransientGroupActionMessage();
    clearTransientMessageActionMessage();
    setGroupSearchQuery("");
    setIsDesktopGroupSearchOpen(false);
    setIsMobileGroupSearchOpen(false);
    setSelectedGroupId(groupId);
    setActiveSection("groups");
    setOverlay(null);
    setIsMobileDirectMessageOpen(false);
    persistActiveGroup(joinedGroupsUserStorageKey, {
      id: selectedGroupRecord?.id ?? groupId,
      slug: selectedGroupRecord?.slug ?? null,
    });
    if (showGuestState || (Boolean(sharedGroupParam) && !joinedGroupIds.includes(groupId))) {
      setGroupPanelMode("restricted");
      setMobileGroupsView("restricted");
      return;
    }
    const hasJoinedGroup = joinedGroupIds.includes(groupId);
    setGroupPanelMode(hasJoinedGroup ? "chat" : "members-public");
    setMobileGroupsView(hasJoinedGroup ? "chat" : "members");
  };

  const handleConversationSelection = (conversationId: string) => {
    const matchedConversation =
      dashboardConversations.find((conversation) => conversation.id === conversationId) ??
      null;
    const matchedApiConversation =
      directConversationsSource.find((conversation) => conversation.id === conversationId) ??
      null;

    if (PERSONAL_MESSAGES_DISABLED) {
      setActiveSection("messages");
      setIsMobileDirectMessageOpen(false);
      setOverlay(null);
      return;
    }

    setConversationsError(null);
    setMessagesError(null);
    setMessageActionError(null);
    clearTransientMessageActionMessage();
    setConversationMessages(
      directMessagesByConversationIdRef.current[conversationId] ?? [],
    );
    setPendingDirectReplyMessage(null);
    setMessageDraft("");
    setSelectedMember({
      id: conversationId,
      initial: matchedConversation?.initial ?? "M",
      name: matchedConversation?.name ?? "Message",
      bio: matchedConversation?.preview ?? "Personal conversation",
      email: null,
      directMessageTargetId: matchedApiConversation?.participantId?.trim() ?? null,
      isCurrentUser: false,
    });
    setSelectedConversationId(conversationId);
    setActiveSection("messages");
    setMobileDirectMessageOrigin("messages");
    setIsMobileDirectMessageOpen(true);
    setOverlay(null);
  };

  const handleDiscoverConversationSelection = (conversationId: string) => {
    const matchedConversation =
      dashboardConversations.find((conversation) => conversation.id === conversationId) ??
      null;
    const matchedApiConversation =
      directConversationsSource.find((conversation) => conversation.id === conversationId) ??
      null;

    if (PERSONAL_MESSAGES_DISABLED) {
      setActiveSection("messages");
      setIsMobileDirectMessageOpen(false);
      setOverlay(null);
      return;
    }

    setConversationsError(null);
    setMessagesError(null);
    setMessageActionError(null);
    clearTransientMessageActionMessage();
    setConversationMessages(
      directMessagesByConversationIdRef.current[conversationId] ?? [],
    );
    setPendingDirectReplyMessage(null);
    setMessageDraft("");
    setSelectedMember({
      id: conversationId,
      initial: matchedConversation?.initial ?? "M",
      name: matchedConversation?.name ?? "Message",
      bio: matchedConversation?.preview ?? "Personal conversation",
      email: null,
      directMessageTargetId: matchedApiConversation?.participantId?.trim() ?? null,
      isCurrentUser: false,
    });
    setSelectedConversationId(conversationId);
    setActiveSection("messages");
    setMobileMessagesView("discover");
    setMobileDirectMessageOrigin("discover");
    setIsMobileDirectMessageOpen(true);
    setOverlay(null);
  };

  const openDirectConversationForMember = useCallback(
    (member: MemberPreview) => {
      if (member.isCurrentUser) {
        setOverlay(null);
        router.push("/profile");
        return;
      }

      const normalizedMemberId = member.id.trim().toLowerCase();
      const normalizedDirectMessageTargetId =
        member.directMessageTargetId?.trim().toLowerCase() ?? "";
      const normalizedMemberEmail = member.email?.trim().toLowerCase() ?? "";
      const matchedConversation = directConversationsSource.find((conversation) => {
        const normalizedParticipantId = conversation.participantId?.trim().toLowerCase() ?? "";
        const normalizedParticipantName =
          conversation.participantName?.trim().toLowerCase() ?? "";
        const normalizedConversationName = conversation.name.trim().toLowerCase();
        const participantEmails = conversation.participants
          .map((participant) => participant.email?.trim().toLowerCase() ?? "")
          .filter(Boolean);

        return (
          (normalizedDirectMessageTargetId &&
            normalizedParticipantId === normalizedDirectMessageTargetId) ||
          (normalizedMemberId && normalizedParticipantId === normalizedMemberId) ||
          (normalizedMemberEmail && participantEmails.includes(normalizedMemberEmail)) ||
          normalizedParticipantName === member.name.trim().toLowerCase() ||
          normalizedConversationName === member.name.trim().toLowerCase()
        );
      });

      const resolvedParticipantId =
        member.directMessageTargetId?.trim() ||
        matchedConversation?.participantId?.trim() ||
        member.email?.trim() ||
        member.id.trim() ||
        member.name.trim();
      const syntheticConversationId =
        matchedConversation?.id ||
        `dm:${resolvedParticipantId || normalizedMemberEmail || member.name.trim().toLowerCase()}`;
      const participantId = resolvedParticipantId;

      if (!matchedConversation) {
        setApiConversations((currentConversations) => {
          if (currentConversations.some((conversation) => conversation.id === syntheticConversationId)) {
            return currentConversations;
          }

          return [
            {
              id: syntheticConversationId,
              name: member.name,
              preview: "Start your conversation here.",
              unreadCount: 0,
              lastMessageAt: null,
              conversationType: "direct",
              participantId,
              participantName: member.name,
              participants: [
                {
                  id: participantId,
                  name: member.name,
                  email: member.email ?? null,
                },
              ],
              groupId: null,
              groupSlug: null,
            },
            ...currentConversations,
          ];
        });
      }

      setConversationsError(null);
      setMessagesError(null);
      setMessageActionError(null);
      clearTransientMessageActionMessage();
      setConversationMessages(
        directMessagesByConversationIdRef.current[syntheticConversationId] ?? [],
      );
      setPendingDirectReplyMessage(null);
      setMessageDraft("");
      setSelectedMember({
        ...member,
        directMessageTargetId: participantId || member.directMessageTargetId || null,
      });
      setSelectedConversationId(syntheticConversationId);
      setOverlay(null);

      const isMobileViewport =
        typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

      if (isMobileViewport) {
        setMobileDirectMessageOrigin("groups");
        setIsMobileDirectMessageOpen(true);
        setActiveSection("groups");
        return;
      }

      setActiveSection("messages");
      setIsMobileDirectMessageOpen(false);
    },
    [
      clearTransientMessageActionMessage,
      directConversationsSource,
      router,
      setApiConversations,
    ],
  );

  const handleMembersToggle = () => {
    if (activeSection !== "groups") return;
    if (showGuestState || isSharedGroupRestrictedPreview) {
      setGroupPanelMode("restricted");
      setMobileGroupsView("restricted");
      return;
    }

    setIsDesktopGroupSearchOpen(false);
    setIsMobileGroupSearchOpen(false);
    setGroupSearchQuery("");

    if (selectedGroupJoined && groupPanelMode === "members-joined") {
      setGroupPanelMode("chat");
      setMobileGroupsView("chat");
      return;
    }
    setGroupPanelMode(selectedGroupJoined ? "members-joined" : "members-public");
    setMobileGroupsView("members");
  };

  const joinSelectedGroup = useCallback(
    async (groupId: string) => {
      if (isJoining || joinRequestGroupIdRef.current) return;

      const pendingGroupRecord =
        apiGroups.find((group) => group.id === groupId) ?? null;
      const isAlreadyJoined =
        joinedGroupIds.includes(groupId) || pendingGroupRecord?.isJoined;

      if (isAlreadyJoined) {
        setOverlay(null);
        finalizeJoinedGroup(groupId);
        return;
      }

      if (!accessToken) {
        const pendingGroupRouteKey =
          pendingGroupRecord?.slug ?? pendingGroupRecord?.id ?? groupId;
        const requestedAt = Date.now();

        rememberPendingSharedGroup(pendingGroupRouteKey);
        setPendingSharedGroup({
          groupSlug: pendingGroupRouteKey,
          requestedAt,
        });
        setPendingJoinGroupId(null);
        setOverlay(null);
        router.push(`/signup?group=${encodeURIComponent(pendingGroupRouteKey)}`);
        return;
      }

      joinRequestGroupIdRef.current = groupId;
      setPendingJoinGroupId(groupId);
      setIsJoining(true);
      setJoinError(null);
      setGroupActionMessage(null);

      try {
        await joinGroup(
          {
            id: pendingGroupRecord?.id ?? groupId,
            slug: pendingGroupRecord?.slug ?? null,
          },
          {
            accessToken,
            refreshToken,
            tokenType: tokenType as AuthTokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        setOverlay(null);
        finalizeJoinedGroup(groupId);
      } catch (error) {
        if (isAlreadyMemberJoinError(error)) {
          setOverlay(null);
          finalizeJoinedGroup(groupId);
          return;
        }

        try {
          const syncedSnapshot = await syncGroupsSnapshotFromApi();
          const syncedGroup =
            syncedSnapshot?.groups.find((group) => group.id === groupId) ??
            apiGroupsRef.current.find((group) => group.id === groupId) ??
            null;

          if (syncedGroup?.isJoined) {
            setOverlay(null);
            finalizeJoinedGroup(groupId);
            return;
          }
        } catch {
          // Keep the original join error visible if the resync fails.
        }

        const nextJoinError = normalizeJoinActionMessage(
          extractApiErrorMessage(
            error,
            "Unable to join this community right now.",
          ),
        );
        setJoinError(nextJoinError);
        setGroupActionMessage(nextJoinError);
      } finally {
        if (joinRequestGroupIdRef.current === groupId) {
          joinRequestGroupIdRef.current = null;
        }
        setIsJoining(false);
        setPendingJoinGroupId((currentGroupId) =>
          currentGroupId === groupId ? null : currentGroupId,
        );
      }
    },
    [
      accessToken,
      apiGroups,
      finalizeJoinedGroup,
      isJoining,
      joinedGroupIds,
      refreshToken,
      router,
      syncGroupsSnapshotFromApi,
      setTokens,
      showGuestState,
      tokenType,
    ],
  );

  const closeJoinModal = useCallback(() => {
    if (isJoining) return;
    setPendingJoinGroupId(null);
    setOverlay(null);
  }, [isJoining]);

  const handleJoinGroup = (groupId: string) => {
    setJoinError(null);
    setGroupActionMessage(null);
    setPendingJoinGroupId(groupId);
    setOverlay("confirm-join");
  };

  const handleConfirmJoin = async () => {
    if (!pendingJoinGroupId) return;
    await joinSelectedGroup(pendingJoinGroupId);
  };

  const handleShareGroup = async (groupId: string) => {
    setGroupActionMessage(null);
    clearTransientGroupActionMessage();

    try {
      const groupRecord = apiGroups.find((group) => group.id === groupId) ?? null;
      const groupTarget = groupRecord?.slug ?? groupRecord?.id ?? groupId;
      const shareLink = buildGroupShareLink(groupTarget);

      await copyTextToClipboard(shareLink);
      showTransientGroupActionMessage("Community link copied.");
    } catch (error) {
      setGroupActionMessage(
        extractApiErrorMessage(error, "Unable to copy the community link right now."),
      );
    }
  };

  const handleSendConversationMessage = async () => {
    const trimmedDraft = messageDraft.trim();
    const hasPendingGroupAttachments = pendingGroupAttachments.length > 0;
    clearTransientMessageActionMessage();

    if (activeSection === "groups" && !isMobileDirectMessageOpen) {
      if (
        (!trimmedDraft && !hasPendingGroupAttachments) ||
        !selectedGroupId ||
        !selectedApiGroup ||
        !selectedGroupJoined ||
        !accessToken ||
        isSendingMessage ||
        groupMessageSendInFlightRef.current
      ) {
        if (selectedGroupId && selectedApiGroup && !selectedGroupJoined) {
          setMessageActionError("Join this community before sending messages.");
          setGroupPanelMode("members-public");
          setMobileGroupsView("members");
        }
        return;
      }

      const queuedDraft = trimmedDraft;
      const queuedAttachments = pendingGroupAttachments;
      const queuedReplyMessage = pendingReplyMessage;
      const encodedDraft = queuedDraft
        ? buildReplyMessageContent(queuedDraft, queuedReplyMessage)
        : "";
      const currentUserMember =
        buildCurrentUserGroupMember(user) ??
        ({
          id: user?.id ?? "current-user",
          name: user?.name?.trim() || user?.email?.trim() || "You",
          description: "You",
          time: "Now",
          previewBio: "You are part of this community conversation.",
          avatar: "portrait-a" as const,
          avatarUrl: user?.avatarUrl?.trim() || null,
          initial: getSenderInitials(user?.name?.trim() || user?.email?.trim() || "You"),
          badgeColor: "#A6BA63",
          badgeTextColor: "#1D1D1B",
          email: user?.email?.trim() || null,
          isCurrentUser: true,
        } satisfies GroupChatMemberProfile);
      const optimisticMessages: GroupChatMessageRecord[] = [
        ...(queuedDraft
          ? [
              {
                id: `pending-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                senderId: currentUserMember.id,
                senderName: currentUserMember.name,
                text: queuedDraft,
                attachments: [],
                createdAt: new Date().toISOString(),
                replyTo: queuedReplyMessage,
                avatarInitial: currentUserMember.initial,
                avatarUrl: currentUserMember.avatarUrl ?? null,
                avatarColor: currentUserMember.badgeColor,
                avatarTextColor: currentUserMember.badgeTextColor,
                isCurrentUser: true,
                isPending: true,
              } satisfies GroupChatMessageRecord,
            ]
          : []),
        ...queuedAttachments.map((attachment, index) => ({
          id: `pending-file-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
          senderId: currentUserMember.id,
          senderName: currentUserMember.name,
          text: "",
          attachments: [
            {
              ...attachment,
              file: null,
            },
          ],
          createdAt: new Date().toISOString(),
          replyTo: null,
          avatarInitial: currentUserMember.initial,
          avatarUrl: currentUserMember.avatarUrl ?? null,
          avatarColor: currentUserMember.badgeColor,
          avatarTextColor: currentUserMember.badgeTextColor,
          isCurrentUser: true,
          isPending: true,
        })),
      ];
      groupMessageSendInFlightRef.current = true;
      setIsSendingMessage(true);
      setMessageActionError(null);
      setMessageDraft("");
      setPendingGroupAttachments([]);
      if (queuedDraft) {
        setPendingReplyMessage(null);
      }
      setGroupChatsById((currentChats) => {
        const existingChat =
          currentChats[selectedGroupId] ??
          createInitialGroupChatState(selectedApiGroup, user);
        const nextMembers = existingChat.members.some(
          (member) => member.isCurrentUser,
        )
          ? existingChat.members
          : [...existingChat.members, currentUserMember];
        const nextMessages = sortMessagesChronologically([
          ...existingChat.messages,
          ...optimisticMessages,
        ]);

        return {
          ...currentChats,
          [selectedGroupId]: {
            members: nextMembers,
            messages: nextMessages,
          },
        };
      });

      const sentMessages: ApiMessageRecord[] = [];
      const sentPendingAttachmentIds = new Set<string>();
      let sentTextDraft = false;
      const shouldReleaseGroupSendingStateEarly = !hasPendingGroupAttachments;

      try {
        if (shouldReleaseGroupSendingStateEarly) {
          setIsSendingMessage(false);
        }

        const liveConversation = await ensureGroupConversation(
          {
            id: selectedApiGroup.id,
            slug: selectedApiGroup.slug,
            name: selectedApiGroup.name,
            conversationId:
              groupConversationIdsByGroupId[selectedApiGroup.id] ??
              selectedApiGroup.conversationId ??
              null,
          },
          {
            accessToken,
            refreshToken,
            tokenType,
          },
          (tokens) => {
            setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
          },
        );

        setGroupConversationIdsByGroupId((currentConversationIds) => ({
          ...currentConversationIds,
          [selectedApiGroup.id]: liveConversation.id,
        }));

        if (hasPendingGroupAttachments) {
          const uploadedAttachments = await uploadMessageAttachments(
            queuedAttachments,
            {
              accessToken,
              refreshToken,
              tokenType,
            },
            (tokens) => {
              setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
            },
            {
              conversationId: liveConversation.id,
            },
          );

          for (const [attachmentIndex, uploadedAttachment] of uploadedAttachments.entries()) {
            const sentFileMessage = await sendConversationFileMessage(
              liveConversation.id,
              uploadedAttachment,
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
            );

            sentMessages.push(sentFileMessage);
            const originalAttachment = queuedAttachments[attachmentIndex];
            if (originalAttachment) {
              sentPendingAttachmentIds.add(originalAttachment.id);
            }
          }
        }

        if (queuedDraft) {
          const sentTextMessage = await sendConversationMessage(
            liveConversation.id,
            encodedDraft,
            [],
            {
              accessToken,
              refreshToken,
              tokenType,
            },
            (tokens) => {
              setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
            },
            {
              groupId: selectedApiGroup.id,
              groupSlug: selectedApiGroup.slug,
            },
          );

          sentMessages.push(sentTextMessage);
          sentTextDraft = true;
        }

        const senderProfiles = sentMessages.map((message) =>
          buildGroupMemberProfileFromApiMessage(message, user),
        );

        setGroupChatsById((currentChats) => {
          const existingChat =
            currentChats[selectedGroupId] ??
            createInitialGroupChatState(selectedApiGroup, user);

          const dedupedMembers = dedupeGroupMembers([
            ...existingChat.members,
            ...senderProfiles,
          ]);
          const optimisticMessageIds = new Set(optimisticMessages.map((message) => message.id));

          const nextMessages = sortMessagesChronologically([
            ...existingChat.messages.filter((message) => !optimisticMessageIds.has(message.id)),
            ...sentMessages.map((sentMessage) => {
              const senderProfile = buildGroupMemberProfileFromApiMessage(sentMessage, user);

              return {
                id: sentMessage.id,
                senderId: resolveGroupMessageSenderKey(sentMessage, senderProfile.name),
                senderName: senderProfile.name,
                text: sentMessage.text,
                attachments: sentMessage.attachments,
                createdAt: sentMessage.createdAt,
                replyTo: sentMessage.replyTo,
                avatarInitial: senderProfile.initial,
                avatarUrl: senderProfile.avatarUrl ?? null,
                avatarColor: senderProfile.badgeColor,
                avatarTextColor: senderProfile.badgeTextColor,
                isCurrentUser: true,
              } satisfies GroupChatMessageRecord;
            }),
          ]);

          return {
            ...currentChats,
            [selectedGroupId]: {
              members: dedupedMembers,
              messages: nextMessages,
            },
          };
        });
        setApiGroups((currentGroups) =>
          currentGroups.map((group) =>
            group.id === selectedGroupId
              ? {
                  ...group,
                  conversationId: liveConversation.id,
                  postCount: group.postCount + sentMessages.length,
                }
              : group,
          ),
        );
      } catch (error) {
        setGroupChatsById((currentChats) => {
          const existingChat = currentChats[selectedGroupId];
          if (!existingChat) return currentChats;

          const optimisticMessageIds = new Set(optimisticMessages.map((message) => message.id));
          const remainingMessages = existingChat.messages.filter((message) => {
            if (optimisticMessageIds.has(message.id)) {
              return false;
            }

            return !sentMessages.some((sentMessage) => sentMessage.id === message.id);
          });
          const recoveredMessages = sentMessages.map((sentMessage) => {
            const senderProfile = buildGroupMemberProfileFromApiMessage(sentMessage, user);

            return {
              id: sentMessage.id,
              senderId: resolveGroupMessageSenderKey(sentMessage, senderProfile.name),
              senderName: senderProfile.name,
              text: sentMessage.text,
              attachments: sentMessage.attachments,
              createdAt: sentMessage.createdAt,
              replyTo: sentMessage.replyTo,
              avatarInitial: senderProfile.initial,
              avatarUrl: senderProfile.avatarUrl ?? null,
              avatarColor: senderProfile.badgeColor,
              avatarTextColor: senderProfile.badgeTextColor,
              isCurrentUser: true,
            } satisfies GroupChatMessageRecord;
          });

          return {
            ...currentChats,
            [selectedGroupId]: {
              ...existingChat,
              messages: sortMessagesChronologically([
                ...remainingMessages,
                ...recoveredMessages,
              ]),
            },
          };
        });
        setMessageDraft(sentTextDraft ? "" : queuedDraft);
        if (!sentTextDraft) {
          setPendingReplyMessage(queuedReplyMessage);
        }
        setPendingGroupAttachments(
          queuedAttachments.filter(
            (attachment) => !sentPendingAttachmentIds.has(attachment.id),
          ),
        );
        setGroupActionMessage(
          extractApiErrorMessage(
            error,
            hasPendingGroupAttachments
              ? "Unable to upload this attachment right now."
              : "Unable to upload or send this group message right now.",
          ),
        );
        setMessageActionError(
          extractApiErrorMessage(
            error,
            hasPendingGroupAttachments
              ? "Unable to upload this attachment right now."
              : "Unable to send this group message right now.",
          ),
        );
      } finally {
        groupMessageSendInFlightRef.current = false;
        setIsSendingMessage(false);
      }

      return;
    }

    if (
      !trimmedDraft ||
      !selectedConversationId ||
      !accessToken ||
      isSendingMessage ||
      directMessageSendInFlightRef.current
    ) {
      return;
    }

    directMessageSendInFlightRef.current = true;
    setIsSendingMessage(true);
    setMessageActionError(null);

    const queuedConversationId = selectedConversationId;
    const queuedParticipantId = selectedConversationParticipantId;
    const queuedReplyMessage = pendingDirectReplyMessage;
    const queuedDraft = trimmedDraft;
    const queuedConversationPreview = selectedApiConversation?.preview ?? "No messages yet.";
    const queuedConversationLastMessageAt = selectedApiConversation?.lastMessageAt ?? null;
    const encodedDraft = buildReplyMessageContent(queuedDraft, queuedReplyMessage);
    const optimisticMessageId = `pending-direct-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const optimisticDirectMessage = {
      id: optimisticMessageId,
      text: queuedDraft,
      senderId: user?.id ?? "current-user",
      senderName: user?.name?.trim() || user?.email?.trim() || "You",
      senderEmail: user?.email?.trim() || null,
      createdAt: new Date().toISOString(),
      isOwn: true,
      attachments: [],
      replyTo: queuedReplyMessage,
    } satisfies ApiMessageRecord;
    const optimisticConversationMessages = sortMessagesChronologically([
      ...(directMessagesByConversationIdRef.current[queuedConversationId] ?? conversationMessages),
      optimisticDirectMessage,
    ]);
    const replaceOptimisticDirectMessage = (
      messages: ApiMessageRecord[],
      nextMessage: ApiMessageRecord | null,
    ) => {
      const messagesWithoutOptimisticEntry = messages.filter(
        (message) => message.id !== optimisticMessageId,
      );

      return sortMessagesChronologically(
        nextMessage
          ? [...messagesWithoutOptimisticEntry, nextMessage]
          : messagesWithoutOptimisticEntry,
      );
    };

    setConversationMessages(optimisticConversationMessages);
    void writeDirectConversationCache(
      queuedConversationId,
      optimisticConversationMessages,
    );
    setApiConversations((currentConversations) =>
      currentConversations.map((conversation) =>
        conversation.id === queuedConversationId
          ? {
              ...conversation,
              preview: queuedDraft || conversation.preview,
              lastMessageAt:
                optimisticDirectMessage.createdAt ?? conversation.lastMessageAt,
            }
          : conversation,
      ),
    );
    setMessageDraft("");
    setPendingDirectReplyMessage(null);
    setIsSendingMessage(false);

    void (async () => {
      let resolvedConversationId = queuedConversationId;

      try {
        let sentMessage: ApiMessageRecord;
        let resolvedConversation: ApiConversationRecord | null = null;

        console.debug("[directMessage.send] preparing request", {
          receiver_id: queuedParticipantId,
          conversation_id: queuedConversationId,
          content: encodedDraft,
        });

        if (isSyntheticDirectConversationId(queuedConversationId) && queuedParticipantId) {
          const directSendResult = await sendDirectMessage(
            queuedParticipantId,
            encodedDraft,
            {
              accessToken,
              refreshToken,
              tokenType,
            },
            (tokens) => {
              setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
            },
            {
              conversationId: queuedConversationId,
            },
          );
          sentMessage = directSendResult.message;
          resolvedConversation = directSendResult.conversation;
        } else {
          try {
            sentMessage = await sendConversationMessage(
              queuedConversationId,
              encodedDraft,
              [],
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
            );
          } catch (error) {
            if (!shouldUseDirectMessageFallback(error, queuedParticipantId)) {
              throw error;
            }

            const directSendResult = await sendDirectMessage(
              queuedParticipantId,
              encodedDraft,
              {
                accessToken,
                refreshToken,
                tokenType,
              },
              (tokens) => {
                setTokens(tokens.accessToken, tokens.refreshToken, tokens.tokenType);
              },
              {
                conversationId: queuedConversationId,
              },
            );
            sentMessage = directSendResult.message;
            resolvedConversation = directSendResult.conversation;
          }
        }

        if (resolvedConversation) {
          resolvedConversation = {
            ...resolvedConversation,
            preview: sentMessage.text || resolvedConversation.preview,
            lastMessageAt: sentMessage.createdAt ?? resolvedConversation.lastMessageAt,
            conversationType: resolvedConversation.conversationType ?? "direct",
            participantId:
              resolvedConversation.participantId ??
              queuedParticipantId ??
              selectedApiConversation?.participantId ??
              null,
            participantName:
              resolvedConversation.participantName ??
              selectedApiConversation?.participantName ??
              (selectedMemberName || conversationTitle),
          };
        }

        if (isSyntheticDirectConversationId(queuedConversationId)) {
          const fallbackTargetConversation = {
            ...(resolvedConversation ?? selectedApiConversation ?? {
              id: queuedConversationId,
              name: conversationTitle,
              preview: queuedConversationPreview,
              unreadCount: 0,
              lastMessageAt: queuedConversationLastMessageAt,
              conversationType: "direct",
              participantId: queuedParticipantId ?? null,
              participantName: selectedMemberName || conversationTitle,
              participants: [],
              groupId: null,
              groupSlug: null,
            }),
            preview:
              sentMessage.text ||
              resolvedConversation?.preview ||
              queuedConversationPreview,
            lastMessageAt:
              sentMessage.createdAt ??
              resolvedConversation?.lastMessageAt ??
              queuedConversationLastMessageAt,
            conversationType:
              resolvedConversation?.conversationType ??
              selectedApiConversation?.conversationType ??
              "direct",
            participantId:
              resolvedConversation?.participantId ??
              queuedParticipantId ??
              selectedApiConversation?.participantId ??
              null,
            participantName:
              resolvedConversation?.participantName ??
              selectedApiConversation?.participantName ??
              (selectedMemberName || conversationTitle),
            groupId: null,
            groupSlug: null,
          } satisfies ApiConversationRecord;

          if (!resolvedConversation || isSyntheticDirectConversationId(resolvedConversation.id)) {
            try {
              resolvedConversation = await resolveFreshDirectConversation(
                fallbackTargetConversation,
                queuedParticipantId,
              );
            } catch {
              resolvedConversation = resolvedConversation ?? null;
            }
          }

          if (resolvedConversation) {
            resolvedConversationId = resolvedConversation.id;
          }
        }

        const baseMessages =
          directMessagesByConversationIdRef.current[resolvedConversationId] ??
          directMessagesByConversationIdRef.current[queuedConversationId] ??
          optimisticConversationMessages;
        const nextMessages = replaceOptimisticDirectMessage(baseMessages, sentMessage);

        if (resolvedConversation && resolvedConversationId !== queuedConversationId) {
          void writeDirectConversationCache(queuedConversationId, nextMessages);
          remapDirectConversationState(
            queuedConversationId,
            resolvedConversation,
          );
        } else {
          void writeDirectConversationCache(resolvedConversationId, nextMessages);
        }
        if (
          selectedConversationIdRef.current === resolvedConversationId ||
          selectedConversationIdRef.current === queuedConversationId
        ) {
          setConversationMessages(nextMessages);
        }
        if (resolvedConversation && resolvedConversationId === queuedConversationId) {
          setApiConversations((currentConversations) =>
            currentConversations.map((conversation) =>
              conversation.id === queuedConversationId
                ? {
                    ...conversation,
                    ...resolvedConversation,
                    preview: sentMessage.text || resolvedConversation.preview,
                    lastMessageAt:
                      sentMessage.createdAt ?? resolvedConversation.lastMessageAt,
                  }
                : conversation,
            ),
          );
        } else if (!resolvedConversation || resolvedConversationId === queuedConversationId) {
          setApiConversations((currentConversations) =>
            currentConversations.map((conversation) =>
              conversation.id === queuedConversationId ||
              conversation.id === resolvedConversationId
                ? {
                    ...conversation,
                    preview: sentMessage.text || conversation.preview,
                    lastMessageAt: sentMessage.createdAt ?? conversation.lastMessageAt,
                  }
                : conversation,
            ),
          );
        }
      } catch (error) {
        const baseMessages =
          directMessagesByConversationIdRef.current[resolvedConversationId] ??
          directMessagesByConversationIdRef.current[queuedConversationId] ??
          optimisticConversationMessages;
        const nextMessages = replaceOptimisticDirectMessage(baseMessages, null);

        void writeDirectConversationCache(resolvedConversationId, nextMessages);
        if (resolvedConversationId !== queuedConversationId) {
          void writeDirectConversationCache(queuedConversationId, nextMessages);
        }
        if (
          selectedConversationIdRef.current === resolvedConversationId ||
          selectedConversationIdRef.current === queuedConversationId
        ) {
          setConversationMessages(nextMessages);
        }
        setApiConversations((currentConversations) =>
          currentConversations.map((conversation) =>
            conversation.id === queuedConversationId ||
            conversation.id === resolvedConversationId
              ? {
                  ...conversation,
                  preview: queuedConversationPreview,
                  lastMessageAt: queuedConversationLastMessageAt,
                }
              : conversation,
          ),
        );
        setMessageDraft((currentDraft) => currentDraft || queuedDraft);
        setPendingDirectReplyMessage((currentReply) => currentReply ?? queuedReplyMessage);
        setMessageActionError(
          extractApiErrorMessage(error, "Unable to send this message right now."),
        );
      } finally {
        directMessageSendInFlightRef.current = false;
        setIsSendingMessage(false);
      }
    })();
  };

  const handleUploadFilesSelected = (files: File[]) => {
    setMessageActionError(null);

    if (activeSection !== "groups" || !selectedGroupId) {
      setMessageActionError("File uploads are currently available in group chats only.");
      return;
    }

    const nextAttachments = files.map((file, index) => ({
      id: `attachment-${Date.now()}-${index}`,
      name: file.name,
      // Show the picked file straight away while the real upload runs in the
      // background. The upload flow uses `file`, not this URL, so the blob is
      // only ever used for the optimistic preview.
      url: typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : null,
      mimeType: file.type || null,
      file,
      uploadStatus: "local" as const,
    }));

    setPendingGroupAttachments((currentAttachments) => [
      ...currentAttachments,
      ...nextAttachments,
    ]);
  };

  const handleRemovePendingGroupAttachment = (attachmentId: string) => {
    setPendingGroupAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      resetPublicOnboarding();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
      setOverlay(null);
    }
  };

  const openMemberPreview = (member: MemberPreview) => {
    setSelectedMember(member);
    setOverlay("member-card");
  };

  const mobileConversationMessages = conversationMessages;

  const handleOpenDirectMessageFromGroup = (member: MemberPreview) => {
    if (PERSONAL_MESSAGES_DISABLED) {
      setSelectedMember(member);
      setOverlay("coming-soon");
      return;
    }

    openDirectConversationForMember(member);
  };

  const handleMobileBack = () => {
    if (overlay) {
      setOverlay(null);
      return;
    }

    if (isMobileDirectMessageOpen) {
      setIsMobileDirectMessageOpen(false);
      if (mobileDirectMessageOrigin === "discover") {
        setActiveSection("messages");
        setMobileMessagesView("discover");
      } else if (mobileDirectMessageOrigin === "messages") {
        setActiveSection("messages");
        setMobileMessagesView(showMessagesGuestState ? "restricted" : "list");
      } else {
        setActiveSection("groups");
        setMobileGroupsView(selectedGroupJoined ? "chat" : "members");
      }
      return;
    }

    if (activeSection === "messages") {
      if (mobileMessagesView === "discover") {
        if (didOpenDiscoverFromMessagesList) {
          setMobileMessagesView("list");
          setDidOpenDiscoverFromMessagesList(false);
          return;
        }
        setMobileMessagesView("list");
        return;
      }

      if (mobileMessagesView === "restricted" || mobileMessagesView === "list") {
        setActiveSection("groups");
        return;
      }
    }

    if (mobileGroupsView === "chat" || mobileGroupsView === "members") {
      setMobileGroupsView("list");
      setGroupPanelMode(selectedGroupJoined ? "chat" : "members-public");
      return;
    }

    if (mobileGroupsView === "restricted") {
      setMobileGroupsView("list");
      return;
    }

    if (activeSection === "groups" && mobileGroupsView === "list") {
      return;
    }

    router.back();
  };

  return (
    <>
      <MobileDashboardWorkspace
        activeSection={activeSection}
        onComposeStatus={() => setIsStatusComposerOpen(true)}
        onOpenStatus={handleOpenStatus}
        statusFeedRefreshKey={statusFeedRefreshKey}
        onStatusFeedLoaded={handleStatusFeedLoaded}
        showGuestState={showGuestState}
        visibleNavSection={
          overlay === "coming-soon"
            ? "profile"
            : isMobileDirectMessageOpen
            ? mobileDirectMessageOrigin === "groups"
              ? "groups"
              : "messages"
            : activeSection
        }
        selectedGroup={selectedGroup}
        selectedApiGroup={selectedApiGroup}
        dashboardGroups={restrictedOrderedSidebarGroups}
        groupMembers={selectedGroupChat.members}
        groupMessages={selectedGroupChat.messages}
        groupViewportKey={selectedGroupId ? `group:${selectedGroupId}` : null}
        groupUnreadAnchorMessageId={
          selectedGroupId ? groupUnreadAnchorMessageIds[selectedGroupId] ?? null : null
        }
        groupScrollTopCacheRef={groupScrollTopByIdRef}
        pendingGroupAttachments={pendingGroupAttachments}
        isGroupMessagesLoading={isGroupMessagesLoading}
        selectedGroupId={selectedGroupId}
        joinedGroupIds={joinedGroupIds}
        joinedCount={joinedCount}
        showJoinBanner={showJoinBanner}
        joinBannerMessage={joinBannerMessage}
        isSharedGroupPreview={isSharedGroupRestrictedPreview}
        canSearchGroups={canSearchGroups}
        groupsError={groupsError}
        isGroupsLoading={isGroupsLoading}
        sharingGroupId={sharingGroupId}
        groupActionMessage={visibleGroupActionMessage}
        groupScreen={mobileGroupsView}
        groupSearchQuery={groupSearchQuery}
        isGroupSearchOpen={isMobileGroupSearchOpen}
        dashboardConversations={dashboardConversations}
        selectedConversationId={selectedConversationId}
        conversationsError={conversationsError}
        isConversationsLoading={isConversationsLoading}
        messagesScreen={mobileMessagesView}
        showMessagesGuestState={showMessagesGuestState}
        discoverPeople={discoverPeople}
        discoverQuery={discoverQuery}
        conversationTitle={conversationTitle}
        directMessages={mobileConversationMessages}
        directViewportKey={selectedConversationId ? `direct:${selectedConversationId}` : null}
        directUnreadAnchorMessageId={
          selectedConversationId
            ? directUnreadAnchorMessageIds[selectedConversationId] ?? null
            : null
        }
        directScrollTopCacheRef={directScrollTopByIdRef}
        currentUserId={user?.id ?? null}
        currentUserEmail={user?.email ?? null}
        isMessagesLoading={isMessagesLoading}
        messagesError={messagesError}
        messageActionError={visibleMessageActionMessage}
        messageDraft={messageDraft}
        editingMessage={editingMessage}
        isSendingMessage={isSendingMessage}
        isDirectMessageOpen={isMobileDirectMessageOpen}
        onBack={handleMobileBack}
        onGroupsNav={handleGroupsNavigation}
        onMessagesNav={handleMessagesNavigation}
        onProfileNav={handleProfileNavigation}
        onGroupSearchToggle={handleMobileGroupSearchToggle}
        onGroupSearchOpen={handleOpenMobileGroupSearch}
        onGroupSearchQueryChange={setGroupSearchQuery}
        onSelectGroup={handleGroupSelection}
        onJoinGroup={handleJoinGroup}
        onShareGroup={handleShareGroup}
        onToggleMembers={handleMembersToggle}
        onSelectConversation={handleConversationSelection}
        onSelectDiscoverConversation={handleDiscoverConversationSelection}
        onDiscoverQueryChange={setDiscoverQuery}
        onOpenMemberPreview={openMemberPreview}
        onOpenDirectMessageFromGroup={handleOpenDirectMessageFromGroup}
        onMessageDraftChange={setMessageDraft}
        onSendMessage={handleSendConversationMessage}
        onAttachClick={() => handleOpenUploadModal("browse")}
        onRemovePendingGroupAttachment={handleRemovePendingGroupAttachment}
        pendingReplyMessage={pendingReplyMessage}
        pendingDirectReplyMessage={pendingDirectReplyMessage}
        onReplyToGroupMessage={handleReplyToGroupMessage}
        onReplyToDirectMessage={handleReplyToDirectMessage}
        onClearReplyMessage={handleClearReplyMessage}
        onClearDirectReplyMessage={handleClearDirectReplyMessage}
        onCancelEditingMessage={handleCancelEditingMessage}
      />

      <div className="hidden h-screen overflow-hidden bg-[#FCFAF8] md:block">
        <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#FFFCFA]">
          <DashboardRail
            activeSection={overlay === "coming-soon" ? "profile" : activeSection}
            unreadGroupsCount={unreadGroupsCount}
            unreadMessagesCount={unreadMessagesCount}
            onGroupsClick={handleGroupsNavigation}
            onMessagesClick={handleMessagesNavigation}
            onProfileClick={handleProfileNavigation}
          />

          <div className="flex min-h-0 w-[290px] flex-col border-r border-[#E9DBD3] bg-[#FCF8F6] xl:w-[330px]">
            <DashboardListHeader
              icon={
                activeSection === "groups" ? (
                  <GroupsHeaderIcon size={28} />
                ) : (
                  <MessageCircleMore className="h-7 w-7 text-[#6B452E]" />
                )
              }
              title={activeSection === "groups" ? "Cliques" : "Messages"}
              counter={desktopListHeaderCount}
              label={desktopListHeaderLabel}
            />

            {activeSection === "groups" ? (
              <div className="border-b border-[#E9DBD3]">
                <StatusStrip
                  onComposeStatus={() => setIsStatusComposerOpen(true)}
                  onOpenStatus={handleOpenStatus}
                  refreshKey={statusFeedRefreshKey}
                  onFeedLoaded={handleStatusFeedLoaded}
                />
              </div>
            ) : null}

            {activeSection === "groups" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {canSearchGroups && isDesktopGroupSearchOpen ? (
                  <div className="px-3 pb-1 pt-3 xl:px-4 xl:pt-4">
                    <GroupSearchField
                      value={groupSearchQuery}
                      onChange={setGroupSearchQuery}
                      placeholder="Search groups"
                    />
                  </div>
                ) : null}
                {groupsError ? (
                  <div className="border-b border-[#EEE1DA] bg-[#FFF5EE] px-6 py-4 text-[14px] font-semibold text-[#8B4B1E]">
                    {groupsError}
                  </div>
                ) : null}

                {showGuestState && !shouldUseDesktopSharedGroupSidebar ? (
                  <div className="px-6 py-8">
                    <p className="text-[16px] leading-7 text-[#7E6E66]">
                      Sign up or sign in to explore cliques. If someone shared a
                      clique with you, you can still preview it on the main panel.
                    </p>
                    <Link
                      href="/signup"
                      className="mt-5 inline-flex rounded-full bg-[#4F3422] px-5 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-[#442c1d]"
                    >
                      Create an account
                    </Link>
                  </div>
                ) : isGroupsLoading ? (
                  <DesktopGroupListSkeleton />
                ) : desktopSidebarGroups.length === 0 ? (
                  <div className="px-6 py-8 text-[16px] leading-7 text-[#7E6E66]">
                    {normalizedGroupSearchQuery
                      ? "No groups match your search yet."
                      : "No communities are available from the live API yet."}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {showJoinBanner ? (
                      <>
                        {joinedVisibleDashboardGroups.map((group) => {
                          const isJoined = joinedGroupIds.includes(group.id);

                          return (
                            <GroupListItem
                              key={group.id}
                              group={group}
                              isActive={selectedGroupId === group.id}
                              isJoined={isJoined}
                              onSelect={() => handleGroupSelection(group.id)}
                              onJoin={() => handleJoinGroup(group.id)}
                              onShare={() => handleShareGroup(group.id)}
                              isSharePending={sharingGroupId === group.id}
                            />
                          );
                        })}
                        {joinBannerMessage ? (
                          <div className="border-b border-[#EEE1DA] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#5C3A26]">
                            {joinBannerMessage}
                          </div>
                        ) : null}
                        {joinableVisibleDashboardGroups.map((group) => {
                          const isJoined = joinedGroupIds.includes(group.id);

                          return (
                            <GroupListItem
                              key={group.id}
                              group={group}
                              isActive={selectedGroupId === group.id}
                              isJoined={isJoined}
                              onSelect={() => handleGroupSelection(group.id)}
                              onJoin={() => handleJoinGroup(group.id)}
                              onShare={() => handleShareGroup(group.id)}
                              isSharePending={sharingGroupId === group.id}
                            />
                          );
                        })}
                      </>
                    ) : (
                      desktopSidebarGroups.map((group) => {
                        const isJoined = joinedGroupIds.includes(group.id);

                        return (
                          <GroupListItem
                            key={group.id}
                            group={group}
                            isActive={selectedGroupId === group.id}
                            isJoined={isJoined}
                            onSelect={() => handleGroupSelection(group.id)}
                            onJoin={() => handleJoinGroup(group.id)}
                            onShare={() => handleShareGroup(group.id)}
                            isSharePending={sharingGroupId === group.id}
                          />
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {conversationsError ? (
                  <div className="border-b border-[#EEE1DA] bg-[#FFF5EE] px-6 py-4 text-[14px] font-semibold text-[#8B4B1E]">
                    {conversationsError}
                  </div>
                ) : null}

                {isConversationsLoading ? (
                  <div className="px-6 py-8 text-[16px] font-semibold text-[#7E6E66]">
                    Loading conversations from the live API...
                  </div>
                ) : dashboardConversations.length === 0 ? (
                  <div className="px-6 py-8 text-[16px] leading-7 text-[#7E6E66]">
                    No conversations are available for this account yet.
                  </div>
                ) : (
                  dashboardConversations.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={selectedConversationId === conversation.id}
                      onClick={() => handleConversationSelection(conversation.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-white">
            <DashboardTopBar
              activeSection={activeSection}
              group={selectedGroupDisplay}
              groupDescription={selectedApiGroup?.description ?? null}
              conversationName={conversationTitle}
              unreadMessagesCount={unreadMessagesCount}
              isAdmin={isAdmin}
              isMembersView={
                groupPanelMode === "members-joined" ||
                groupPanelMode === "members-public"
              }
              isSearchActive={isDesktopGroupSearchOpen}
              disableGroupHeaderActions={isSharedGroupRestrictedPreview}
              onSearchClick={
                activeSection === "groups"
                  ? handleDesktopGroupSearchToggle
                  : undefined
              }
              onMembersClick={handleMembersToggle}
            />

            {visibleGroupActionMessage ? (
              <div className="border-b border-[#F0E5DF] bg-[#FFF5EE] px-6 py-3 text-[14px] font-semibold text-[#8B4B1E]">
                {visibleGroupActionMessage}
              </div>
            ) : null}
            {groupMessagesError &&
            activeSection === "groups" &&
            groupPanelMode === "chat" ? (
              <div className="border-b border-[#F0E5DF] bg-[#FFF9F5] px-6 py-3 text-[14px] font-semibold text-[#8B4B1E]">
                {groupMessagesError}
              </div>
            ) : null}

            {activeSection === "messages" ? (
              selectedConversation ? (
              <DirectMessagesPanel
                conversationName={selectedConversation?.name ?? "Messages"}
                messages={conversationMessages}
                isLoading={isMessagesLoading}
                error={messagesError}
                actionError={visibleMessageActionMessage}
                draft={messageDraft}
                onDraftChange={setMessageDraft}
                onSend={handleSendConversationMessage}
                isSending={isSendingMessage}
                currentUserId={user?.id ?? null}
                currentUserEmail={user?.email ?? null}
                onAttachClick={() => handleOpenUploadModal("browse")}
                pendingReplyMessage={pendingDirectReplyMessage}
                onReplyToMessage={handleReplyToDirectMessage}
                onClearReplyMessage={handleClearDirectReplyMessage}
                editingMessage={editingMessage?.source === "direct" ? editingMessage : null}
                onCancelEditingMessage={handleCancelEditingMessage}
                viewportKey={selectedConversationId ? `direct:${selectedConversationId}` : null}
                unreadAnchorMessageId={
                  selectedConversationId
                    ? directUnreadAnchorMessageIds[selectedConversationId] ?? null
                    : null
                }
                scrollTopCacheRef={directScrollTopByIdRef}
              />
              ) : (
                <EmptyMessagesPanel
                  title={
                    dashboardConversations.length > 0
                      ? "Choose a conversation"
                      : "No conversations yet"
                  }
                  description={
                    dashboardConversations.length > 0
                      ? "Open a chat from the messages list to start reading or replying."
                      : "No conversations are available for this account yet."
                  }
                />
              )
            ) : isGroupsLoading ? (
              <DesktopGroupPanelSkeleton />
            ) : !selectedGroup ? (
              <EmptyGroupsPanel
                title={
                  dashboardGroups.length > 0
                    ? "Choose a clique"
                    : "No communities yet"
                }
                description={
                  dashboardGroups.length > 0
                    ? "Pick any clique from the list to open its chat or member view."
                    : groupsError ??
                      "The live API returned an empty community list, so there is nothing to open yet."
                }
                adminLinkVisible={isAdmin}
              />
            ) : groupPanelMode === "restricted" ? (
              showGuestState && isSharedGroupRestrictedPreview ? (
                <SharedGroupDesktopRestrictionPanel
                  groupName={selectedGroup.headerTitle}
                  signupHref={`/signup?group=${encodeURIComponent(selectedGroupRouteKey)}`}
                />
              ) : isSharedGroupRestrictedPreview ? (
                <SharedGroupPreviewPanel
                  group={selectedGroup}
                  onJoin={() => handleJoinGroup(selectedGroup.id)}
                />
              ) : (
                <GuestRestrictionPanel />
              )
            ) : groupPanelMode === "chat" ? (
              <GroupChatPanel
                messages={selectedGroupChat.messages}
                members={selectedGroupChat.members}
                isLoading={isGroupMessagesLoading}
                actionError={visibleMessageActionMessage}
                draft={messageDraft}
                pendingAttachments={pendingGroupAttachments}
                isSending={isSendingMessage}
                onDraftChange={setMessageDraft}
                onSubmit={handleSendConversationMessage}
                onAttachClick={() => handleOpenUploadModal("drag")}
                onRemovePendingAttachment={handleRemovePendingGroupAttachment}
                onOpenMemberPreview={openMemberPreview}
                pendingReplyMessage={pendingReplyMessage}
                onReplyToMessage={handleReplyToGroupMessage}
                onClearReplyMessage={handleClearReplyMessage}
                editingMessage={editingMessage?.source === "group" ? editingMessage : null}
                onCancelEditingMessage={handleCancelEditingMessage}
                viewportKey={selectedGroupId ? `group:${selectedGroupId}` : null}
                unreadAnchorMessageId={
                  selectedGroupId ? groupUnreadAnchorMessageIds[selectedGroupId] ?? null : null
                }
                scrollTopCacheRef={groupScrollTopByIdRef}
                enableDropUpload={false}
              />
            ) : (
              <GroupMembersPanel
                members={selectedGroupChat.members}
                publicView={groupPanelMode === "members-public"}
                onOpenMemberPreview={openMemberPreview}
                onOpenDirectMessageFromGroup={handleOpenDirectMessageFromGroup}
              />
            )}
          </div>
        </div>
      </div>

      {/* File upload modal */}
      <ChatUploadModal
        isOpen={isUploadModalOpen}
        mode={uploadMode}
        onClose={() => setIsUploadModalOpen(false)}
        onModeChange={setUploadMode}
        onFilesSelected={handleUploadFilesSelected}
        allowDragDrop={isDesktopUploadViewport}
      />

      <Modal
        isOpen={overlay === "coming-soon"}
        onClose={() => setOverlay(null)}
        overlayClassName="bg-[#2D1A10]/55"
        className="max-w-[360px] rounded-[34px] bg-white px-5 py-5"
      >
        <div className="rounded-[28px] bg-[#FCF8F6] px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-[62px] w-[62px] items-center justify-center overflow-hidden rounded-full bg-[#F3D8B2]">
              <SelfPortraitAvatar />
            </div>
            <div className="min-w-0">
              <p className="break-all text-[22px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#5C3A26]">
                {user?.name ?? user?.email ?? "Your account"}
              </p>
              <p className="mt-2 break-words text-[14px] font-semibold text-[#7E6E66]">
                {COMING_SOON_NOTE}
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <p className="rounded-[22px] bg-white px-4 py-4 text-[15px] font-semibold leading-6 text-[#786E68]">
              {PROFILE_COMING_SOON_DESCRIPTION}
            </p>
            {/*
            <Link
              href="/profile"
              onClick={() => setOverlay(null)}
              className="flex items-center justify-center rounded-full border border-[#D9C6BA] bg-white px-5 py-4 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[#6A4227] transition-colors hover:bg-[#F7EFEA]"
            >
              View Profile
            </Link>
            <Link
              href="/setup-profile"
              onClick={() => setOverlay(null)}
              className="flex items-center justify-center rounded-full border border-[#D9C6BA] bg-white px-5 py-4 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[#6A4227] transition-colors hover:bg-[#F7EFEA]"
            >
              Edit Profile
            </Link>
            */}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#6A4227] px-5 py-4 text-[15px] font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#5E3A22] disabled:opacity-60"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {isLoggingOut ? "Signing Out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={overlay === "member-card"}
        onClose={() => setOverlay(null)}
        className="max-w-[360px] rounded-[34px] bg-white px-4 py-4 xl:max-w-[420px]"
      >
        <div className="overflow-hidden rounded-[28px]">
          <div className="flex h-[170px] items-center justify-center overflow-hidden rounded-[24px] bg-[#F68616] text-[38px] font-extrabold text-black sm:h-[190px] sm:text-[42px] xl:h-[250px] xl:rounded-[28px] xl:text-[54px]">
            {selectedMember.avatarUrl ? (
              <Image
                src={selectedMember.avatarUrl}
                alt={selectedMember.name}
                fill
                sizes="420px"
                className="object-cover"
              />
            ) : (
              selectedMember.initial
            )}
          </div>
          <div className="px-2 pb-1 pt-5 xl:pt-7">
            <h3 className="break-all text-[18px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#5C3A26] sm:text-[20px] xl:text-[28px]">
              {selectedMember.name}
            </h3>
            <p className="mt-3 break-words text-[15px] leading-[1.55] text-[#6B5B54] sm:text-[16px] xl:mt-4 xl:text-[18px]">
              {selectedMember.bio}
            </p>
          </div>
          <div className="mt-6 px-0 pb-1 xl:mt-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleOpenDirectMessageFromGroup(selectedMember)}
                disabled={selectedMember.isCurrentUser}
                className="flex items-center justify-center gap-3 rounded-full bg-[#6A4227] px-5 py-4 text-[15px] font-extrabold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#5E3A22] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircleMore className="h-5 w-5" />
                Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverlay(null);
                  router.push(
                    selectedMember.isCurrentUser
                      ? "/profile"
                      : buildMemberProfileHref(selectedMember),
                  );
                }}
                className="flex items-center justify-center gap-3 rounded-full border border-[#D9C6BA] bg-white px-5 py-4 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[#6A4227] transition-colors hover:bg-[#F7EFEA]"
              >
                <UserRound className="h-5 w-5" />
                Profile
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOverlay(null)}
              className="mt-4 w-full rounded-full border border-[#D9C6BA] bg-white px-6 py-3 text-[15px] font-extrabold text-[#6A4227] transition-colors hover:bg-[#F7EFEA] xl:py-4 xl:text-[16px]"
            >
              Cancel
            </button>
            {/*
            <button
              type="button"
              onClick={() => {
                if (isMobileDirectMessageOpen) {
                  setSelectedConversationId(
                    MOBILE_FALLBACK_CONVERSATIONS[0]?.id ?? "",
                  );
                  setIsMobileDirectMessageOpen(true);
                  setActiveSection(
                    mobileDirectMessageOrigin === "groups"
                      ? "groups"
                      : "messages",
                  );
                  if (mobileDirectMessageOrigin === "discover") {
                    setMobileMessagesView("discover");
                  }
                } else if (activeSection === "messages") {
                  setSelectedConversationId(
                    MOBILE_FALLBACK_CONVERSATIONS[0]?.id ?? "",
                  );
                  setMobileDirectMessageOrigin(
                    mobileMessagesView === "discover" ? "discover" : "messages",
                  );
                  setIsMobileDirectMessageOpen(true);
                  setActiveSection("messages");
                  setMobileMessagesView(
                    showMessagesGuestState
                      ? "restricted"
                      : mobileMessagesView === "discover"
                        ? "discover"
                        : "list",
                  );
                } else {
                  handleOpenDirectMessageFromGroup(selectedMember);
                }
                setOverlay(null);
              }}
              className="flex-1 rounded-full bg-[#6A4227] px-6 py-4 text-[16px] font-extrabold text-white"
            >
              <span className="flex items-center justify-center gap-3">
                Message <MessageCircleMore className="h-5 w-5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOverlay(null);
                router.push("/profile");
              }}
              className="flex-1 rounded-full border border-[#8E6A57] bg-white px-6 py-4 text-[16px] font-extrabold text-[#6A4227]"
            >
              <span className="flex items-center justify-center gap-3">
                Profile <UserRound className="h-5 w-5" />
              </span>
            </button>
            */}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={overlay === "confirm-join"}
        onClose={closeJoinModal}
        overlayClassName="bg-[#2D1A10]/55"
        className="max-w-[342px] rounded-[34px] bg-white px-5 py-5"
      >
        <div className="rounded-[28px]">
          <div className="mx-auto flex w-full justify-center">
            <div className="relative w-full overflow-hidden rounded-[24px] aspect-[311/248]">
              <Image
                src="/group_adds.svg"
                alt="Join group illustration"
                fill
                sizes="(max-width: 342px) 100vw, 302px"
                className="object-cover object-center"
              />
            </div>
          </div>
          <h3 className="mt-6 text-center text-[27px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
            Join This Clique?
          </h3>
          <p className="mt-5 text-[18px] leading-[1.55] text-[#6B5B54]">
            This will use one of your 3 clique slots. Do you want to cancel or join this clique now?
          </p>
          {joinError ? (
            <p className="mt-5 rounded-[20px] bg-[#FFF2EA] px-4 py-3 text-[15px] font-semibold leading-6 text-[#A4501A]">
              {joinError}
            </p>
          ) : null}
          <div className="mt-9 flex gap-3">
            <button
              onClick={closeJoinModal}
              disabled={isJoining}
              className="flex-1 rounded-full border border-[#8E6A57] bg-white px-6 py-4 text-[16px] font-extrabold text-[#A61B26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center justify-center gap-2">
                Cancel <X className="h-5 w-5" />
              </span>
            </button>
            <button
              onClick={handleConfirmJoin}
              disabled={isJoining}
              className="flex-1 rounded-full bg-[#6A4227] px-6 py-4 text-[16px] font-extrabold text-white"
            >
              <span className="flex items-center justify-center gap-2">
                {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {isJoining ? "Joining..." : "Join"}
                {!isJoining ? <ArrowRight className="h-5 w-5" strokeWidth={2.4} /> : null}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {openStatusEntry ? (
        <StatusViewer
          statuses={openStatusAuthorStatuses}
          authorName={openStatusEntry.authorName}
          authorAvatarUrl={openStatusEntry.authorAvatarUrl}
          onClose={handleCloseStatusViewer}
          onStatusDeleted={handleStatusDeleted}
        />
      ) : null}

      {isStatusComposerOpen ? (
        <StatusComposer
          onClose={() => setIsStatusComposerOpen(false)}
          onPosted={handleStatusPosted}
        />
      ) : null}
    </>
  );
}

function resolveGroupsPanel({
  isGuest,
  joinedGroupIds,
  groupId,
}: {
  isGuest: boolean;
  joinedGroupIds: string[];
  groupId: string;
}): GroupPanelMode {
  if (isGuest) return "restricted";
  return joinedGroupIds.includes(groupId) ? "chat" : "members-public";
}

function MobileDashboardWorkspace({
  activeSection,
  onComposeStatus,
  onOpenStatus,
  statusFeedRefreshKey,
  onStatusFeedLoaded,
  showGuestState,
  visibleNavSection,
  selectedGroup,
  selectedApiGroup,
  dashboardGroups,
  groupMembers,
  groupMessages,
  groupViewportKey,
  groupUnreadAnchorMessageId,
  groupScrollTopCacheRef,
  pendingGroupAttachments,
  pendingReplyMessage,
  isGroupMessagesLoading,
  selectedGroupId,
  joinedGroupIds,
  joinedCount,
  showJoinBanner,
  joinBannerMessage,
  isSharedGroupPreview,
  canSearchGroups,
  groupsError,
  isGroupsLoading,
  sharingGroupId,
  groupActionMessage,
  groupScreen,
  groupSearchQuery,
  isGroupSearchOpen,
  dashboardConversations,
  selectedConversationId,
  conversationsError,
  isConversationsLoading,
  messagesScreen,
  showMessagesGuestState,
  discoverPeople,
  discoverQuery,
  conversationTitle,
  directMessages,
  directViewportKey,
  directUnreadAnchorMessageId,
  directScrollTopCacheRef,
  currentUserId,
  currentUserEmail,
  isMessagesLoading,
  messagesError,
  messageActionError,
  messageDraft,
  editingMessage,
  isSendingMessage,
  isDirectMessageOpen,
  onBack,
  onGroupsNav,
  onMessagesNav,
  onProfileNav,
  onGroupSearchToggle,
  onGroupSearchOpen,
  onGroupSearchQueryChange,
  onSelectGroup,
  onJoinGroup,
  onShareGroup,
  onToggleMembers,
  onSelectConversation,
  onSelectDiscoverConversation,
  onDiscoverQueryChange,
  onOpenMemberPreview,
  onOpenDirectMessageFromGroup,
  onMessageDraftChange,
  onSendMessage,
  onAttachClick,
  onRemovePendingGroupAttachment,
  onReplyToGroupMessage,
  pendingDirectReplyMessage,
  onReplyToDirectMessage,
  onClearReplyMessage,
  onClearDirectReplyMessage,
  onCancelEditingMessage,
}: {
  activeSection: DashboardSection;
  onComposeStatus: () => void;
  onOpenStatus: (entry: StatusStripEntry) => void;
  statusFeedRefreshKey: number;
  onStatusFeedLoaded: (feed: ApiStatusRecord[]) => void;
  showGuestState: boolean;
  visibleNavSection: DashboardSection | "profile";
  selectedGroup: GroupRecord | null;
  selectedApiGroup: ApiGroupRecord | null;
  dashboardGroups: GroupRecord[];
  groupMembers: GroupChatMemberProfile[];
  groupMessages: GroupChatMessageRecord[];
  groupViewportKey: string | null;
  groupUnreadAnchorMessageId: string | null;
  groupScrollTopCacheRef: { current: Record<string, number> };
  pendingGroupAttachments: ApiAttachmentRecord[];
  pendingReplyMessage: ApiMessageReplyRecord | null;
  isGroupMessagesLoading: boolean;
  selectedGroupId: string;
  joinedGroupIds: string[];
  joinedCount: number;
  showJoinBanner: boolean;
  joinBannerMessage: string | null;
  isSharedGroupPreview: boolean;
  canSearchGroups: boolean;
  groupsError: string | null;
  isGroupsLoading: boolean;
  sharingGroupId: string | null;
  groupActionMessage: string | null;
  groupScreen: MobileGroupsView;
  groupSearchQuery: string;
  isGroupSearchOpen: boolean;
  dashboardConversations: ConversationRecord[];
  selectedConversationId: string;
  conversationsError: string | null;
  isConversationsLoading: boolean;
  messagesScreen: MobileMessagesView;
  showMessagesGuestState: boolean;
  discoverPeople: MobileDiscoverPerson[];
  discoverQuery: string;
  conversationTitle: string;
  directMessages: ApiMessageRecord[];
  directViewportKey: string | null;
  directUnreadAnchorMessageId: string | null;
  directScrollTopCacheRef: { current: Record<string, number> };
  currentUserId: string | null;
  currentUserEmail: string | null;
  pendingDirectReplyMessage: ApiMessageReplyRecord | null;
  isMessagesLoading: boolean;
  messagesError: string | null;
  messageActionError: string | null;
  messageDraft: string;
  editingMessage: EditingMessageDraft | null;
  isSendingMessage: boolean;
  isDirectMessageOpen: boolean;
  onBack: () => void;
  onGroupsNav: () => void;
  onMessagesNav: () => void;
  onProfileNav: () => void;
  onGroupSearchToggle: () => void;
  onGroupSearchOpen: () => void;
  onGroupSearchQueryChange: (value: string) => void;
  onSelectGroup: (groupId: string) => void;
  onJoinGroup: (groupId: string) => void;
  onShareGroup: (groupId: string) => void;
  onToggleMembers: () => void;
  onSelectConversation: (conversationId: string) => void;
  onSelectDiscoverConversation: (conversationId: string) => void;
  onDiscoverQueryChange: (value: string) => void;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onOpenDirectMessageFromGroup: (member: MemberPreview) => void;
  onMessageDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onAttachClick: () => void;
  onRemovePendingGroupAttachment: (attachmentId: string) => void;
  onReplyToGroupMessage: (message: GroupChatMessageRecord) => void;
  onReplyToDirectMessage: (message: ApiMessageRecord) => void;
  onClearReplyMessage: () => void;
  onClearDirectReplyMessage: () => void;
  onCancelEditingMessage: () => void;
}) {
  const selectedGroupJoined = joinedGroupIds.includes(selectedGroupId);
  const currentGroup = selectedGroup ?? null;
  const normalizedDiscoverQuery = discoverQuery.trim().toLowerCase();
  const normalizedGroupSearchQuery = groupSearchQuery.trim().toLowerCase();
  const joinedDashboardGroups = dashboardGroups.filter((group) =>
    joinedGroupIds.includes(group.id),
  );
  const joinableDashboardGroups = dashboardGroups.filter(
    (group) => !joinedGroupIds.includes(group.id),
  );
  const orderedDashboardGroups =
    normalizedGroupSearchQuery || joinedDashboardGroups.length === 0
      ? dashboardGroups
      : [...joinedDashboardGroups, ...joinableDashboardGroups];
  const filteredDiscoverPeople = discoverPeople.filter((person) => {
    if (!normalizedDiscoverQuery) return true;

    const searchTarget = `${person.name} ${person.subtitle}`.toLowerCase();
    return searchTarget.includes(normalizedDiscoverQuery);
  });
  const currentGroupTitle =
    currentGroup?.headerTitle ?? selectedApiGroup?.name ?? "Cliques";
  const currentGroupTitleColor =
    groupScreen === "chat" || groupScreen === "restricted"
      ? currentGroup?.accent ?? "#9BB168"
      : selectedGroupJoined
        ? currentGroup?.accent ?? "#9BB168"
        : "#5C3A26";
  const shouldShowGroupHeaderActions =
    activeSection === "groups" && groupScreen !== "list";
  const disableGroupHeaderActions =
    activeSection === "groups" &&
    (isSharedGroupPreview || !canSearchGroups) &&
    !selectedGroupJoined;

  return (
    <div className="h-screen overflow-hidden bg-[#FBF7F3] text-[#5C3A26] md:hidden">
      <div className="flex h-screen min-h-0 w-full flex-col overflow-hidden bg-[#FBF7F3]">
        {isDirectMessageOpen ? (
          <>
            <MobileTopBar
              title={conversationTitle}
              onBack={onBack}
              accentColor="#5C3A26"
              showSearchButton={false}
            />
            <MobileDirectMessagesPanel
              conversationTitle={conversationTitle}
              messages={directMessages}
              viewportKey={directViewportKey}
              unreadAnchorMessageId={directUnreadAnchorMessageId}
              scrollTopCacheRef={directScrollTopCacheRef}
              currentUserId={currentUserId}
              currentUserEmail={currentUserEmail}
              isLoading={isMessagesLoading}
              error={messagesError}
              actionError={messageActionError}
              draft={messageDraft}
              onDraftChange={onMessageDraftChange}
              onSubmit={onSendMessage}
              isSending={isSendingMessage}
              onAttachClick={onAttachClick}
              pendingReplyMessage={pendingDirectReplyMessage}
              onReplyToMessage={onReplyToDirectMessage}
              onClearReplyMessage={onClearDirectReplyMessage}
              editingMessage={editingMessage?.source === "direct" ? editingMessage : null}
              onCancelEditingMessage={onCancelEditingMessage}
            />
          </>
        ) : activeSection === "messages" ? (
          messagesScreen === "restricted" || showMessagesGuestState ? (
            <>
              <MobileBackOnlyBar onBack={onBack} showTrailingSearch={false} hideBackButton />
              <MobileRestrictedPanel
                description="Messages are only available to logged-in users. Sign up or log in to message"
              />
            </>
          ) : messagesScreen === "discover" ? (
            <>
              <MobileBackOnlyBar onBack={onBack} showTrailingSearch={false} />
              <div className="px-6 pb-6 pt-12">
                <h2 className="text-[60px] font-extrabold leading-none tracking-[-0.06em] text-[#5C3A26]">
                  Discover
                </h2>
                <MobileDiscoverSearchField
                  value={discoverQuery}
                  onChange={onDiscoverQueryChange}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(132px+env(safe-area-inset-bottom))]">
                {conversationsError ? (
                  <InlineNotice>{conversationsError}</InlineNotice>
                ) : null}
                {isConversationsLoading ? (
                  <InlineStateMessage>
                    Loading people from the live API...
                  </InlineStateMessage>
                ) : filteredDiscoverPeople.length === 0 ? (
                  <InlineStateMessage>
                    No people match your search yet.
                  </InlineStateMessage>
                ) : (
                  <div className="space-y-2">
                    {filteredDiscoverPeople.map((person) => (
                      <MobileDiscoverPersonCard
                        key={person.id}
                        person={person}
                        onChat={() =>
                          onSelectDiscoverConversation(person.conversationId)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <MobileBackOnlyBar onBack={onBack} showTrailingSearch={false} />
              <MobileSectionHeader
                icon={<MessageCircleMore className="h-5 w-5 text-[#5C3A26]" />}
                title="Messages"
                count={dashboardConversations.length}
                label="PERSONAL CONVERSATIONS"
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-[calc(132px+env(safe-area-inset-bottom))]">
                {conversationsError ? (
                  <InlineNotice>{conversationsError}</InlineNotice>
                ) : null}
                {isConversationsLoading ? (
                  <InlineStateMessage>
                    Loading conversations from the live API...
                  </InlineStateMessage>
                ) : dashboardConversations.length === 0 ? (
                  <InlineStateMessage>
                    No conversations are available for this account yet.
                  </InlineStateMessage>
                ) : (
                  <div className="space-y-2">
                    {dashboardConversations.map((conversation) => (
                      <MobileConversationCard
                        key={conversation.id}
                        conversation={conversation}
                        isActive={selectedConversationId === conversation.id}
                        onClick={() => onSelectConversation(conversation.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        ) : (
          <>
            {groupScreen === "list" ? (
              <>
                <MobileBackOnlyBar
                  onBack={onBack}
                  searchActive={isGroupSearchOpen}
                  onSearchClick={onGroupSearchToggle}
                  disableTrailingSearch={!canSearchGroups}
                  hideBackButton
                />
                {canSearchGroups && isGroupSearchOpen ? (
                  <div className="px-6 pb-2 pt-4">
                    <GroupSearchField
                      value={groupSearchQuery}
                      onChange={onGroupSearchQueryChange}
                      placeholder="Search groups"
                    />
                  </div>
                ) : null}
                <MobileSectionHeader
                  icon={<GroupsHeaderIcon size={20} />}
                  title="Cliques"
                  count={
                    normalizedGroupSearchQuery ? dashboardGroups.length : joinedCount
                  }
                  label={normalizedGroupSearchQuery ? "SEARCH RESULTS" : "JOINED"}
                />
                <div className="border-b border-[#E9DBD3] px-2">
                  <StatusStrip
                    onComposeStatus={onComposeStatus}
                    onOpenStatus={onOpenStatus}
                    refreshKey={statusFeedRefreshKey}
                    onFeedLoaded={onStatusFeedLoaded}
                  />
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-[calc(156px+env(safe-area-inset-bottom))]"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {groupsError ? <InlineNotice>{groupsError}</InlineNotice> : null}
                  {groupActionMessage ? (
                    <div className={groupsError ? "mt-4" : ""}>
                      <InlineNotice>{groupActionMessage}</InlineNotice>
                    </div>
                  ) : null}
                  {showGuestState ? (
                    <InlineStateMessage>
                      Sign up or sign in to explore cliques. Shared clique links
                      can still open a preview here.
                    </InlineStateMessage>
                  ) : isGroupsLoading ? (
                    <MobileGroupListSkeleton />
                  ) : dashboardGroups.length === 0 ? (
                    <InlineStateMessage>
                      {normalizedGroupSearchQuery
                        ? "No groups match your search yet."
                        : "No communities are available from the live API yet."}
                    </InlineStateMessage>
                  ) : (
                    <div className="space-y-3 pb-6">
                      {showJoinBanner ? (
                        <>
                          {joinedDashboardGroups.map((group) => {
                            const isJoined = joinedGroupIds.includes(group.id);

                            return (
                              <MobileGroupCard
                                key={group.id}
                                group={group}
                                isActive={selectedGroupId === group.id}
                                isJoined={isJoined}
                                onSelect={() => onSelectGroup(group.id)}
                                onJoin={() => onJoinGroup(group.id)}
                                onShare={() => onShareGroup(group.id)}
                                isSharePending={sharingGroupId === group.id}
                              />
                            );
                          })}
                          {joinBannerMessage ? (
                            <p className="px-3 pb-3 pt-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#5C3A26]">
                              {joinBannerMessage}
                            </p>
                          ) : null}
                          {joinableDashboardGroups.map((group) => {
                            const isJoined = joinedGroupIds.includes(group.id);

                            return (
                              <MobileGroupCard
                                key={group.id}
                                group={group}
                                isActive={selectedGroupId === group.id}
                                isJoined={isJoined}
                                onSelect={() => onSelectGroup(group.id)}
                                onJoin={() => onJoinGroup(group.id)}
                                onShare={() => onShareGroup(group.id)}
                                isSharePending={sharingGroupId === group.id}
                              />
                            );
                          })}
                        </>
                      ) : (
                        orderedDashboardGroups.map((group) => {
                          const isJoined = joinedGroupIds.includes(group.id);

                          return (
                            <MobileGroupCard
                              key={group.id}
                              group={group}
                              isActive={selectedGroupId === group.id}
                              isJoined={isJoined}
                              onSelect={() => onSelectGroup(group.id)}
                              onJoin={() => onJoinGroup(group.id)}
                              onShare={() => onShareGroup(group.id)}
                              isSharePending={sharingGroupId === group.id}
                            />
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <MobileTopBar
                  title={currentGroupTitle}
                  onBack={onBack}
                  accentColor={currentGroupTitleColor}
                  showSearchButton={canSearchGroups}
                  onSearchClick={onGroupSearchOpen}
                  disableSearchButton={disableGroupHeaderActions}
                  showTrailingLogo={shouldShowGroupHeaderActions}
                  trailingLogoActive={groupScreen === "members"}
                  disableTrailingLogo={disableGroupHeaderActions}
                  onTrailingLogoClick={onToggleMembers}
                />
                {groupActionMessage ? (
                  <div className="px-6 pt-4">
                    <InlineNotice>{groupActionMessage}</InlineNotice>
                  </div>
                ) : null}
                {groupScreen === "chat" ? (
                  <MobileGroupChatPanel
                    messages={groupMessages}
                    members={groupMembers}
                    viewportKey={groupViewportKey}
                    unreadAnchorMessageId={groupUnreadAnchorMessageId}
                    scrollTopCacheRef={groupScrollTopCacheRef}
                    isLoading={isGroupMessagesLoading}
                    actionError={messageActionError}
                    draft={messageDraft}
                    pendingAttachments={pendingGroupAttachments}
                    pendingReplyMessage={pendingReplyMessage}
                    isSending={isSendingMessage}
                    onDraftChange={onMessageDraftChange}
                    onSubmit={onSendMessage}
                    onRemovePendingAttachment={onRemovePendingGroupAttachment}
                    onOpenMemberPreview={onOpenMemberPreview}
                    onAttachClick={onAttachClick}
                    onReplyToMessage={onReplyToGroupMessage}
                    onClearReplyMessage={onClearReplyMessage}
                    editingMessage={editingMessage?.source === "group" ? editingMessage : null}
                    onCancelEditingMessage={onCancelEditingMessage}
                  />
                ) : groupScreen === "members" ? (
                  isSharedGroupPreview ? (
                    currentGroup ? (
                      <MobileSharedGroupPreviewPanel
                        group={currentGroup}
                        onJoin={() => onJoinGroup(currentGroup.id)}
                      />
                    ) : null
                  ) : (
                    <MobileMembersPanel
                      members={groupMembers}
                      publicView={!selectedGroupJoined}
                      onOpenMemberPreview={onOpenMemberPreview}
                      onOpenDirectMessageFromGroup={onOpenDirectMessageFromGroup}
                    />
                  )
                ) : (
                  isSharedGroupPreview && currentGroup ? (
                    <MobileSharedGroupPreviewPanel
                      group={currentGroup}
                      onJoin={() => onJoinGroup(currentGroup.id)}
                    />
                  ) : (
                    <MobileRestrictedPanel
                      description="Group chats are only available to logged-in users. Sign up or log in to join the conversation"
                    />
                  )
                )}
              </>
            )}
          </>
        )}

        <MobileBottomNavigation
          activeSection={visibleNavSection}
          onGroupsClick={onGroupsNav}
          onMessagesClick={onMessagesNav}
          onProfileClick={onProfileNav}
        />
      </div>
    </div>
  );
}

function MobileBackOnlyBar({
  onBack,
  showTrailingSearch = true,
  searchActive = false,
  disableTrailingSearch = false,
  onSearchClick,
  hideBackButton = false,
}: {
  onBack: () => void;
  showTrailingSearch?: boolean;
  searchActive?: boolean;
  disableTrailingSearch?: boolean;
  onSearchClick?: () => void;
  hideBackButton?: boolean;
}) {
  return (
    <div className="shrink-0 rounded-b-[34px] bg-white px-6 pb-6 pt-5 shadow-[0_20px_40px_rgba(93,63,43,0.12)]">
      <div className="flex items-center justify-between">
        {hideBackButton ? (
          <div className="h-[54px]" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-4 text-[#5C3A26]"
          >
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#F5F0EB]">
              <span className="text-[30px] leading-none">‹</span>
            </span>
            <span className="text-[24px] font-extrabold tracking-[-0.04em]">
              Back
            </span>
          </button>
        )}
        {showTrailingSearch ? (
          <MobileIconCircle
            active={searchActive}
            disabled={disableTrailingSearch}
            onClick={onSearchClick}
          >
            <Search className="h-8 w-8 text-current" strokeWidth={2} />
          </MobileIconCircle>
        ) : (
          <div className="h-[54px] w-[54px]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function MobileTopBar({
  title,
  onBack,
  accentColor,
  showSearchButton = true,
  disableSearchButton = false,
  isSearchActive = false,
  onSearchClick,
  showTrailingLogo = false,
  trailingLogoActive = false,
  disableTrailingLogo = false,
  onTrailingLogoClick,
}: {
  title: string;
  onBack: () => void;
  accentColor: string;
  showSearchButton?: boolean;
  disableSearchButton?: boolean;
  isSearchActive?: boolean;
  onSearchClick?: () => void;
  showTrailingLogo?: boolean;
  trailingLogoActive?: boolean;
  disableTrailingLogo?: boolean;
  onTrailingLogoClick?: () => void;
}) {
  return (
    <div className="shrink-0 rounded-b-[34px] bg-white px-6 pb-6 pt-5 shadow-[0_20px_40px_rgba(93,63,43,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-[#F5F0EB] text-[#5C3A26]"
            aria-label="Go back"
          >
            <span className="text-[30px] leading-none">‹</span>
          </button>
          <h1
            className="truncate text-[24px] font-extrabold tracking-[-0.04em]"
            style={{ color: accentColor }}
          >
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {showSearchButton ? (
            <MobileIconCircle
              active={isSearchActive}
              disabled={disableSearchButton}
              onClick={onSearchClick}
            >
              <Search className="h-8 w-8 text-current" strokeWidth={2} />
            </MobileIconCircle>
          ) : null}
          {showTrailingLogo ? (
            <MobileIconCircle
              active={trailingLogoActive}
              disabled={disableTrailingLogo}
              onClick={onTrailingLogoClick}
            >
              <LogoIcon className="h-7 w-7" />
            </MobileIconCircle>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MobileSectionHeader({
  icon,
  title,
  count,
  label,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  label: string;
}) {
  return (
    <div className="px-6 pb-5 pt-6">
      <div className="flex items-center gap-3">
        {icon}
        <h2 className="text-[16px] font-extrabold leading-none tracking-[-0.04em] text-[#5C3A26]">
          {title}
        </h2>
        <span className="ml-auto text-[16px] font-extrabold leading-none tracking-[-0.04em] text-[#996546]">
          {count}
        </span>
      </div>
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#5C3A26]">
        {label}
      </p>
    </div>
  );
}

function MobileGroupListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`mobile-group-skeleton-${index}`}
          className="animate-pulse overflow-hidden rounded-[24px] border border-[#E9DED6] bg-white px-5 py-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-full bg-[#EEE3DB]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-32 rounded-full bg-[#EEE3DB]" />
              <div className="h-4 w-24 rounded-full bg-[#F4ECE6]" />
            </div>
            <div className="h-11 w-20 shrink-0 rounded-full bg-[#E4D5C8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopGroupListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`desktop-group-skeleton-${index}`}
          className="animate-pulse border-b border-[#EEE1DA] bg-white px-3 py-4 xl:px-4"
        >
          <div className="flex items-center gap-4">
            <div className="h-[60px] w-[60px] shrink-0 rounded-full bg-[#EEE3DB]" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-4 w-28 rounded-full bg-[#EEE3DB]" />
              <div className="h-3 w-20 rounded-full bg-[#F4ECE6]" />
            </div>
            <div className="h-9 w-16 shrink-0 rounded-full bg-[#E4D5C8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopGroupPanelSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="w-full max-w-[620px] animate-pulse rounded-[34px] border border-[#E9DBD3] bg-[#FCF8F6] px-8 py-8 shadow-[0_24px_48px_rgba(93,63,43,0.05)]">
        <div className="flex items-center gap-5">
          <div className="h-[60px] w-[60px] shrink-0 rounded-full bg-[#EEE3DB]" />
          <div className="min-w-0 flex-1 space-y-4">
            <div className="h-7 w-44 rounded-full bg-[#EEE3DB]" />
            <div className="h-4 w-28 rounded-full bg-[#F4ECE6]" />
          </div>
          <div className="h-12 w-24 shrink-0 rounded-full bg-[#E4D5C8]" />
        </div>
        <div className="mt-10 space-y-4">
          <div className="h-4 w-full rounded-full bg-[#F4ECE6]" />
          <div className="h-4 w-[88%] rounded-full bg-[#F4ECE6]" />
          <div className="h-4 w-[70%] rounded-full bg-[#F4ECE6]" />
        </div>
      </div>
    </div>
  );
}

function ChatMessagesSkeleton({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={`space-y-6 ${mobile ? "" : "px-2 py-2"}`}>
      {Array.from({ length: 4 }).map((_, index) => {
        const alignRight = index % 2 === 0;

        return (
          <div
            key={`chat-message-skeleton-${mobile ? "mobile" : "desktop"}-${index}`}
            className={`flex ${alignRight ? "justify-end" : "justify-start"}`}
          >
            <div className={`animate-pulse ${alignRight ? "items-end" : "items-start"} flex max-w-[84%] flex-col gap-3`}>
              <div
                className={`rounded-[24px] ${alignRight ? "bg-[#E8DDD9]" : "bg-[#F3EAE4]"} px-5 py-4`}
              >
                <div className="h-4 w-32 rounded-full bg-white/70" />
                <div className="mt-3 h-4 w-48 rounded-full bg-white/70" />
                <div className="mt-2 h-4 w-36 rounded-full bg-white/70" />
              </div>
              <div className="h-11 w-11 rounded-full bg-[#EEE3DB]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MobileGroupCard({
  group,
  isActive,
  isJoined,
  onSelect,
  onJoin,
  onShare,
  isSharePending,
}: {
  group: GroupRecord;
  isActive: boolean;
  isJoined: boolean;
  onSelect: () => void;
  onJoin: () => void;
  onShare: () => void;
  isSharePending: boolean;
}) {
  const activeCardBorderColor = hexToRgba(group.accent, 0.3);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className="relative overflow-hidden border bg-white text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F68B1F]/35"
      style={{
        backgroundColor: isActive ? hexToRgba(group.accent, 0.12) : "#FFFFFF",
        borderColor: isActive ? activeCardBorderColor : "#EADFD8",
        boxShadow: isActive
          ? `inset 0 0 0 1px ${activeCardBorderColor}`
          : undefined,
      }}
    >
      {isActive ? (
        <div
          className="absolute inset-y-0 right-0 w-[5px]"
          style={{ backgroundColor: group.accent }}
        />
      ) : null}
      <div className="flex items-start gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="shrink-0">
          <GroupAvatar group={group} size="mobile" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="break-words text-[18px] font-extrabold leading-tight tracking-[-0.03em]"
            style={{ color: group.accent }}
          >
            {group.listTitle}
          </p>

          <p className="mt-2 block w-full text-left text-[15px] font-bold text-[#5E4F48] sm:text-[16px]">
            {group.membersLabel}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShare();
              }}
              disabled={isSharePending}
              className="inline-flex shrink-0 items-center gap-2 text-[16px] font-bold text-[#6F635C]"
            >
              {isSharePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharePending ? "Sharing..." : "Share"}
            </button>

            <div className="ml-auto flex shrink-0 items-center">
              {isJoined ? (
                <UnreadCountBadge
                  count={group.unreadCount}
                  activeColor={group.accent}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[21px]"
                />
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onJoin();
                  }}
                  className="shrink-0 rounded-full px-6 py-4 text-[17px] font-extrabold text-white"
                  style={{ backgroundColor: group.joinBackground }}
                >
                  Join
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnreadCountBadge({
  count,
  activeColor = "#A6BA63",
  className,
}: {
  count: number;
  activeColor?: string;
  className: string;
}) {
  const hasUnread = count > 0;

  return (
    <div
      className={`${className} border font-extrabold`}
      style={{
        backgroundColor: hasUnread ? activeColor : "#F7EFEA",
        borderColor: hasUnread ? activeColor : "#E4D7CF",
        color: hasUnread ? "#FFFFFF" : "#8B8079",
      }}
    >
      {count}
    </div>
  );
}

function MobileConversationCard({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationRecord;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 border border-[#EADFD8] px-6 py-6 text-left ${
        isActive ? "bg-[#EEF3DF]" : "bg-white"
      }`}
    >
      {isActive ? <div className="absolute inset-y-0 right-0 w-[6px] bg-[#9BB168]" /> : null}
      <div
        className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold text-black"
        style={{ backgroundColor: conversation.tone }}
      >
        {conversation.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className="truncate text-[18px] font-extrabold tracking-[-0.03em] text-[#5C3A26]">
            {conversation.name}
          </p>
          {conversation.time ? (
            <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5C3A26]">
              {conversation.time}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-[188px] text-[16px] font-bold leading-[1.25] text-[#8B8079]">
          {conversation.preview}
        </p>
      </div>
      <UnreadCountBadge
        count={conversation.unreadCount}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[21px]"
      />
    </button>
  );
}

function MobileDiscoverSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-8 flex h-[104px] items-center gap-5 rounded-[23px] border border-[#E6D7CD] bg-white px-7 shadow-[0_18px_40px_rgba(93,63,43,0.06)]">
      <Search className="h-11 w-11 shrink-0 text-[#9A6A49]" strokeWidth={2} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search people"
        className="w-full bg-transparent text-[24px] font-extrabold tracking-[-0.04em] text-[#9A6A49] placeholder:text-[#9A6A49] focus:outline-none"
      />
    </label>
  );
}

function GroupSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-[22px] border border-[#E6D7CD] bg-white px-5 py-4 shadow-[0_16px_36px_rgba(93,63,43,0.06)]">
      <Search className="h-6 w-6 shrink-0 text-[#9A6A49]" strokeWidth={2} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[16px] font-bold tracking-[-0.02em] text-[#5C3A26] placeholder:text-[#9A6A49] focus:outline-none"
      />
    </label>
  );
}

function MobileDiscoverPersonCard({
  person,
  onChat,
}: {
  person: MobileDiscoverPerson;
  onChat: () => void;
}) {
  return (
    <div className="border border-[#EADFD8] bg-white px-6 py-6 shadow-[0_18px_40px_rgba(93,63,43,0.04)]">
      <div className="mb-4 flex justify-end">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#5C3A26]">
          {person.lastSeenLabel}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold text-black"
          style={{ backgroundColor: person.tone }}
        >
          {person.initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] font-extrabold tracking-[-0.03em] text-[#5C3A26]">
            {person.name}
          </p>
          <p className="mt-3 text-[16px] font-bold leading-[1.25] text-[#8B8079]">
            {person.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onChat}
          className="shrink-0 rounded-full bg-[#6A4227] px-5 py-3 text-[17px] font-extrabold text-white"
        >
          Chat
        </button>
      </div>
    </div>
  );
}

function resolveGroupMessageMember(
  message: GroupChatMessageRecord,
  members: GroupChatMemberProfile[],
): GroupChatMemberProfile {
  if (message.isCurrentUser) {
    const currentUserMember = members.find((member) => member.isCurrentUser);
    if (currentUserMember) {
      return currentUserMember;
    }
  }

  const matchedMember = members.find((member) => member.id === message.senderId);
  if (matchedMember) {
    return matchedMember;
  }

  const normalizedSenderEmail = message.senderEmail?.trim().toLowerCase() ?? "";
  if (normalizedSenderEmail) {
    const matchedMemberByEmail = members.find(
      (member) => member.email?.trim().toLowerCase() === normalizedSenderEmail,
    );
    if (matchedMemberByEmail) {
      return matchedMemberByEmail;
    }
  }

  const normalizedSenderName = message.senderName?.trim().toLowerCase() ?? "";
  if (normalizedSenderName) {
    const matchedMemberByName = members.find(
      (member) => member.name.trim().toLowerCase() === normalizedSenderName,
    );
    if (matchedMemberByName) {
      return matchedMemberByName;
    }
  }

  const fallbackName = message.senderName?.trim() || "Community member";
  const isCurrentUser = message.isCurrentUser === true;

  return {
    id: message.senderId,
    name: fallbackName,
    description: isCurrentUser ? "You" : "Community member",
    time: "Now",
    previewBio: isCurrentUser
      ? "You are part of this community conversation."
      : `${fallbackName} is part of this community conversation.`,
    avatar: isCurrentUser ? "portrait-a" : "portrait-b",
    avatarUrl: message.avatarUrl ?? null,
    initial: message.avatarInitial ?? getSenderInitials(fallbackName),
    badgeColor: message.avatarColor ?? (isCurrentUser ? "#A6BA63" : "#F68B1F"),
    badgeTextColor:
      message.avatarTextColor ?? (isCurrentUser ? "#1D1D1B" : "#1D1D1B"),
    email: null,
    isCurrentUser,
  };
}

function shouldStartGroupMessageSequence(
  messages: GroupChatMessageRecord[],
  index: number,
  members: GroupChatMemberProfile[],
) {
  if (index === 0 || shouldShowTodayDivider(messages, index)) {
    return true;
  }

  const currentMessage = messages[index];
  const previousMessage = messages[index - 1];

  if (!currentMessage || !previousMessage) {
    return true;
  }

  const currentMember = resolveGroupMessageMember(currentMessage, members);
  const previousMember = resolveGroupMessageMember(previousMessage, members);
  const isCurrentOwnMessage =
    currentMessage.isCurrentUser === true || currentMember.isCurrentUser === true;
  const isPreviousOwnMessage =
    previousMessage.isCurrentUser === true || previousMember.isCurrentUser === true;

  if (isCurrentOwnMessage !== isPreviousOwnMessage) {
    return true;
  }

  const currentSenderKey =
    currentMessage.senderId || currentMember.id || currentMember.name.trim().toLowerCase();
  const previousSenderKey =
    previousMessage.senderId || previousMember.id || previousMember.name.trim().toLowerCase();

  return currentSenderKey !== previousSenderKey;
}

function shouldStartDirectMessageSequence(
  messages: ApiMessageRecord[],
  index: number,
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  if (index === 0 || shouldShowTodayDivider(messages, index)) {
    return true;
  }

  const currentMessage = messages[index];
  const previousMessage = messages[index - 1];

  if (!currentMessage || !previousMessage) {
    return true;
  }

  const currentIsOwnMessage = resolveIsOwnMessage(
    currentMessage,
    currentUserId,
    currentUserEmail,
  );
  const previousIsOwnMessage = resolveIsOwnMessage(
    previousMessage,
    currentUserId,
    currentUserEmail,
  );

  if (currentIsOwnMessage !== previousIsOwnMessage) {
    return true;
  }

  const currentSenderKey = currentIsOwnMessage
    ? currentUserId?.trim().toLowerCase() ||
      currentUserEmail?.trim().toLowerCase() ||
      "self"
    : currentMessage.senderId?.trim().toLowerCase() ||
      currentMessage.senderEmail?.trim().toLowerCase() ||
      currentMessage.senderName?.trim().toLowerCase() ||
      currentMessage.id;
  const previousSenderKey = previousIsOwnMessage
    ? currentUserId?.trim().toLowerCase() ||
      currentUserEmail?.trim().toLowerCase() ||
      "self"
    : previousMessage.senderId?.trim().toLowerCase() ||
      previousMessage.senderEmail?.trim().toLowerCase() ||
      previousMessage.senderName?.trim().toLowerCase() ||
      previousMessage.id;

  return currentSenderKey !== previousSenderKey;
}

function GroupChatEmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-[360px] rounded-[28px] border border-[#E9DBD3] bg-[#FCF8F6] px-6 py-7 text-center">
        <h3 className="text-[28px] font-extrabold tracking-[-0.04em] text-[#5C3A26]">
          No messages yet
        </h3>
        <p className="mt-4 text-[16px] leading-[1.6] text-[#7E6E66]">
          Start the conversation in this community.
        </p>
      </div>
    </div>
  );
}

function MobileGroupChatPanel({
  messages,
  members,
  isLoading,
  actionError,
  draft,
  pendingAttachments,
  pendingReplyMessage,
  isSending,
  onDraftChange,
  onSubmit,
  onRemovePendingAttachment,
  onOpenMemberPreview,
  onAttachClick,
  onReplyToMessage,
  onClearReplyMessage,
  editingMessage,
  onCancelEditingMessage,
  viewportKey,
  unreadAnchorMessageId,
  scrollTopCacheRef,
}: {
  messages: GroupChatMessageRecord[];
  members: GroupChatMemberProfile[];
  isLoading: boolean;
  actionError: string | null;
  draft: string;
  pendingAttachments: ApiAttachmentRecord[];
  pendingReplyMessage: ApiMessageReplyRecord | null;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onRemovePendingAttachment: (attachmentId: string) => void;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onAttachClick: () => void;
  onReplyToMessage: (message: GroupChatMessageRecord) => void;
  onClearReplyMessage: () => void;
  editingMessage: EditingMessageDraft | null;
  onCancelEditingMessage: () => void;
  viewportKey: string | null;
  unreadAnchorMessageId: string | null;
  scrollTopCacheRef: { current: Record<string, number> };
}) {
  const lastMessage = messages[messages.length - 1] ?? null;
  const lastMessageMember = lastMessage
    ? resolveGroupMessageMember(lastMessage, members)
    : null;
  const forceScrollToken =
    lastMessage &&
    (lastMessage.isCurrentUser === true || lastMessageMember?.isCurrentUser === true)
      ? lastMessage.id
      : null;
  const { bottomOffset, scrollContainerRef, scrollToBottom } = useMessageListAutoScroll({
    firstMessageId: messages[0]?.id ?? null,
    lastMessageId: lastMessage?.id ?? null,
    messageCount: messages.length,
    isLoading,
    forceScrollToken,
    manageInitialViewportExternally: true,
  });
  const { highlightedMessageId, jumpToMessage, registerMessageElement, scrollToMessage } =
    useMessageJumpNavigation(scrollContainerRef);
  useMessageViewportRestore({
    contextKey: viewportKey,
    unreadAnchorMessageId,
    isLoading,
    messageCount: messages.length,
    scrollContainerRef,
    scrollToBottom,
    scrollToMessage,
    scrollTopCacheRef,
  });
  const shouldShowJumpToLatestButton =
    messages.length > 0 && bottomOffset > MESSAGE_LIST_JUMP_BUTTON_THRESHOLD;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-6"
      style={getMobileChatViewportPaddingStyle()}
    >
      {actionError ? (
        <div className="mb-4 rounded-[20px] border border-[#F0E5DF] bg-[#FFF9F5] px-5 py-3 text-[14px] font-semibold text-[#8B4B1E]">
          {actionError}
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {isLoading ? (
          <ChatMessagesSkeleton mobile />
        ) : messages.length === 0 ? (
          <GroupChatEmptyState />
        ) : (
          <>
            {messages.map((message, index) => {
              const messageMember = resolveGroupMessageMember(message, members);
              const isOwnMessage =
                message.isCurrentUser === true || messageMember.isCurrentUser === true;
              const showTodayDivider = shouldShowTodayDivider(messages, index);
              const showSenderIdentity = shouldStartGroupMessageSequence(
                messages,
                index,
                members,
              );
              const spacingClass =
                index === 0 ? "" : showSenderIdentity ? "mt-3.5" : "mt-0.5";

              return (
                <div
                  key={message.id}
                  ref={(element) => registerMessageElement(message.id, element)}
                  className={`${spacingClass} rounded-[20px] transition-[background-color,box-shadow] duration-300 ${
                    highlightedMessageId === message.id
                      ? "bg-[color:var(--chat-highlight-bg)] shadow-[0_0_0_2px_var(--chat-highlight-ring)]"
                      : ""
                  }`}
                >
                  {showTodayDivider ? <TodayDivider /> : null}
                  <ChatThreadMessage
                    align={isOwnMessage ? "right" : "left"}
                    label={
                      showSenderIdentity
                        ? (isOwnMessage ? "You" : messageMember.name)
                        : null
                    }
                    maxWidth="max-w-[74%]"
                    timestamp={formatMessageTimestamp(message.createdAt)}
                    status={
                      isOwnMessage ? (message.isPending ? "sending" : "sent") : null
                    }
                    replyTo={message.replyTo ?? null}
                    onReplyQuoteClick={
                      message.replyTo ? () => jumpToMessage(message.replyTo!.id) : undefined
                    }
                    showTail={showSenderIdentity}
                    showAvatar={showSenderIdentity && !isOwnMessage}
                    avatarInitial={
                      showSenderIdentity && !isOwnMessage
                        ? messageMember.initial
                        : undefined
                    }
                    avatarUrl={
                      showSenderIdentity && !isOwnMessage
                        ? (messageMember.avatarUrl ?? null)
                        : undefined
                    }
                    avatarColor={
                      showSenderIdentity && !isOwnMessage
                        ? messageMember.badgeColor
                        : undefined
                    }
                    avatarTextColor={
                      showSenderIdentity && !isOwnMessage
                        ? (messageMember.badgeTextColor ?? "#000000")
                        : undefined
                    }
                    onAvatarClick={
                      showSenderIdentity && !isOwnMessage
                        ? () => onOpenMemberPreview(buildMemberPreview(messageMember))
                        : undefined
                    }
                    onReply={() => onReplyToMessage(message)}
                  >
                    {message.text ? (
                      <MessageText text={message.text} isOwnMessage={isOwnMessage} />
                    ) : null}
                    <MessageAttachments
                      attachments={message.attachments}
                      hasText={Boolean(message.text)}
                      isOwnMessage={isOwnMessage}
                    />
                  </ChatThreadMessage>
                </div>
              );
            })}
            {shouldShowJumpToLatestButton ? (
              <JumpToLatestButton mobile onClick={() => scrollToBottom("smooth")} />
            ) : null}
          </>
        )}
      </div>

      <MobileChatComposerDock>
        <MobileComposer
          placeholder="Send your message to this group chat..."
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          isSending={isSending}
          onAttachClick={onAttachClick}
          attachments={pendingAttachments}
          onRemoveAttachment={onRemovePendingAttachment}
          replyPreview={pendingReplyMessage}
          onClearReply={onClearReplyMessage}
          editingMessage={editingMessage}
          onCancelEditing={onCancelEditingMessage}
        />
      </MobileChatComposerDock>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-8">
      <div className="flex-1 space-y-7">
        <div className="flex justify-end">
          <div className="space-y-4">
            <MessageBubble
              align="right"
              label="You"
              maxWidth="max-w-[84%]"
            >
              <p>
                Any one shipped React Server Component in production? Curious
                about real DX- not the hype 😢😭
              </p>
            </MessageBubble>
            <div className="mt-1 flex justify-end pr-1">
              <button
                type="button"
                onClick={() => onOpenMemberPreview(PREVIEW_MEMBER)}
                className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#A6BA63] text-[24px] font-extrabold text-black"
              >
                O
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <MessageBubble
            align="left"
            label="Chukwudi"
            maxWidth="max-w-[84%]"
          >
            <p>
              RSC is real, SEO wins are massive, Auth was tricky-keep it clean
              always
            </p>
          </MessageBubble>
          <button
            type="button"
            onClick={() => onOpenMemberPreview(PREVIEW_MEMBER)}
            className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#F68B1F] text-[24px] font-extrabold text-black"
          >
            C
          </button>
        </div>

        <TodayDivider />

        <div className="space-y-3">
          <MessageBubble
            align="left"
            label="Fatima"
            maxWidth="max-w-[84%]"
          >
            <p>
              RSC is real, SEO wins are massive, Auth was tricky-keep it clean
              always
            </p>
          </MessageBubble>
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#FF2957] text-[24px] font-extrabold text-black">
            F
          </div>
        </div>
      </div>

      <MobileComposer
        placeholder="Send your message to this group chat..."
        onAttachClick={onAttachClick}
      />
    </div>
  );
}

function MobileDirectMessagesPanel({
  conversationTitle,
  messages,
  currentUserId,
  currentUserEmail,
  isLoading,
  error,
  actionError,
  draft,
  onDraftChange,
  onSubmit,
  isSending,
  onAttachClick,
  pendingReplyMessage,
  onReplyToMessage,
  onClearReplyMessage,
  editingMessage,
  onCancelEditingMessage,
  viewportKey,
  unreadAnchorMessageId,
  scrollTopCacheRef,
}: {
  conversationTitle: string;
  messages: ApiMessageRecord[];
  currentUserId: string | null;
  currentUserEmail: string | null;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  isSending: boolean;
  onAttachClick: () => void;
  pendingReplyMessage: ApiMessageReplyRecord | null;
  onReplyToMessage: (message: ApiMessageRecord) => void;
  onClearReplyMessage: () => void;
  editingMessage: EditingMessageDraft | null;
  onCancelEditingMessage: () => void;
  viewportKey: string | null;
  unreadAnchorMessageId: string | null;
  scrollTopCacheRef: { current: Record<string, number> };
}) {
  const lastMessage = messages[messages.length - 1] ?? null;
  const forceScrollToken =
    lastMessage &&
    resolveIsOwnMessage(lastMessage, currentUserId, currentUserEmail)
      ? lastMessage.id
      : null;
  const { bottomOffset, scrollContainerRef, scrollToBottom } = useMessageListAutoScroll({
    firstMessageId: messages[0]?.id ?? null,
    lastMessageId: lastMessage?.id ?? null,
    messageCount: messages.length,
    isLoading,
    forceScrollToken,
    manageInitialViewportExternally: true,
  });
  const { highlightedMessageId, jumpToMessage, registerMessageElement, scrollToMessage } =
    useMessageJumpNavigation(scrollContainerRef);
  useMessageViewportRestore({
    contextKey: viewportKey,
    unreadAnchorMessageId,
    isLoading,
    messageCount: messages.length,
    scrollContainerRef,
    scrollToBottom,
    scrollToMessage,
    scrollTopCacheRef,
  });
  const shouldShowJumpToLatestButton =
    messages.length > 0 && bottomOffset > MESSAGE_LIST_JUMP_BUTTON_THRESHOLD;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-6"
      style={getMobileChatViewportPaddingStyle()}
    >
      {error ? <InlineNotice>{error}</InlineNotice> : null}
      {actionError ? <InlineNotice>{actionError}</InlineNotice> : null}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {isLoading ? (
          <ChatMessagesSkeleton mobile />
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = resolveIsOwnMessage(
                message,
                currentUserId,
                currentUserEmail,
              );
              const showTodayDivider = shouldShowTodayDivider(messages, index);
              const startsNewSequence = shouldStartDirectMessageSequence(
                messages,
                index,
                currentUserId,
                currentUserEmail,
              );
              const spacingClass =
                index === 0 ? "" : startsNewSequence ? "mt-3.5" : "mt-0.5";

              return (
                <div
                  key={message.id}
                  ref={(element) => registerMessageElement(message.id, element)}
                  className={`${spacingClass} rounded-[20px] transition-[background-color,box-shadow] duration-300 ${
                    highlightedMessageId === message.id
                      ? "bg-[color:var(--chat-highlight-bg)] shadow-[0_0_0_2px_var(--chat-highlight-ring)]"
                      : ""
                  }`}
                >
                  {showTodayDivider ? <TodayDivider /> : null}
                  <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    <MessageBubble
                      align={isOwnMessage ? "right" : "left"}
                      label={null}
                      maxWidth="max-w-[74%]"
                      timestamp={formatMessageTimestamp(message.createdAt)}
                      status={isOwnMessage ? "sent" : null}
                      replyTo={message.replyTo ?? null}
                      onReplyQuoteClick={
                        message.replyTo ? () => jumpToMessage(message.replyTo!.id) : undefined
                      }
                      onReply={() => onReplyToMessage(message)}
                    >
                      {message.text ? (
                        <MessageText text={message.text} isOwnMessage={isOwnMessage} />
                      ) : null}
                    </MessageBubble>
                  </div>
                </div>
              );
            })}
            {shouldShowJumpToLatestButton ? (
              <JumpToLatestButton mobile onClick={() => scrollToBottom("smooth")} />
            ) : null}
          </>
        )}
      </div>

      <MobileChatComposerDock>
        <MobileComposer
          placeholder={`Message ${conversationTitle}`}
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          isSending={isSending}
          onAttachClick={onAttachClick}
          replyPreview={pendingReplyMessage}
          onClearReply={onClearReplyMessage}
          editingMessage={editingMessage}
          onCancelEditing={onCancelEditingMessage}
        />
      </MobileChatComposerDock>
    </div>
  );
}

function MobileChatComposerDock({ children }: { children: ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-35 px-4 sm:px-6"
      style={getMobileChatComposerDockStyle()}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-screen-md">
        {children}
      </div>
    </div>
  );
}

function MobileComposer({
  placeholder,
  draft,
  onDraftChange,
  onSubmit,
  isSending = false,
  onAttachClick,
  attachments = [],
  onRemoveAttachment,
  replyPreview,
  onClearReply,
  editingMessage,
  onCancelEditing,
}: {
  placeholder: string;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onSubmit?: () => void;
  isSending?: boolean;
  onAttachClick?: () => void;
  attachments?: ApiAttachmentRecord[];
  onRemoveAttachment?: (attachmentId: string) => void;
  replyPreview?: ApiMessageReplyRecord | null;
  onClearReply?: () => void;
  editingMessage?: EditingMessageDraft | null;
  onCancelEditing?: () => void;
}) {
  const textareaRef = useAutoResizingTextarea(draft, 24, 160);

  return (
    <div className="px-1 pb-3 pt-3">
      <div className="relative rounded-[24px] border border-[#E4D5C8] bg-[linear-gradient(180deg,#FBF6F1_0%,#F2E8DF_100%)] px-4 pb-4 pt-4 shadow-[0_18px_38px_rgba(92,58,38,0.14)] ring-1 ring-white/70 sm:px-5 sm:pb-5 sm:pt-5">
        {editingMessage ? (
          <EditMessagePreviewCard
            editingMessage={editingMessage}
            onCancel={onCancelEditing}
          />
        ) : null}
        {replyPreview ? (
          <ReplyPreviewCard replyPreview={replyPreview} onClear={onClearReply} />
        ) : null}
        {attachments.length > 0 ? (
          <div className={`${editingMessage || replyPreview ? "mt-3" : "mb-3"} flex flex-wrap gap-2`}>
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => onRemoveAttachment?.(attachment.id)}
                className="inline-flex items-center gap-2 rounded-full border border-[#E4D5C8] bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#5C3A26] shadow-[0_10px_18px_rgba(71,49,34,0.08)]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="max-w-[130px] truncate">{attachment.name}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}
        <div className={`${editingMessage || replyPreview || attachments.length > 0 ? "mt-3" : ""} flex items-end gap-3`}>
          <button
            type="button"
            onClick={onAttachClick}
            disabled={Boolean(editingMessage)}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#8A5A38] transition-colors hover:text-[#6A4227] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Add attachment"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="flex min-h-[24px] flex-1 items-center py-1">
            {onDraftChange ? (
              <textarea
                ref={textareaRef}
                value={draft ?? ""}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => handleComposerKeyDown(event, onSubmit)}
                rows={1}
                placeholder={placeholder}
                className="block w-full resize-none overflow-hidden bg-transparent px-1 text-[15px] font-medium leading-[1.45] text-[#5C3A26] placeholder:font-medium placeholder:text-[#786A63] focus:outline-none sm:text-[16px]"
              />
            ) : (
              <p className="px-1 text-[15px] font-medium leading-[1.45] text-[#786A63] sm:text-[16px]">
                {placeholder}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={
              Boolean(onDraftChange) &&
              (isSending || (!(draft ?? "").trim() && attachments.length === 0))
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_10px_20px_rgba(92,58,38,0.22)] transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ChatSendIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileMembersPanel({
  members,
  publicView,
  onOpenMemberPreview,
  onOpenDirectMessageFromGroup,
}: {
  members: GroupChatMemberProfile[];
  publicView: boolean;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onOpenDirectMessageFromGroup: (member: MemberPreview) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="flex flex-1 items-start justify-center px-6 pb-6 pt-12 text-center">
        <div className="max-w-[320px] rounded-[28px] border border-[#E7DDD4] bg-white px-6 py-8 shadow-[0_20px_40px_rgba(93,63,43,0.08)]">
          <h2 className="text-[24px] font-extrabold tracking-[-0.04em] text-[#101010]">
            Group Members
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-[#786E68]">
            No member data is available for this community yet.
          </p>
        </div>
      </div>
    );
  }

  const visibleMembers = dedupeGroupMembers(members);
  const displayedMemberCount = visibleMembers.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-8">
      <div className="shrink-0 flex items-center gap-3">
        <h2 className="text-[23px] font-extrabold tracking-[-0.04em] text-[#101010]">
          Group Members
        </h2>
        <span className="rounded-full bg-[#EFF1F5] px-4 py-2 text-[16px] font-extrabold text-[#1D1D1B]">
          {displayedMemberCount}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-12 pb-[calc(168px+env(safe-area-inset-bottom))] pt-10">
          {visibleMembers.map((member) => {
            const preview = buildMemberPreview(member);

            return (
              <div key={member.id} className="flex items-start gap-4">
                <button type="button" onClick={() => onOpenMemberPreview(preview)}>
                  {member.avatarUrl ? (
                    <div className="h-[50px] w-[50px] overflow-hidden rounded-xl bg-[#E4D5C7]">
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <PortraitAvatar type={member.avatar} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[18px] font-extrabold tracking-[-0.03em] text-[#101010]">
                        {member.name}
                      </p>
                      <p className="mt-1 text-[16px] font-bold text-[#9A918D]">
                        {member.description}
                      </p>
                    </div>
                    <span className="text-[16px] font-bold text-[#B8B1AC]">
                      {member.time}
                    </span>
                  </div>

                  {publicView ? (
                    <div className="mt-5 flex items-center gap-6">
                      <span className="text-[24px] font-extrabold leading-none text-black">
                        X
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#0A66C2] text-[17px] font-extrabold text-white">
                        in
                      </span>
                      <Link2 className="h-6 w-6 text-[#6A4227]" />
                    </div>
                  ) : (
                    <>
                      <div className="mt-5">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => onOpenMemberPreview(preview)}
                            className="rounded-full bg-[#FFF0DE] px-4 py-2 text-[14px] font-extrabold text-[#F6871C]"
                          >
                            Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenDirectMessageFromGroup(preview)}
                            disabled={preview.isCurrentUser}
                            className="rounded-full bg-[#D9F4D6] px-4 py-2 text-[14px] font-extrabold text-[#34A853] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Message
                          </button>
                        </div>
                      </div>
                      {/*
                      <div className="mt-5 flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => onOpenMemberPreview(preview)}
                          className="rounded-full bg-[#FFF0DE] px-5 py-3 text-[16px] font-extrabold text-[#F6871C]"
                        >
                          Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDirectMessageFromGroup(preview)}
                          className="rounded-full bg-[#D9F4D6] px-5 py-3 text-[16px] font-extrabold text-[#34A853]"
                        >
                          Message
                        </button>
                      </div>
                      */}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileRestrictedPanel({
  description,
}: {
  description: string;
}) {
  return (
    <div className="flex flex-1 items-start justify-center px-8 pt-24 text-center">
      <div className="max-w-[320px]">
        <div className="mx-auto w-[280px]">
          <RestrictedFeatureIllustration />
        </div>
        <h3 className="mt-8 text-[29px] font-extrabold tracking-[-0.04em] text-[#5C3A26]">
          Access Restricted
        </h3>
        <p className="mt-6 text-[18px] leading-[1.55] text-[#786E68]">
          {description}
        </p>
      </div>
    </div>
  );
}

function DashboardNavIcon({
  section,
  active,
  size,
}: {
  section: "groups" | "messages";
  active: boolean;
  size: number;
}) {
  const src =
    section === "groups"
      ? active
        ? "/group_icon_active.svg"
        : "/group_icon.svg"
      : active
        ? "/message_icon_active.svg"
        : "/message_icon.svg";

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      aria-hidden="true"
    />
  );
}

function MobileBottomNavigation({
  activeSection,
  onGroupsClick,
  onMessagesClick,
  onProfileClick,
}: {
  activeSection: DashboardSection | "profile";
  onGroupsClick: () => void;
  onMessagesClick: () => void;
  onProfileClick: () => void;
}) {
  const items: Array<{
    key: DashboardSection | "profile";
    label: string;
    icon?: ReactNode;
    onClick: () => void;
  }> = [
    {
      key: "groups",
      label: "CLIQUES",
      onClick: onGroupsClick,
    },
    {
      key: "messages",
      label: "MESSAGES",
      onClick: onMessagesClick,
    },
    {
      key: "profile",
      label: "PROFILE",
      icon: <UserRound className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} />,
      onClick: onProfileClick,
    },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="w-full bg-[#5C3A26] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pt-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {items.map((item) => {
            const isActive = activeSection === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center gap-2 sm:gap-3"
              >
                <span
                  className={`flex h-[56px] w-[56px] items-center justify-center rounded-full sm:h-[68px] sm:w-[68px] ${
                    isActive ? "bg-[#A8704C] text-white" : "text-[#D8BCAC]"
                  }`}
                >
                  {item.key === "groups" ? (
                    <DashboardNavIcon
                      section="groups"
                      active={isActive}
                      size={24}
                    />
                  ) : item.key === "messages" ? (
                    <DashboardNavIcon
                      section="messages"
                      active={isActive}
                      size={24}
                    />
                  ) : (
                    <UserRound
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      strokeWidth={1.8}
                    />
                  )}
                </span>
                <span
                  className={`text-[11px] font-extrabold tracking-[0.12em] sm:text-[12px] sm:tracking-[0.14em] ${
                    isActive ? "text-white" : "text-[#D8BCAC]"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileIconCircle({
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[54px] w-[54px] items-center justify-center rounded-full border ${
        active
          ? "border-[#9A6A49] bg-[#9A6A49] text-white"
          : disabled
            ? "cursor-not-allowed border-[#E8D9CF] bg-white text-[#D0C1B6]"
            : "border-[#E8D9CF] bg-white text-[#9A6A49]"
      }`}
    >
      {children}
    </button>
  );
}

function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-[#FFF2EA] px-4 py-3 text-[14px] font-semibold leading-6 text-[#A4501A]">
      {children}
    </div>
  );
}

function InlineStateMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-[#F8F3EE] px-5 py-5 text-[15px] font-semibold leading-7 text-[#7E6E66]">
      {children}
    </div>
  );
}

function DisabledFeatureButton({
  label,
  icon,
  secondary = false,
  compact = false,
}: {
  label: string;
  icon?: ReactNode;
  secondary?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      className={`flex items-center justify-center gap-3 rounded-full border px-6 font-extrabold opacity-70 ${
        compact ? "py-3 text-[16px]" : "py-4 text-[16px]"
      } ${
        secondary
          ? "border-[#8E6A57] bg-white text-[#6A4227]"
          : "border-transparent bg-[#6A4227] text-white"
      }`}
    >
      <span>{label}</span>
      {icon}
    </button>
  );
}

function DashboardRail({
  activeSection,
  unreadGroupsCount,
  unreadMessagesCount,
  onGroupsClick,
  onMessagesClick,
  onProfileClick,
}: {
  activeSection: DashboardSection | "profile";
  unreadGroupsCount: number;
  unreadMessagesCount: number;
  onGroupsClick: () => void;
  onMessagesClick: () => void;
  onProfileClick: () => void;
}) {
  return (
    <div className="flex w-[96px] flex-col items-center justify-between bg-[#5C3A26] px-2 py-3 xl:w-[118px] xl:px-3 xl:py-4">
      <div className="flex w-full flex-col items-center gap-8 xl:gap-10">
        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white text-[#7E5134] xl:h-[68px] xl:w-[68px]">
          <LogoIcon className="h-9 w-9 xl:h-10 xl:w-10" />
        </div>

        <div className="flex w-full flex-col items-center gap-6 pt-10 xl:gap-8 xl:pt-14">
          <RailButton
            icon={<DashboardNavIcon section="groups" active={activeSection === "groups"} size={28} />}
            active={activeSection === "groups"}
            badge={unreadGroupsCount > 0 ? unreadGroupsCount : undefined}
            onClick={onGroupsClick}
          />
          <RailButton
            icon={<DashboardNavIcon section="messages" active={activeSection === "messages"} size={28} />}
            active={activeSection === "messages"}
            badge={unreadMessagesCount > 0 ? unreadMessagesCount : undefined}
            onClick={onMessagesClick}
          />
          <RailButton
            icon={<UserRound className="h-7 w-7" />}
            active={activeSection === "profile"}
            onClick={onProfileClick}
          />
        </div>
      </div>

      <div className="flex h-[50px] w-[50px] items-center justify-center overflow-hidden rounded-full bg-[#F3D8B2] ring-4 ring-[#7A5037]/26 xl:h-[56px] xl:w-[56px]">
        <SelfPortraitAvatar />
      </div>
    </div>
  );
}

function RailButton({
  icon,
  active = false,
  badge,
  onClick,
}: {
  icon: ReactNode;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-full transition-colors xl:h-[64px] xl:w-[64px] ${
        active
          ? "bg-[#A16D48] text-white"
          : "bg-transparent text-[#F1DDD0]/80 hover:bg-white/8"
      }`}
    >
      {badge !== undefined && (
        <span className="absolute -right-1 top-1 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-[#F6871C] px-1.5 text-[13px] font-extrabold text-white">
          {badge}
        </span>
      )}
      {icon}
    </button>
  );
}

function DashboardListHeader({
  icon,
  title,
  counter,
  label,
}: {
  icon: ReactNode;
  title: string;
  counter: number;
  label: string;
}) {
  return (
    <div className="border-b border-[#E9DBD3] px-3 pb-3 pt-5 xl:px-4 xl:pt-7">
      <div className="flex items-center gap-2 xl:gap-3">
        {icon}
        <h2 className="text-[16px] font-extrabold tracking-[-0.04em] text-[#5C3A26] md:text-[22px] xl:text-[28px]">
          {title}
        </h2>
        <span className="ml-auto text-[16px] font-extrabold text-[#8F6448] md:text-[22px] xl:text-[24px]">
          {counter}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#5C3A26] xl:mt-4 xl:text-[11px] xl:tracking-[0.24em]">
        {label}
      </p>
    </div>
  );
}

function GroupsHeaderIcon({ size }: { size: number }) {
  return (
    <Image
      src="/group_header_icon.svg"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    />
  );
}

function GroupListItem({
  group,
  isActive,
  isJoined,
  onSelect,
  onJoin,
  onShare,
  isSharePending,
}: {
  group: GroupRecord;
  isActive: boolean;
  isJoined: boolean;
  onSelect: () => void;
  onJoin: () => void;
  onShare: () => void;
  isSharePending: boolean;
}) {
  const activeCardBorderColor = hexToRgba(group.accent, 0.3);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect();
      }}
      className="relative overflow-hidden border-b bg-white px-3 py-3 text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#F68B1F]/30 xl:py-4"
      style={{
        backgroundColor: isActive ? hexToRgba(group.accent, 0.12) : "#FFFFFF",
        borderColor: isActive ? activeCardBorderColor : "#EEE1DA",
        boxShadow: isActive
          ? `inset 0 0 0 1px ${activeCardBorderColor}`
          : undefined,
      }}
    >
      {isActive ? (
        <div
          className="absolute inset-y-0 right-0 w-1.5"
          style={{ backgroundColor: group.accent }}
        />
      ) : null}
      <div className="flex items-start gap-3 xl:gap-4">
        <div className="shrink-0">
          <GroupAvatar group={group} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="break-words text-[15px] font-extrabold leading-tight tracking-[-0.03em] xl:text-[17px]"
            style={{ color: group.accent }}
          >
            {group.listTitle}
          </p>

          <p className="mt-1.5 block w-full text-left text-[13px] font-semibold text-[#5E4F48] xl:mt-2 xl:text-[16px]">
            {group.membersLabel}
          </p>

          <div className="mt-2 flex items-center gap-2 xl:gap-3">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onShare();
              }}
              disabled={isSharePending}
              className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#B89E90] transition-colors hover:text-[#8C6B57] xl:gap-2 xl:text-[14px]"
            >
              {isSharePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharePending ? "Sharing..." : "Share"}
            </button>

            <div className="ml-auto flex shrink-0 items-center">
              {isJoined ? (
                <UnreadCountBadge
                  count={group.unreadCount}
                  activeColor={group.accent}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px]"
                />
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onJoin();
                  }}
                  className="shrink-0 rounded-full px-4 py-[9px] text-[16px] font-extrabold text-white"
                  style={{ backgroundColor: group.joinBackground }}
                >
                  Join
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSharedGroupPreviewPanel({
  group,
  onJoin,
}: {
  group: GroupRecord;
  onJoin: () => void;
}) {
  return (
    <div className="flex flex-1 items-start justify-center px-6 pb-8 pt-10">
      <div className="w-full max-w-[380px]">
        <p className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#8F654B]">
          Shared Clique
        </p>
        <div className="overflow-hidden rounded-[26px] border border-[#E7DDD4] bg-[#FCF8F6] shadow-[0_20px_40px_rgba(93,63,43,0.08)]">
          <div className="flex items-start gap-4 px-5 py-5">
            <div className="shrink-0">
              <GroupAvatar group={group} size="mobile" />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="break-words text-[20px] font-extrabold leading-tight tracking-[-0.03em]"
                style={{ color: group.accent }}
              >
                {group.headerTitle}
              </p>
              <p className="mt-3 text-[16px] font-bold text-[#5E4F48]">
                {group.membersLabel}
              </p>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={onJoin}
                  className="rounded-full px-5 py-3 text-[16px] font-extrabold text-white"
                  style={{ backgroundColor: group.joinBackground }}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-[14px] font-semibold leading-6 text-[#8B7E77]">
          Join this clique to create your account, then you&apos;ll be added automatically.
        </p>
      </div>
    </div>
  );
}

function GroupAvatar({
  group,
  size = "desktop",
}: {
  group: GroupRecord;
  size?: "desktop" | "mobile";
}) {
  const sizeClass = size === "mobile" ? "h-[64px] w-[64px]" : "h-[60px] w-[60px]";
  const imageSizes = size === "mobile" ? "64px" : "60px";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_10px_22px_rgba(56,41,27,0.16)] ${sizeClass}`}
      style={{ backgroundColor: group.avatarBackground }}
    >
      <Image
        src={group.avatarSrc}
        alt={`${group.listTitle} group`}
        fill
        sizes={imageSizes}
        className="object-cover"
      />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized.slice(0, 6);

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(92, 58, 38, ${alpha})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationRecord;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-4 border-b border-[#EEE1DA] px-4 py-4 text-left ${
        isActive ? "bg-[#EEF3DF]" : "bg-transparent"
      }`}
    >
      {isActive && <div className="absolute inset-y-0 right-0 w-1 bg-[#9BB168]" />}
      <div
        className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-[30px] font-extrabold text-black"
        style={{ backgroundColor: conversation.tone }}
      >
        {conversation.initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <p className="truncate text-[18px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
            {conversation.name}
          </p>
          {conversation.time ? (
            <span className="ml-auto text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#5C3A26]">
              {conversation.time}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-[190px] text-[16px] font-semibold leading-6 text-[#7E6E66]">
          {conversation.preview}
        </p>
      </div>
      <UnreadCountBadge
        count={conversation.unreadCount}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[20px]"
      />
    </button>
  );
}

function DashboardTopBar({
  activeSection,
  group,
  groupDescription,
  conversationName,
  unreadMessagesCount,
  isAdmin,
  isMembersView,
  disableGroupHeaderActions = false,
  isSearchActive = false,
  onSearchClick,
  onMembersClick,
}: {
  activeSection: DashboardSection;
  group: GroupRecord | null;
  groupDescription: string | null;
  conversationName: string;
  unreadMessagesCount: number;
  isAdmin: boolean;
  isMembersView: boolean;
  disableGroupHeaderActions?: boolean;
  isSearchActive?: boolean;
  onSearchClick?: () => void;
  onMembersClick: () => void;
}) {
  const groupTitleColor = group?.accent ?? "#5C3A26";
  const unreadPillText =
    activeSection === "groups"
      ? typeof group?.unreadCount === "number"
        ? `${group.unreadCount} unread message${group.unreadCount === 1 ? "" : "s"}`
        : group?.unreadLabel ?? "0 unread messages"
      : `${unreadMessagesCount} unread message${unreadMessagesCount === 1 ? "" : "s"}`;

  return (
    <div className="flex min-h-[90px] flex-wrap items-start justify-between gap-3 border-b border-[#E9DBD3] px-4 py-3 sm:px-5 sm:pr-6 xl:min-h-[104px] xl:py-4">
      {activeSection === "groups" ? (
        <div className="min-w-0 flex flex-1 items-start gap-3">
          {group ? <GroupAvatar group={group} /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1
                className="min-w-0 text-[clamp(1.45rem,2.8vw,1.95rem)] font-extrabold leading-none tracking-[-0.05em] xl:text-[clamp(1.75rem,3.6vw,2.125rem)]"
                style={{ color: groupTitleColor }}
              >
                {group?.headerTitle ?? "Communities"}
              </h1>
              <TagPill>{group?.headerMembersLabel ?? "Live API"}</TagPill>
              <TagPill>{unreadPillText}</TagPill>
            </div>
            {groupDescription ? (
              <p className="mt-2 max-w-[640px] text-[12px] font-medium leading-5 text-[#7E6E66] sm:text-[13px] xl:mt-3 xl:text-[15px]">
                {groupDescription}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold leading-none tracking-[-0.05em] text-[#5C3A26] xl:text-[clamp(2rem,4vw,2.75rem)]">
            {conversationName}
          </h1>
          {unreadMessagesCount > 0 ? (
            <TagPill>{unreadMessagesCount} unread messages</TagPill>
          ) : null}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {activeSection === "groups" && isAdmin ? (
          <Link
            href="/dashboard/community"
            className="rounded-full bg-[#6A4227] px-4 py-3 text-[12px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#5E3A22] sm:px-6 sm:py-4 sm:text-[14px]"
          >
            Community
          </Link>
        ) : null}
        <HeaderIconButton
          active={activeSection === "groups" && isSearchActive}
          disabled={activeSection === "groups" && disableGroupHeaderActions}
          onClick={onSearchClick}
        >
          <Search className="h-8 w-8 text-current" />
        </HeaderIconButton>
        {activeSection === "groups" ? (
          <HeaderIconButton
            active={isMembersView}
            disabled={disableGroupHeaderActions}
            onClick={onMembersClick}
          >
            <LogoIcon className="h-8 w-8" />
          </HeaderIconButton>
        ) : null}
      </div>
    </div>
  );
}

function TagPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#EEF3DF] px-3 py-[8px] text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9AAF63] xl:px-5 xl:py-[10px] xl:text-[11px] xl:tracking-[0.24em]">
      {children}
    </span>
  );
}

function HeaderIconButton({
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[50px] w-[50px] items-center justify-center rounded-full transition-colors xl:h-[56px] xl:w-[56px] ${
        active
          ? "bg-[#9C6748] text-white"
          : disabled
            ? "cursor-not-allowed bg-[#FBF5F1] text-[#BBAA9E]"
            : "bg-[#FBF5F1] text-[#5C3A26] hover:bg-[#F4ECE7]"
      }`}
    >
      {children}
    </button>
  );
}

function GroupChatPanel({
  messages,
  members,
  isLoading,
  actionError,
  draft,
  pendingAttachments,
  pendingReplyMessage,
  isSending,
  onDraftChange,
  onSubmit,
  onAttachClick,
  onRemovePendingAttachment,
  onOpenMemberPreview,
  onReplyToMessage,
  onClearReplyMessage,
  editingMessage,
  onCancelEditingMessage,
  viewportKey,
  unreadAnchorMessageId,
  scrollTopCacheRef,
  enableDropUpload = false,
  onDropFiles,
}: {
  messages: GroupChatMessageRecord[];
  members: GroupChatMemberProfile[];
  isLoading: boolean;
  actionError: string | null;
  draft: string;
  pendingAttachments: ApiAttachmentRecord[];
  pendingReplyMessage: ApiMessageReplyRecord | null;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onAttachClick: () => void;
  onRemovePendingAttachment: (attachmentId: string) => void;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onReplyToMessage: (message: GroupChatMessageRecord) => void;
  onClearReplyMessage: () => void;
  editingMessage: EditingMessageDraft | null;
  onCancelEditingMessage: () => void;
  viewportKey: string | null;
  unreadAnchorMessageId: string | null;
  scrollTopCacheRef: { current: Record<string, number> };
  enableDropUpload?: boolean;
  onDropFiles?: (files: File[]) => void;
}) {
  const lastMessage = messages[messages.length - 1] ?? null;
  const lastMessageMember = lastMessage
    ? resolveGroupMessageMember(lastMessage, members)
    : null;
  const forceScrollToken =
    lastMessage &&
    (lastMessage.isCurrentUser === true || lastMessageMember?.isCurrentUser === true)
      ? lastMessage.id
      : null;
  const { bottomOffset, scrollContainerRef, scrollToBottom } = useMessageListAutoScroll({
    firstMessageId: messages[0]?.id ?? null,
    lastMessageId: lastMessage?.id ?? null,
    messageCount: messages.length,
    isLoading,
    forceScrollToken,
    manageInitialViewportExternally: true,
  });
  const { highlightedMessageId, jumpToMessage, registerMessageElement, scrollToMessage } =
    useMessageJumpNavigation(scrollContainerRef);
  useMessageViewportRestore({
    contextKey: viewportKey,
    unreadAnchorMessageId,
    isLoading,
    messageCount: messages.length,
    scrollContainerRef,
    scrollToBottom,
    scrollToMessage,
    scrollTopCacheRef,
  });
  const shouldShowJumpToLatestButton =
    messages.length > 0 && bottomOffset > MESSAGE_LIST_JUMP_BUTTON_THRESHOLD;
  const dragDepthRef = useRef(0);
  const [isDraggingFilesOver, setIsDraggingFilesOver] = useState(false);

  const commitDroppedFiles = (files: File[]) => {
    if (!enableDropUpload || files.length === 0) return;
    onDropFiles?.(files);
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onDragEnter={
        enableDropUpload
          ? (event) => {
              event.preventDefault();
              dragDepthRef.current += 1;
              setIsDraggingFilesOver(true);
            }
          : undefined
      }
      onDragOver={
        enableDropUpload
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          : undefined
      }
      onDragLeave={
        enableDropUpload
          ? (event) => {
              event.preventDefault();
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
              if (dragDepthRef.current === 0) {
                setIsDraggingFilesOver(false);
              }
            }
          : undefined
      }
      onDrop={
        enableDropUpload
          ? (event) => {
              event.preventDefault();
              dragDepthRef.current = 0;
              setIsDraggingFilesOver(false);
              commitDroppedFiles(Array.from(event.dataTransfer.files ?? []));
            }
          : undefined
      }
    >
      {actionError ? (
        <div className="border-b border-[#F0E5DF] bg-[#FFF9F5] px-6 py-3 text-[14px] font-semibold text-[#8B4B1E]">
          {actionError}
        </div>
      ) : null}

      {enableDropUpload && isDraggingFilesOver ? (
        <div className="border-b border-[#E9DBD3] bg-[#EEF3DF] px-6 py-3 text-[14px] font-extrabold uppercase tracking-[0.12em] text-[#5C3A26]">
          Drop files here to attach them to this group chat
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-5 xl:px-6 xl:py-5"
      >
        <div className="min-h-full">
          {isLoading ? (
            <ChatMessagesSkeleton />
          ) : messages.length === 0 ? (
            <GroupChatEmptyState />
          ) : (
            <>
              <div className="pb-3 pt-1">
                {messages.map((message, index) => {
                  const messageMember = resolveGroupMessageMember(message, members);
                  const isOwnMessage =
                    message.isCurrentUser === true || messageMember.isCurrentUser === true;
                  const showTodayDivider = shouldShowTodayDivider(messages, index);
                  const showSenderIdentity = shouldStartGroupMessageSequence(
                    messages,
                    index,
                    members,
                  );
                  const spacingClass =
                    index === 0 ? "" : showSenderIdentity ? "mt-3.5" : "mt-0.5";

                  return (
                    <div
                      key={message.id}
                      ref={(element) => registerMessageElement(message.id, element)}
                      className={`${spacingClass} rounded-[20px] transition-[background-color,box-shadow] duration-300 ${
                        highlightedMessageId === message.id
                          ? "bg-[color:var(--chat-highlight-bg)] shadow-[0_0_0_2px_var(--chat-highlight-ring)]"
                          : ""
                      }`}
                    >
                      {showTodayDivider ? <TodayDivider /> : null}
                      <ChatThreadMessage
                        align={isOwnMessage ? "right" : "left"}
                        label={
                          showSenderIdentity
                            ? (isOwnMessage ? "You" : messageMember.name)
                            : null
                        }
                        maxWidth={
                          isOwnMessage
                            ? "max-w-[72%] xl:max-w-[600px]"
                            : "max-w-[72%] xl:max-w-[600px]"
                        }
                        timestamp={formatMessageTimestamp(message.createdAt)}
                        status={
                          isOwnMessage ? (message.isPending ? "sending" : "sent") : null
                        }
                        replyTo={message.replyTo ?? null}
                        onReplyQuoteClick={
                          message.replyTo ? () => jumpToMessage(message.replyTo!.id) : undefined
                        }
                        showTail={showSenderIdentity}
                        showAvatar={showSenderIdentity && !isOwnMessage}
                        avatarInitial={
                          showSenderIdentity && !isOwnMessage
                            ? messageMember.initial
                            : undefined
                        }
                        avatarUrl={
                          showSenderIdentity && !isOwnMessage
                            ? (messageMember.avatarUrl ?? null)
                            : undefined
                        }
                        avatarColor={
                          showSenderIdentity && !isOwnMessage
                            ? messageMember.badgeColor
                            : undefined
                        }
                        avatarTextColor={
                          showSenderIdentity && !isOwnMessage
                            ? (messageMember.badgeTextColor ?? "#000000")
                            : undefined
                        }
                        onAvatarClick={
                          showSenderIdentity && !isOwnMessage
                            ? () => onOpenMemberPreview(buildMemberPreview(messageMember))
                            : undefined
                        }
                        onReply={() => onReplyToMessage(message)}
                      >
                        {message.text ? (
                          <MessageText text={message.text} isOwnMessage={isOwnMessage} />
                        ) : null}
                        <MessageAttachments
                          attachments={message.attachments}
                          hasText={Boolean(message.text)}
                          isOwnMessage={isOwnMessage}
                        />
                      </ChatThreadMessage>
                    </div>
                  );
                })}
              </div>
              {shouldShowJumpToLatestButton ? (
                <JumpToLatestButton onClick={() => scrollToBottom("smooth")} />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#E9DBD3] bg-white">
        <ComposerBox
          placeholder="Send your message to this group chat..."
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={onSubmit}
          isSending={isSending}
          onAttachClick={onAttachClick}
          attachments={pendingAttachments}
          onRemoveAttachment={onRemovePendingAttachment}
          replyPreview={pendingReplyMessage}
          onClearReply={onClearReplyMessage}
          editingMessage={editingMessage}
          onCancelEditing={onCancelEditingMessage}
        />
      </div>
    </div>
  );
}

function DirectMessagesPanel({
  conversationName,
  messages,
  isLoading,
  error,
  actionError,
  draft,
  onDraftChange,
  onSend,
  isSending,
  currentUserId,
  currentUserEmail,
  onAttachClick,
  pendingReplyMessage,
  onReplyToMessage,
  onClearReplyMessage,
  editingMessage,
  onCancelEditingMessage,
  viewportKey,
  unreadAnchorMessageId,
  scrollTopCacheRef,
}: {
  conversationName: string;
  messages: ApiMessageRecord[];
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  currentUserId: string | null;
  currentUserEmail: string | null;
  onAttachClick: () => void;
  pendingReplyMessage: ApiMessageReplyRecord | null;
  onReplyToMessage: (message: ApiMessageRecord) => void;
  onClearReplyMessage: () => void;
  editingMessage: EditingMessageDraft | null;
  onCancelEditingMessage: () => void;
  viewportKey: string | null;
  unreadAnchorMessageId: string | null;
  scrollTopCacheRef: { current: Record<string, number> };
}) {
  const lastMessage = messages[messages.length - 1] ?? null;
  const forceScrollToken =
    lastMessage &&
    resolveIsOwnMessage(lastMessage, currentUserId, currentUserEmail)
      ? lastMessage.id
      : null;
  const { bottomOffset, scrollContainerRef, scrollToBottom } = useMessageListAutoScroll({
    firstMessageId: messages[0]?.id ?? null,
    lastMessageId: lastMessage?.id ?? null,
    messageCount: messages.length,
    isLoading,
    forceScrollToken,
    manageInitialViewportExternally: true,
  });
  const { highlightedMessageId, jumpToMessage, registerMessageElement, scrollToMessage } =
    useMessageJumpNavigation(scrollContainerRef);
  useMessageViewportRestore({
    contextKey: viewportKey,
    unreadAnchorMessageId,
    isLoading,
    messageCount: messages.length,
    scrollContainerRef,
    scrollToBottom,
    scrollToMessage,
    scrollTopCacheRef,
  });
  const shouldShowJumpToLatestButton =
    messages.length > 0 && bottomOffset > MESSAGE_LIST_JUMP_BUTTON_THRESHOLD;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="border-b border-[#F0E5DF] bg-[#FFF5EE] px-6 py-3 text-[14px] font-semibold text-[#8B4B1E]">
          {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="border-b border-[#F0E5DF] bg-[#FFF9F5] px-6 py-3 text-[14px] font-semibold text-[#8B4B1E]">
          {actionError}
        </div>
      ) : null}

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
      >
        {isLoading ? (
          <ChatMessagesSkeleton />
        ) : messages.length === 0 ? (
          <div className="rounded-[28px] bg-[#FCF8F6] px-6 py-6 text-[18px] leading-8 text-[#7E6E66]">
            No messages are available in {conversationName} yet.
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = resolveIsOwnMessage(
                message,
                currentUserId,
                currentUserEmail,
              );
              const align = isOwnMessage ? "right" : "left";
              const showTodayDivider = shouldShowTodayDivider(messages, index);
              const startsNewSequence = shouldStartDirectMessageSequence(
                messages,
                index,
                currentUserId,
                currentUserEmail,
              );
              const spacingClass =
                index === 0 ? "" : startsNewSequence ? "mt-3.5" : "mt-0.5";

              return (
                <div
                  key={message.id || `${message.senderName}-${index}`}
                  ref={(element) => {
                    if (!message.id) return;
                    registerMessageElement(message.id, element);
                  }}
                  className={`${spacingClass} rounded-[20px] transition-[background-color,box-shadow] duration-300 ${
                    highlightedMessageId === message.id
                      ? "bg-[color:var(--chat-highlight-bg)] shadow-[0_0_0_2px_var(--chat-highlight-ring)]"
                      : ""
                  }`}
                >
                  {showTodayDivider ? <TodayDivider /> : null}
                  <ChatThreadMessage
                    align={align}
                    label={null}
                    maxWidth={
                      isOwnMessage
                        ? "max-w-[70%] xl:max-w-[560px]"
                        : "max-w-[70%] xl:max-w-[560px]"
                    }
                    timestamp={formatMessageTimestamp(message.createdAt)}
                    status={isOwnMessage ? "sent" : null}
                    replyTo={message.replyTo ?? null}
                    onReplyQuoteClick={
                      message.replyTo ? () => jumpToMessage(message.replyTo!.id) : undefined
                    }
                    showTail
                    showAvatar={false}
                    onReply={() => onReplyToMessage(message)}
                  >
                    {message.text ? (
                      <MessageText text={message.text} isOwnMessage={isOwnMessage} />
                    ) : null}
                    <MessageAttachments
                      attachments={message.attachments}
                      hasText={Boolean(message.text)}
                      isOwnMessage={isOwnMessage}
                    />
                  </ChatThreadMessage>
                </div>
              );
            })}
            {shouldShowJumpToLatestButton ? (
              <JumpToLatestButton onClick={() => scrollToBottom("smooth")} />
            ) : null}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-[#E9DBD3] bg-white">
        <ComposerBox
          placeholder={`Message ${conversationName}`}
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={onSend}
          isSending={isSending}
          onAttachClick={onAttachClick}
          replyPreview={pendingReplyMessage}
          onClearReply={onClearReplyMessage}
          editingMessage={editingMessage}
          onCancelEditing={onCancelEditingMessage}
          variant="direct"
        />
      </div>
    </div>
  );
}

type MessageReceiptStatus = "sending" | "sent" | "read";

function MessageBubble({
  align,
  label,
  maxWidth,
  timestamp,
  status,
  replyTo,
  onReplyQuoteClick,
  onReply,
  showTail = false,
  children,
}: {
  align: "left" | "right";
  label?: string | null;
  maxWidth: string;
  timestamp?: string;
  status?: MessageReceiptStatus | null;
  replyTo?: ApiMessageReplyRecord | null;
  onReplyQuoteClick?: () => void;
  onReply?: () => void;
  showTail?: boolean;
  children: ReactNode;
}) {
  const isRight = align === "right";
  const hasHeaderContent = Boolean(label) || Boolean(onReply);
  const bubbleStyle = {
    backgroundColor: isRight ? "var(--chat-own-bg)" : "var(--chat-incoming-bg)",
    color: isRight ? "var(--chat-own-text)" : "var(--chat-incoming-text)",
    borderColor: isRight ? "var(--chat-own-border)" : "var(--chat-incoming-border)",
    "--bubble-color": isRight ? "var(--chat-own-bg)" : "var(--chat-incoming-bg)",
  } as CSSProperties;
  const hasMeta = Boolean(timestamp) || Boolean(status);

  return (
    <div className={`${maxWidth} w-fit`}>
      <div
        className={`relative border px-3.5 py-2 text-[15px] font-medium leading-[1.4] tracking-[-0.01em] sm:px-4 sm:py-2.5 sm:text-[15px] xl:text-[15.5px] ${
          isRight
            ? "rounded-[18px] rounded-br-[6px] shadow-[0_2px_8px_rgba(20,40,80,0.12)]"
            : "rounded-[18px] rounded-bl-[6px] shadow-[0_2px_8px_rgba(20,30,50,0.06)]"
        } ${
          showTail
            ? isRight
              ? "after:pointer-events-none after:absolute after:right-[-6px] after:bottom-[6px] after:h-[12px] after:w-[12px] after:content-[''] after:[background:var(--bubble-color)] after:[clip-path:polygon(0_0,_100%_100%,_0_100%)]"
              : "after:pointer-events-none after:absolute after:left-[-6px] after:bottom-[6px] after:h-[12px] after:w-[12px] after:content-[''] after:[background:var(--bubble-color)] after:[clip-path:polygon(100%_0,_100%_100%,_0_100%)]"
            : ""
        }`}
        style={bubbleStyle}
      >
        {hasHeaderContent ? (
          <div
            className={`mb-1 flex items-start gap-2 ${
              isRight ? "flex-row-reverse justify-between text-right" : "justify-between text-left"
            }`}
          >
            <div className={`min-w-0 ${isRight ? "items-end" : "items-start"} flex flex-col`}>
              {label ? (
                <span
                  className="block text-[11px] font-semibold leading-none tracking-[-0.01em]"
                  style={{
                    color: isRight ? "var(--chat-own-meta)" : "var(--chat-incoming-link)",
                  }}
                >
                  {label}
                </span>
              ) : null}
            </div>
            {onReply ? (
              <button
                type="button"
                onClick={onReply}
                className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
                style={{ color: "currentColor" }}
                aria-label={`Reply to ${label ?? "message"}`}
              >
                <Reply className="h-3.5 w-3.5" strokeWidth={2.1} />
              </button>
            ) : null}
          </div>
        ) : null}
        {replyTo ? (
          <MessageReplyQuote
            replyTo={replyTo}
            isRight={isRight}
            onClick={onReplyQuoteClick}
          />
        ) : null}
        <div>{children}</div>
        {hasMeta ? (
          <div
            className={`mt-1 flex items-center gap-1 ${
              isRight ? "justify-end" : "justify-start"
            }`}
          >
            {timestamp ? (
              <span
                className="text-[10px] font-medium tracking-[0.01em] sm:text-[11px]"
                style={{
                  color: isRight ? "var(--chat-own-meta)" : "var(--chat-incoming-meta)",
                }}
              >
                {timestamp}
              </span>
            ) : null}
            {status ? <MessageReceiptIndicator status={status} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageReceiptIndicator({ status }: { status: MessageReceiptStatus }) {
  if (status === "sending") {
    return (
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 16 16"
        fill="none"
        aria-label="Sending"
        style={{ color: "var(--chat-own-meta)" }}
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v3l2 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  const isRead = status === "read";

  return (
    <svg
      className="h-3.5 w-4"
      viewBox="0 0 20 16"
      fill="none"
      aria-label={isRead ? "Read" : "Sent"}
      style={{ color: isRead ? "var(--chat-receipt-read)" : "var(--chat-receipt)" }}
    >
      <path
        d="M2 8.5L5.5 12L12 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isRead ? (
        <path
          d="M8 11.4L8.8 12L15.3 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function ChatThreadMessage({
  align,
  label,
  maxWidth,
  timestamp,
  status,
  replyTo,
  onReplyQuoteClick,
  showAvatar = true,
  showTail,
  avatarInitial,
  avatarUrl,
  avatarColor,
  avatarTextColor,
  onAvatarClick,
  onReply,
  children,
}: {
  align: "left" | "right";
  label?: string | null;
  maxWidth: string;
  timestamp?: string;
  status?: MessageReceiptStatus | null;
  replyTo?: ApiMessageReplyRecord | null;
  onReplyQuoteClick?: () => void;
  showAvatar?: boolean;
  showTail?: boolean;
  avatarInitial?: string;
  avatarUrl?: string | null;
  avatarColor?: string;
  avatarTextColor?: string;
  onAvatarClick?: () => void;
  onReply?: () => void;
  children: ReactNode;
}) {
  const isRight = align === "right";
  const AvatarTag = onAvatarClick ? "button" : "div";
  const hasAvatar =
    showAvatar &&
    Boolean(avatarInitial) &&
    Boolean(avatarColor) &&
    Boolean(avatarTextColor);
  const shouldShowTail = showTail ?? showAvatar;

  return (
    <div className={`flex w-full ${isRight ? "justify-end pr-1 sm:pr-2" : "justify-start"}`}>
      <div
        className={`relative ${maxWidth} ${
          hasAvatar
            ? isRight
              ? "mr-0 pr-11 pt-1 sm:pr-12"
              : "ml-0 pl-11 pt-1 sm:pl-12"
            : isRight
              ? "mr-1"
              : "ml-0"
        }`}
      >
        <MessageBubble
          align={align}
          label={label}
          maxWidth="max-w-full"
          timestamp={timestamp}
          status={status}
          replyTo={replyTo}
          onReplyQuoteClick={onReplyQuoteClick}
          onReply={onReply}
          showTail={shouldShowTail}
        >
          {children}
        </MessageBubble>
        {hasAvatar ? (
          <AvatarTag
            {...(onAvatarClick ? { type: "button" as const, onClick: onAvatarClick } : {})}
            className={`absolute bottom-0 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[14px] font-bold shadow-[0_2px_8px_rgba(20,30,50,0.12)] sm:h-9 sm:w-9 sm:text-[15px] ${
              isRight ? "right-0" : "left-0"
            }`}
            style={{
              backgroundColor: avatarColor,
              color: avatarTextColor,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              avatarInitial
            )}
          </AvatarTag>
        ) : null}
      </div>
    </div>
  );
}

function resolveIsOwnMessage(
  message: ApiMessageRecord,
  currentUserId: string | null,
  currentUserEmail: string | null,
) {
  if (message.isOwn !== null) {
    return message.isOwn;
  }

  if (currentUserId && message.senderId === currentUserId) {
    return true;
  }

  if (
    currentUserEmail &&
    message.senderEmail &&
    message.senderEmail.toLowerCase() === currentUserEmail.toLowerCase()
  ) {
    return true;
  }

  return false;
}

function TodayDivider() {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="h-px flex-1" style={{ backgroundColor: "var(--chat-divider-line)" }} />
      <span
        className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{
          color: "var(--chat-divider-text)",
          backgroundColor: "var(--chat-attachment-bg)",
        }}
      >
        Today
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: "var(--chat-divider-line)" }} />
    </div>
  );
}

function JumpToLatestButton({
  onClick,
  mobile = false,
}: {
  onClick: () => void;
  mobile?: boolean;
}) {
  return (
    <div className={`sticky z-10 flex justify-end ${mobile ? "bottom-3 pr-1" : "bottom-4 pr-2"}`}>
      <button
        type="button"
        onClick={() => onClick()}
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_12px_28px_rgba(71,49,34,0.22)] transition hover:bg-[#5C3A26]"
        aria-label="Jump to latest message"
      >
        <ArrowDown className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </div>
  );
}

type AttachmentKind = "image" | "video" | "file";

function getAttachmentKind(attachment: ApiAttachmentRecord): AttachmentKind {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  const source = (attachment.url ?? attachment.name ?? "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)(\?|#|$)/.test(source)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/.test(source)) return "video";
  return "file";
}

function formatAttachmentKindLabel(kind: AttachmentKind, name: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() : null;
  if (extension && extension.length <= 5) return extension;
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  return "File";
}

/**
 * Renders the media that belongs to a message. Images and videos are shown
 * inline; everything else falls back to a tappable file card. Attachments that
 * are still uploading (no resolved URL yet) render a lightweight placeholder so
 * the optimistic bubble doesn't look empty.
 */
function MessageAttachments({
  attachments,
  hasText,
  isOwnMessage,
}: {
  attachments: ApiAttachmentRecord[];
  hasText: boolean;
  isOwnMessage: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${hasText ? "mt-2.5" : ""}`}>
      {attachments.map((attachment) => (
        <MessageAttachment
          key={attachment.id}
          attachment={attachment}
          isOwnMessage={isOwnMessage}
        />
      ))}
    </div>
  );
}

function MessageAttachment({
  attachment,
  isOwnMessage,
}: {
  attachment: ApiAttachmentRecord;
  isOwnMessage: boolean;
}) {
  const kind = getAttachmentKind(attachment);
  const url = attachment.url ?? null;
  const displayName = (attachment.name ?? "Attachment").replace(/_/g, " ");
  const isUploading = !url;

  if (kind === "image") {
    const image = (
      <img
        src={url ?? undefined}
        alt={displayName}
        loading="lazy"
        className="max-h-[320px] w-full max-w-[260px] rounded-[14px] object-cover"
      />
    );

    return (
      <div className="overflow-hidden rounded-[14px]">
        {isUploading ? (
          <div className="flex h-[180px] w-[260px] items-center justify-center rounded-[14px] bg-black/10">
            <Loader2 className="h-5 w-5 animate-spin opacity-70" />
          </div>
        ) : (
          <a href={url ?? undefined} target="_blank" rel="noreferrer noopener">
            {image}
          </a>
        )}
      </div>
    );
  }

  if (kind === "video" && !isUploading) {
    return (
      <video
        src={url ?? undefined}
        controls
        preload="metadata"
        className="max-h-[320px] w-full max-w-[300px] rounded-[14px] bg-black"
      />
    );
  }

  const card = (
    <div
      className="flex items-center gap-3 rounded-[12px] border px-3 py-2.5"
      style={{
        backgroundColor: "var(--chat-attachment-bg)",
        borderColor: "var(--chat-attachment-border)",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]"
        style={{ backgroundColor: "var(--chat-incoming-link)", color: "#ffffff" }}
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" strokeWidth={2.1} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className="max-w-[180px] truncate text-[13px] font-semibold leading-tight"
          style={{ color: "var(--chat-attachment-title)" }}
        >
          {displayName}
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "var(--chat-attachment-sub)" }}
        >
          {isUploading ? "Uploading…" : formatAttachmentKindLabel(kind, attachment.name ?? "")}
        </span>
      </span>
    </div>
  );

  if (isUploading || !url) {
    return card;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="block transition hover:opacity-90"
      aria-label={`Open ${displayName}`}
    >
      {card}
    </a>
  );
}

function MessageTextBody({
  text,
  linkClassName,
  linkColor,
}: {
  text: string;
  linkClassName: string;
  linkColor?: string;
}) {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIndex) => {
        const matches = Array.from(line.matchAll(MESSAGE_LINK_PATTERN));
        let lastIndex = 0;

        return (
          <Fragment key={`line-${lineIndex}`}>
            {matches.map((match, matchIndex) => {
              const rawLink = match[0];
              const matchStart = match.index ?? 0;

              const leadingText =
                matchStart > lastIndex ? line.slice(lastIndex, matchStart) : null;
              const { normalizedLink, trailingCharacters } =
                splitLinkFromTrailingPunctuation(rawLink);
              lastIndex = matchStart + rawLink.length;

              return (
                <Fragment key={`link-${lineIndex}-${matchIndex}-${matchStart}`}>
                  {leadingText}
                  {normalizedLink ? (
                    <a
                      href={normalizeMessageLinkHref(normalizedLink)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={linkClassName}
                      style={linkColor ? { color: linkColor } : undefined}
                    >
                      {normalizedLink}
                    </a>
                  ) : null}
                  {trailingCharacters}
                </Fragment>
              );
            })}
            {lastIndex < line.length ? line.slice(lastIndex) : null}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </Fragment>
        );
      })}
    </>
  );
}

function MessageText({
  text,
  isOwnMessage,
}: {
  text: string;
  isOwnMessage: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isCollapsible = text.trim().length > MESSAGE_READ_MORE_CHARACTER_LIMIT;

  const collapsedStyles: CSSProperties | undefined =
    !isExpanded && isCollapsible
      ? {
          display: "-webkit-box",
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: MESSAGE_COLLAPSED_LINE_COUNT,
        }
      : undefined;

  const toggleExpandedMessage = () => {
    const messageContainer = containerRef.current;
    const scrollContainer = messageContainer
      ? findScrollableAncestor(messageContainer)
      : null;
    const previousTopOffset = messageContainer?.getBoundingClientRect().top ?? null;

    setIsExpanded((currentValue) => !currentValue);

    if (!messageContainer || !scrollContainer || previousTopOffset === null) {
      return;
    }

    requestAnimationFrame(() => {
      const nextTopOffset = messageContainer.getBoundingClientRect().top;
      scrollContainer.scrollTop += nextTopOffset - previousTopOffset;
    });
  };

  return (
    <div ref={containerRef}>
      <div
        style={{
          ...collapsedStyles,
          color: isOwnMessage ? "var(--chat-own-text)" : "var(--chat-incoming-text)",
        }}
        className="break-words text-[14px] leading-[1.45] sm:text-[15px]"
      >
        <MessageTextBody
          text={text}
          linkClassName="break-all font-semibold underline underline-offset-2"
          linkColor={isOwnMessage ? "var(--chat-own-link)" : "var(--chat-incoming-link)"}
        />
      </div>
      {isCollapsible && !isExpanded ? (
        <button
          type="button"
          onClick={toggleExpandedMessage}
          className="mt-2 text-[12px] font-semibold tracking-[0.01em] underline-offset-2 hover:underline"
          style={{
            color: isOwnMessage ? "var(--chat-own-link)" : "var(--chat-incoming-link)",
          }}
        >
          Read more
        </button>
      ) : null}
    </div>
  );
}

function ChatSendIcon({ className }: { className?: string }) {
  return <CornerDownRight className={className} strokeWidth={2.2} />;
}

function useAutoResizingTextarea(
  value: string | undefined,
  minHeight: number,
  maxHeight: number,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = `${minHeight}px`;
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight,
    );
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, minHeight, value]);

  return textareaRef;
}

function ComposerBox({
  placeholder,
  draft,
  onDraftChange,
  onSubmit,
  isSending = false,
  onAttachClick,
  attachments = [],
  onRemoveAttachment,
  replyPreview,
  onClearReply,
  editingMessage,
  onCancelEditing,
  variant = "group",
}: {
  placeholder: string;
  draft?: string;
  onDraftChange?: (value: string) => void;
  onSubmit?: () => void;
  isSending?: boolean;
  onAttachClick?: () => void;
  attachments?: ApiAttachmentRecord[];
  onRemoveAttachment?: (attachmentId: string) => void;
  replyPreview?: ApiMessageReplyRecord | null;
  onClearReply?: () => void;
  editingMessage?: EditingMessageDraft | null;
  onCancelEditing?: () => void;
  variant?: "group" | "direct";
}) {
  const textareaRef = useAutoResizingTextarea(draft, 24, 160);

  if (variant === "direct") {
    return (
      <div className="px-4 pb-5 pt-4 xl:px-5">
        <div className="rounded-[26px] border border-[#E4D5C8] bg-[linear-gradient(180deg,#FBF6F1_0%,#F2E8DF_100%)] px-5 py-4 shadow-[0_20px_40px_rgba(92,58,38,0.14)] ring-1 ring-white/70 sm:rounded-[34px] sm:px-8 sm:py-5">
          {editingMessage ? (
            <EditMessagePreviewCard
              editingMessage={editingMessage}
              onCancel={onCancelEditing}
            />
          ) : null}
          {replyPreview ? (
            <ReplyPreviewCard replyPreview={replyPreview} onClear={onClearReply} />
          ) : null}
          <div className={`flex items-end gap-3 ${editingMessage || replyPreview ? "mt-3" : ""}`}>
            {/* File upload button is temporarily disabled.
            <button
              type="button"
              onClick={onAttachClick}
              disabled={Boolean(editingMessage)}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-[#8A5A38] transition-colors hover:text-[#6A4227] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Open file upload"
            >
              <Plus className="h-5 w-5" strokeWidth={2.2} />
            </button>
            */}
            <div className="flex min-h-[24px] flex-1 items-center py-1">
              <textarea
                ref={textareaRef}
                value={draft ?? ""}
                onChange={(event) => onDraftChange?.(event.target.value)}
                onKeyDown={(event) => handleComposerKeyDown(event, onSubmit)}
                rows={1}
                placeholder={placeholder}
                className="block w-full resize-none overflow-hidden bg-transparent px-1 text-[15px] font-medium leading-[1.45] tracking-[-0.03em] text-[#5C3A26] placeholder:font-medium placeholder:text-[#786A63] focus:outline-none sm:text-[16px]"
              />
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSending || !(draft ?? "").trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_10px_20px_rgba(92,58,38,0.22)] transition-colors disabled:opacity-40"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ChatSendIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-5 pt-4 xl:px-5">
      <div className="rounded-[26px] border border-[#E4D5C8] bg-[linear-gradient(180deg,#FBF6F1_0%,#F2E8DF_100%)] px-5 pb-4 pt-4 shadow-[0_20px_40px_rgba(92,58,38,0.14)] ring-1 ring-white/70 sm:rounded-[34px] sm:px-8 sm:pb-5 sm:pt-5">
        {editingMessage ? (
          <EditMessagePreviewCard
            editingMessage={editingMessage}
            onCancel={onCancelEditing}
          />
        ) : null}
        {replyPreview ? (
          <ReplyPreviewCard replyPreview={replyPreview} onClear={onClearReply} />
        ) : null}
        {attachments.length > 0 ? (
          <div className={`${replyPreview ? "mt-3" : "mb-4"} flex flex-wrap gap-2`}>
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => onRemoveAttachment?.(attachment.id)}
                className="inline-flex items-center gap-2 rounded-full border border-[#E4D5C8] bg-white px-3 py-2 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#5C3A26] shadow-[0_10px_18px_rgba(71,49,34,0.08)]"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="max-w-[180px] truncate">{attachment.name}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        ) : null}
        <div className={`${editingMessage || replyPreview || attachments.length > 0 ? "mt-3" : ""} flex items-end gap-3`}>
          <button
            type="button"
            onClick={onAttachClick}
            disabled={Boolean(editingMessage)}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-[#8A5A38] transition-colors hover:text-[#6A4227] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Add attachment"
          >
            <Plus className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <div className="flex min-h-[24px] flex-1 items-center py-1">
            {onDraftChange ? (
              <textarea
                ref={textareaRef}
                value={draft ?? ""}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => handleComposerKeyDown(event, onSubmit)}
                rows={1}
                placeholder={placeholder}
                className="block w-full resize-none overflow-hidden bg-transparent px-1 text-[15px] font-medium leading-[1.45] tracking-[-0.03em] text-[#5C3A26] placeholder:font-medium placeholder:text-[#786A63] focus:outline-none sm:text-[16px]"
              />
            ) : (
              <p className="px-1 text-[15px] font-medium leading-[1.45] tracking-[-0.03em] text-[#786A63] sm:text-[16px]">
                {placeholder}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={
              Boolean(onDraftChange) &&
              (isSending || (!(draft ?? "").trim() && attachments.length === 0))
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6A4227] text-white shadow-[0_10px_20px_rgba(92,58,38,0.22)] transition-colors disabled:opacity-40"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ChatSendIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageReplyQuote({
  replyTo,
  isRight,
  onClick,
}: {
  replyTo: ApiMessageReplyRecord;
  isRight: boolean;
  onClick?: () => void;
}) {
  const interactiveProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: (event: { target: EventTarget | null }) => {
          const target = event.target as HTMLElement;
          if (target.closest("a")) return;
          onClick();
        },
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onClick();
        },
      }
    : {};

  return (
    <div
      {...interactiveProps}
      className={`mb-3 w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border-l-4 px-3 py-3 ${
        isRight
          ? "border-[#F3D2BF] bg-[rgba(255,255,255,0.12)]"
          : "border-[#F68B1F] bg-[#F6ECE5]"
      } ${onClick ? "cursor-pointer transition hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-[#F68B1F]/35" : ""}`}
    >
      <p
        className={`max-w-full break-all text-[11px] font-extrabold tracking-[0.02em] ${
          isRight ? "text-[#FFF0E8]" : "text-[#A45515]"
        }`}
      >
        {replyTo.senderName}
      </p>
      <p
        className={`mt-1 max-w-full overflow-hidden break-words text-[12px] leading-[1.35] ${
          isRight ? "text-[#F8EEEA]" : "text-[#7A6457]"
        }`}
      >
        <MessageTextBody
          text={replyTo.text}
          linkClassName={
            isRight
              ? "break-all font-semibold text-[#FFF0E8] underline decoration-[#FFF0E8]/80 underline-offset-2"
              : "break-all font-semibold text-[#A45515] underline decoration-[#A45515]/80 underline-offset-2"
          }
        />
      </p>
    </div>
  );
}

function ReplyPreviewCard({
  replyPreview,
  onClear,
}: {
  replyPreview: ApiMessageReplyRecord;
  onClear?: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#E6D8CF] bg-white/80 px-4 py-3 shadow-[0_8px_18px_rgba(71,49,34,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6ECE5] text-[#8A5631]">
          <Reply className="h-4 w-4" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1 border-l-4 border-[#F68B1F] pl-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#A45515]">
            Replying to {replyPreview.senderName}
          </p>
          <p className="mt-1 truncate text-[13px] leading-[1.35] text-[#6D584B]">
            {replyPreview.text}
          </p>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full p-2 text-[#7F695D] transition hover:bg-[#F3E8E1]"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EditMessagePreviewCard({
  editingMessage,
  onCancel,
}: {
  editingMessage: EditingMessageDraft;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#E6D8CF] bg-white/80 px-4 py-3 shadow-[0_8px_18px_rgba(71,49,34,0.04)]">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6ECE5] text-[#8A5631]">
          <Pencil className="h-4 w-4" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1 border-l-4 border-[#A8704C] pl-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8A5631]">
            Editing message
          </p>
          <p className="mt-1 truncate text-[13px] leading-[1.35] text-[#6D584B]">
            {editingMessage.text}
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-full p-2 text-[#7F695D] transition hover:bg-[#F3E8E1]"
            aria-label="Cancel editing"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GroupMembersPanel({
  members,
  publicView,
  onOpenMemberPreview,
  onOpenDirectMessageFromGroup,
}: {
  members: GroupChatMemberProfile[];
  publicView: boolean;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onOpenDirectMessageFromGroup: (member: MemberPreview) => void;
}) {
  if (members.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <div className="max-w-[420px] rounded-[32px] border border-[#E9DBD3] bg-[#FCF8F6] px-8 py-10 text-center">
          <h3 className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
            Group Members
          </h3>
          <p className="mt-5 text-[18px] leading-[1.65] text-[#7E6E66]">
            No member data is available for this community yet.
          </p>
        </div>
      </div>
    );
  }

  const visibleMembers = dedupeGroupMembers(members);
  const displayedMemberCount = visibleMembers.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-3">
        <div className="flex items-center gap-3">
          <p className="text-[15px] font-extrabold text-[#1D1D1B]">
            Group Members
          </p>
          <span className="rounded-full bg-[#EEF2F6] px-3 py-1 text-[15px] font-extrabold text-[#1D1D1B]">
            {displayedMemberCount}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid content-start grid-cols-1 gap-x-8 gap-y-6 px-6 pb-8 pt-6 xl:grid-cols-2 xl:gap-x-10 xl:gap-y-8 xl:pb-10">
        {visibleMembers.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            publicView={publicView}
            onOpenMemberPreview={onOpenMemberPreview}
            onOpenDirectMessageFromGroup={onOpenDirectMessageFromGroup}
          />
        ))}
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  publicView,
  onOpenMemberPreview,
  onOpenDirectMessageFromGroup,
}: {
  member: GroupChatMemberProfile;
  publicView: boolean;
  onOpenMemberPreview: (member: MemberPreview) => void;
  onOpenDirectMessageFromGroup: (member: MemberPreview) => void;
}) {
  const preview = buildMemberPreview(member);

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <button
        onClick={() => onOpenMemberPreview(preview)}
        className="mt-1"
      >
        {member.avatarUrl ? (
          <div className="h-[50px] w-[50px] overflow-hidden rounded-xl bg-[#E4D5C7]">
            <img
              src={member.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <PortraitAvatar type={member.avatar} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold leading-none tracking-[-0.03em] text-[#1D1D1B] sm:text-[18px]">
              {member.name}
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#8A7D76] sm:text-[16px]">
              {member.description}
            </p>
          </div>
          <span className="shrink-0 text-[14px] font-semibold text-[#B1A5A0] sm:text-[16px]">
            {member.time}
          </span>
        </div>

        {publicView ? (
          <div className="mt-5 flex items-center gap-4">
            <span className="text-[24px] font-extrabold leading-none text-black sm:text-[28px]">X</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#0A66C2] text-[14px] font-extrabold text-white">
              in
            </span>
            <Link2 className="h-5 w-5 text-[#5C3A26]" />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenMemberPreview(preview)}
              className="rounded-full bg-[#FFF0DE] px-4 py-2 text-[16px] font-extrabold text-[#F6871C]"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => onOpenDirectMessageFromGroup(preview)}
              disabled={preview.isCurrentUser}
              className="rounded-full bg-[#D9F4D6] px-4 py-2 text-[16px] font-extrabold text-[#34A853] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Message
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PaginationPill({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-[16px] font-extrabold ${
        active
          ? "border-[#8F6448] bg-[#8F6448] text-white"
          : "border-[#8F6448] bg-transparent text-[#8F6448]"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyGroupsPanel({
  title,
  description,
  adminLinkVisible,
}: {
  title: string;
  description: string;
  adminLinkVisible: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="max-w-[480px] rounded-[32px] border border-[#E9DBD3] bg-[#FCF8F6] px-8 py-10 text-center">
        <h3 className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
          {title}
        </h3>
        <p className="mt-5 text-[18px] leading-[1.65] text-[#7E6E66]">
          {description}
        </p>
        {adminLinkVisible ? (
          <Link
            href="/dashboard/community"
            className="mt-8 inline-flex rounded-full bg-[#6A4227] px-6 py-4 text-[15px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#5E3A22]"
          >
            Open Admin Community Tools
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function EmptyMessagesPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="max-w-[480px] rounded-[32px] border border-[#E9DBD3] bg-[#FCF8F6] px-8 py-10 text-center">
        <h3 className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
          {title}
        </h3>
        <p className="mt-5 text-[18px] leading-[1.65] text-[#7E6E66]">
          {description}
        </p>
      </div>
    </div>
  );
}

function GuestRestrictionPanel() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="max-w-[420px] text-center">
        <div className="mx-auto w-[300px]">
          <RestrictedFeatureIllustration />
        </div>
        <h3 className="mt-8 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
          Access Restricted
        </h3>
        <p className="mt-5 text-[18px] leading-[1.65] text-[#7E6E66]">
          Group chats are only available to logged-in users. Sign up or log in
          to join the conversation
        </p>
      </div>
    </div>
  );
}

function SharedGroupDesktopRestrictionPanel({
  groupName,
  signupHref,
}: {
  groupName: string;
  signupHref: string;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto flex min-h-full max-w-[500px] items-start justify-center text-center">
        <div className="w-full">
          <div className="mx-auto w-full max-w-[260px] xl:max-w-[300px]">
          <RestrictedFeatureIllustration />
        </div>
          <p className="mt-6 text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#8F654B]">
            Shared Clique
          </p>
          <h3 className="mt-4 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-[#5C3A26]">
            Access Restricted
          </h3>
          <p className="mt-5 text-[18px] leading-[1.65] text-[#7E6E66]">
            Sign up or log in to access <span className="font-extrabold text-[#5C3A26]">{groupName}</span> and join the conversation.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={signupHref}
              className="inline-flex min-w-[170px] items-center justify-center rounded-full bg-[#6A4227] px-6 py-4 text-[15px] font-extrabold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#5E3A22]"
            >
              Sign Up
            </Link>
            <Link
              href="/signin"
              className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-[#D9C6BA] bg-white px-6 py-4 text-[15px] font-extrabold uppercase tracking-[0.14em] text-[#6A4227] transition-colors hover:bg-[#F7EFEA]"
            >
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SharedGroupPreviewPanel({
  group,
  onJoin,
}: {
  group: GroupRecord;
  onJoin: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <div className="w-full max-w-[560px]">
        <p className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.22em] text-[#8F654B]">
          Shared Clique
        </p>
        <div className="overflow-hidden rounded-[28px] border border-[#E9DBD3] bg-[#FCF8F6] shadow-[0_24px_48px_rgba(93,63,43,0.08)]">
          <div className="flex items-start gap-5 px-6 py-6">
            <div className="shrink-0">
              <GroupAvatar group={group} />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className="break-words text-[26px] font-extrabold leading-tight tracking-[-0.04em]"
                style={{ color: group.accent }}
              >
                {group.headerTitle}
              </p>
              <p className="mt-3 text-[18px] font-bold text-[#5E4F48]">
                {group.membersLabel}
              </p>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={onJoin}
                  className="rounded-full px-7 py-4 text-[18px] font-extrabold text-white"
                  style={{ backgroundColor: group.joinBackground }}
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-[460px] text-[15px] font-semibold leading-7 text-[#8B7E77]">
          Join this clique to create your account, then you&apos;ll be added automatically and taken straight into the community.
        </p>
      </div>
    </div>
  );
}

function PortraitAvatar({ type }: { type: "portrait-a" | "portrait-b" }) {
  if (type === "portrait-b") {
    return (
      <div className="h-[50px] w-[50px] overflow-hidden rounded-xl bg-[#E4D5C7]">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect width="100" height="100" fill="#D9C6B0" />
          <circle cx="53" cy="34" r="19" fill="#8D5C3F" />
          <path
            d="M20 86c6-22 22-34 33-34 14 0 29 12 32 34H20Z"
            fill="#336B4C"
          />
          <path
            d="M37 56c8 4 19 4 28 0l-4 18H41l-4-18Z"
            fill="#F0C39B"
          />
          <ellipse cx="50" cy="39" rx="17" ry="19" fill="#F0C39B" />
          <path
            d="M31 35c10-17 34-19 40 1-10-5-25-4-40-1Z"
            fill="#3C2A21"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="h-[50px] w-[50px] overflow-hidden rounded-xl bg-[#DFE5F0]">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <rect width="100" height="100" fill="#D8DFEA" />
        <circle cx="50" cy="33" r="18" fill="#D7A47A" />
        <path d="M24 89c3-20 19-31 26-31h2c8 0 24 11 25 31H24Z" fill="#20242C" />
        <path
          d="M31 28c1-15 14-21 26-21 15 0 23 10 23 24-12-7-35-8-49-3Z"
          fill="#272B34"
        />
      </svg>
    </div>
  );
}

function SelfPortraitAvatar() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <rect width="100" height="100" rx="50" fill="#E9D3B3" />
      <path
        d="M18 94c5-24 20-36 32-36h4c12 0 28 12 31 36H18Z"
        fill="#F7F0E7"
      />
      <path d="M38 57c7 5 17 5 24 0l-3 15H41l-3-15Z" fill="#B87350" />
      <ellipse cx="50" cy="40" rx="18" ry="20" fill="#B87350" />
      <path d="M30 38c0-18 13-29 28-29 12 0 24 8 28 21-12-3-20-3-28-1-8 1-16 5-28 9Z" fill="#2D201A" />
      <path d="M29 40c4 16 15 29 21 29 11 0 22-13 25-29-5 5-10 7-23 7-9 0-18-3-23-7Z" fill="#B87350" />
    </svg>
  );
}

function RestrictedFeatureIllustration() {
  return (
    <Image
      src="/restricted.svg"
      alt="Restricted access illustration"
      width={300}
      height={263}
      className="h-auto w-full"
    />
  );
}

function ConfirmChoiceIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-auto w-[220px]">
      <path
        d="M46 110c0-52 38-84 95-84 58 0 96 31 96 83 0 37-22 68-59 83H104C68 181 46 148 46 110Z"
        fill="#F3E8E3"
      />
      <ellipse cx="73" cy="85" rx="18" ry="11" fill="#EADFD9" transform="rotate(-34 73 85)" />
      <ellipse cx="225" cy="79" rx="16" ry="10" fill="#EADFD9" transform="rotate(52 225 79)" />
      <path
        d="M74 194c6-34 31-57 66-57 36 0 60 22 65 57H74Z"
        fill="#A7BC6A"
      />
      <path d="M131 127c8 5 20 5 28 0l-4 18h-20l-4-18Z" fill="#E59E68" />
      <ellipse cx="144" cy="101" rx="31" ry="37" fill="#E59E68" />
      <path
        d="M111 96c6-29 24-43 49-43 23 0 41 14 47 41-19-10-31-12-48-10-15 2-29 6-48 12Z"
        fill="#4A3226"
      />
      <path d="M133 80c0-13 9-24 23-24 10 0 20 7 23 19-9-2-17-2-23 0-8 2-15 4-23 5Z" fill="#4A3226" />
      <path
        d="M88 118c0-13 10-23 23-23 13 0 23 10 23 23 0 13-10 23-23 23-13 0-23-10-23-23Z"
        fill="#FFD26E"
        stroke="#4A3226"
        strokeWidth="6"
      />
      <path d="M111 118c0-10 8-18 18-18" stroke="#4A3226" strokeWidth="5" strokeLinecap="round" />
      <circle cx="120" cy="118" r="6" fill="#4A3226" />
      <path d="M130 105l11-10" stroke="#4A3226" strokeWidth="6" strokeLinecap="round" />
      <path d="M98 132 72 162" stroke="#4A3226" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function isAlreadyMemberJoinError(error: unknown) {
  const normalizedMessage =
    error instanceof ApiError
      ? error.message.trim().toLowerCase()
      : error instanceof Error
      ? error.message.trim().toLowerCase()
      : "";

  return (
    normalizedMessage.includes("already a member") ||
    normalizedMessage.includes("already joined") ||
    normalizedMessage.includes("member already exists") ||
    normalizedMessage.includes("already in this group")
  );
}

function normalizeJoinActionMessage(message: string) {
  const retryWindowMatch = message.match(/expected available in (\d+) seconds?/i);
  if (!retryWindowMatch) {
    return message;
  }

  const retryAfterSeconds = Number.parseInt(retryWindowMatch[1] ?? "", 10);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return message;
  }

  return `Too many join attempts. Please try again in ${formatRetryAfterDuration(
    retryAfterSeconds,
  )}.`;
}

function formatRetryAfterDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    seconds > 0 && hours === 0 ? `${seconds}s` : null,
  ].filter(Boolean);

  return parts.join(" ") || "a moment";
}
