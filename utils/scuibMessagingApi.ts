import type { ConversationRecord } from "@/types/dashboard";
import {
  ApiError,
  apiRequest,
  buildCloudinarySignedUploadRequest,
  buildDisplayName,
  logCloudinaryUploadFailure,
  extractArrayPayload,
  getNestedArray,
  getNestedRecord,
  isRecord,
  readBoolean,
  readMediaUrl,
  readNumber,
  readString,
  refreshAccessToken,
  type ApiRecord,
  type AuthTokens,
} from "@/utils/scuibApi";

const CONVERSATION_TONES = ["#F68B1F", "#6253F7", "#34C759", "#9BB168", "#D96C9C"];
const FILE_ONLY_MESSAGE_PLACEHOLDER = "[[SCUIB_FILE_ONLY_MESSAGE]]";
const REPLY_METADATA_PREFIX = "[[SCUIB_REPLY]]";

type ApiRequestInit = Omit<RequestInit, "body" | "headers"> & {
  auth?: Partial<AuthTokens> | null;
  body?: unknown;
  headers?: HeadersInit;
};

type AuthenticatedRequestInit = ApiRequestInit & {
  auth: Partial<AuthTokens>;
  onAuthRefresh?: (tokens: AuthTokens) => void;
};

const CONVERSATION_BASE_PATH_CANDIDATES = [
  "/api/v1/messages/conversations",
] as const;

let workingConversationBasePath: string | null = null;

function rememberWorkingConversationPath(path: string) {
  const matchedBasePath = CONVERSATION_BASE_PATH_CANDIDATES.find((candidate) =>
    path.startsWith(candidate),
  );

  if (matchedBasePath) {
    workingConversationBasePath = matchedBasePath;
  }
}

function buildConversationPaths(suffix = "/") {
  const candidateBasePaths = workingConversationBasePath
    ? [
        workingConversationBasePath,
        ...CONVERSATION_BASE_PATH_CANDIDATES.filter(
          (candidate) => candidate !== workingConversationBasePath,
        ),
      ]
    : [...CONVERSATION_BASE_PATH_CANDIDATES];

  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;

  return candidateBasePaths.map((basePath) =>
    normalizedSuffix === "/" ? `${basePath}/` : `${basePath}${normalizedSuffix}`,
  );
}

function getConversationCollectionPaths() {
  return buildConversationPaths("/");
}

function getConversationDetailPaths(conversationId: string) {
  return buildConversationPaths(`/${conversationId}/`);
}

function getConversationMessagePaths(conversationId: string) {
  return buildConversationPaths(`/${conversationId}/messages/`);
}

function getConversationUploadSignaturePaths() {
  return ["/api/v1/messages/upload-signature/"];
}

function getConversationSeenPaths(conversationId: string) {
  return buildConversationPaths(`/${conversationId}/seen/`);
}

function getUnreadConversationPaths() {
  return buildConversationPaths("/unread/");
}

function getDirectMessagePaths(userId: string) {
  return [`/api/v1/messages/dm/${userId}/`];
}

function getDirectMessageHistoryPaths(userId: string) {
  return [`/api/v1/messages/dm/${userId}/messages/`];
}

function getDirectMessageSeenPaths(userId: string) {
  return [`/api/v1/messages/dm/${userId}/seen/`];
}

function getMessageEditPaths(messageId: string) {
  return [`/api/v1/messages/messages/${messageId}/edit/`];
}

function getMessageDeletePaths(messageId: string) {
  return [`/api/v1/messages/messages/${messageId}/delete/`];
}

function getMessageReactionPaths(messageId: string) {
  return [`/api/v1/messages/messages/${messageId}/react/`];
}

function getMessageReactionsListPaths(messageId: string) {
  return [`/api/v1/messages/messages/${messageId}/reactions/`];
}

function getMessageReceiptsPaths(messageId: string) {
  return [`/api/v1/messages/messages/${messageId}/receipts/`];
}

export type ApiAttachmentRecord = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
  file?: File | null;
  uploadStatus?: "local" | "uploaded";
};

export type ApiConversationParticipantRecord = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
};

export type ApiConversationRecord = {
  id: string;
  name: string;
  preview: string;
  unreadCount: number;
  lastMessageAt: string | null;
  conversationType: string | null;
  participantId: string | null;
  participantName: string | null;
  participants: ApiConversationParticipantRecord[];
  groupId: string | null;
  groupSlug: string | null;
};

export type ApiMessageRecord = {
  id: string;
  text: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string | null;
  senderAvatarUrl?: string | null;
  createdAt: string | null;
  isOwn: boolean | null;
  attachments: ApiAttachmentRecord[];
  replyTo: ApiMessageReplyRecord | null;
};

export type ApiMessageReplyRecord = {
  id: string;
  senderName: string;
  text: string;
};

export type ApiPresenceRecord = {
  isOnline: boolean;
  lastSeen: string | null;
  status: string | null;
};

export type SendDirectMessageResult = {
  message: ApiMessageRecord;
  conversation: ApiConversationRecord | null;
  conversationId: string | null;
};

function extractRecordArray(source: unknown, keys: string[]): ApiRecord[] {
  const nestedArray = getNestedArray(source, keys);
  if (!nestedArray) {
    return [];
  }

  return nestedArray.filter(isRecord);
}

async function authenticatedApiRequest<T>(
  path: string,
  init: AuthenticatedRequestInit,
): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (
        error.status === 401 ||
        (
          error.status === 403 &&
          error.message.trim().toLowerCase().includes("token not valid")
        )
      ) &&
      init.auth.refreshToken
    ) {
      const refreshedTokens = await refreshAccessToken(init.auth.refreshToken);
      init.onAuthRefresh?.(refreshedTokens);

      return apiRequest<T>(path, {
        ...init,
        auth: refreshedTokens,
      });
    }

    throw error;
  }
}

async function authenticatedApiRequestWithFallbackPaths<T>(
  paths: string[],
  init: AuthenticatedRequestInit,
  onSuccessPath?: (path: string) => void,
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    try {
      const payload = await authenticatedApiRequest<T>(path, init);
      onSuccessPath?.(path);
      return payload;
    } catch (error) {
      lastError = error;

      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

async function authenticatedApiRequestWithBodyFallback<T>(
  paths: string[],
  bodies: unknown[],
  init: Omit<AuthenticatedRequestInit, "body">,
  onSuccessPath?: (path: string) => void,
  debugLabel?: string,
  fallbackStatusCodes: number[] = [400, 404, 422],
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    for (const body of bodies) {
      try {
        if (debugLabel) {
          console.debug(`[${debugLabel}] trying request`, {
            path,
            method: init.method ?? "GET",
            body,
          });
        }
        const payload = await authenticatedApiRequest<T>(path, {
          ...init,
          body,
        });
        if (debugLabel) {
          console.debug(`[${debugLabel}] request succeeded`, {
            path,
            method: init.method ?? "GET",
            body,
            payload,
          });
        }
        onSuccessPath?.(path);
        return payload;
      } catch (error) {
        lastError = error;
        const isRetryableFallbackError =
          error instanceof ApiError &&
          fallbackStatusCodes.includes(error.status);

        if (debugLabel) {
          const logMethod = isRetryableFallbackError ? console.debug : console.error;

          logMethod(`[${debugLabel}] request failed`, {
            path,
            method: init.method ?? "GET",
            body,
            error,
            status: error instanceof ApiError ? error.status : null,
            details: error instanceof ApiError ? error.details : null,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        if (isRetryableFallbackError) {
          continue;
        }

        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function parseUploadResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function stripAttachmentRuntimeFields(
  attachment: ApiAttachmentRecord,
): ApiAttachmentRecord {
  return {
    id: attachment.id,
    name: attachment.name,
    url: attachment.url,
    mimeType: attachment.mimeType,
    file: null,
    uploadStatus: "uploaded",
  };
}

function dedupeRequestBodies<T>(bodies: T[]) {
  const seenBodies = new Set<string>();

  return bodies.filter((body) => {
    const serializedBody = safeJsonStringify(body);

    if (seenBodies.has(serializedBody)) {
      return false;
    }

    seenBodies.add(serializedBody);
    return true;
  });
}

function normalizeAttachment(rawAttachment: unknown, index: number): ApiAttachmentRecord | null {
  if (typeof rawAttachment === "string") {
    const trimmedValue = rawAttachment.trim();
    if (!trimmedValue) return null;

    const normalizedName = trimmedValue.split("/").pop() ?? `Attachment ${index + 1}`;

    return {
      id: trimmedValue,
      name: normalizedName,
      url: trimmedValue,
      mimeType: null,
    };
  }

  if (!isRecord(rawAttachment)) return null;

  const id =
    readString(rawAttachment, ["id", "pk", "uuid", "key", "file_key", "public_id"]) ??
    `attachment-${index}`;
  const url = readString(rawAttachment, ["url", "file_url", "secure_url", "path"]);
  const name =
    readString(rawAttachment, ["name", "filename", "file_name", "title"]) ??
    url?.split("/").pop() ??
    `Attachment ${index + 1}`;

  return {
    id,
    name,
    url,
    mimeType: readString(rawAttachment, ["content_type", "mime_type", "type"]),
    file: null,
    uploadStatus: "uploaded",
  };
}

function normalizeTopLevelFileAttachment(
  rawMessage: ApiRecord,
  messageId: string,
): ApiAttachmentRecord | null {
  const fileUrl = readString(rawMessage, ["file_url", "secure_url", "url", "path"]);
  if (!fileUrl) return null;

  const attachmentName =
    readString(rawMessage, ["file_name", "filename", "name", "title"]) ??
    fileUrl.split("/").pop() ??
    "Attachment";

  return {
    id:
      readString(rawMessage, ["file_id", "attachment_id", "public_id", "key"]) ??
      `${messageId}-attachment`,
    name: attachmentName,
    url: fileUrl,
    mimeType: readString(rawMessage, ["content_type", "mime_type", "type"]),
    file: null,
    uploadStatus: "uploaded",
  };
}

function normalizeConversationMemberRecord(rawMember: unknown): ApiRecord | null {
  if (!isRecord(rawMember)) return null;

  const containerRecord =
    getNestedRecord(rawMember, [
      "user",
      "member",
      "participant",
      "profile",
      "account",
      "owner",
    ]) ?? rawMember;

  return (
    getNestedRecord(containerRecord, [
      "profile",
      "user",
      "account",
      "owner",
      "member",
      "participant",
    ]) ?? containerRecord
  );
}

function normalizeConversationParticipant(
  rawMember: unknown,
): ApiConversationParticipantRecord | null {
  const memberRecord = normalizeConversationMemberRecord(rawMember);
  if (!memberRecord) return null;

  const email =
    readString(memberRecord, ["email", "user_email", "member_email"]) ??
    readString(rawMember, ["email", "user_email", "member_email"]);
  const name =
    buildDisplayName(memberRecord) ??
    readString(rawMember, [
      "name",
      "full_name",
      "display_name",
      "fullName",
      "displayName",
      "username",
      "handle",
      "slug",
      "member_name",
      "memberName",
      "participant_name",
      "participantName",
    ]) ??
    email;
  const id =
    readString(memberRecord, ["id", "pk", "uuid", "user_id"]) ??
    readString(rawMember, ["id", "pk", "uuid", "user_id"]) ??
    email ??
    name;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    email: email ?? null,
    avatarUrl:
      readMediaUrl(memberRecord, [
        "avatar_url",
        "avatar",
        "profile_picture",
        "profile_image",
        "image_url",
        "image",
        "photo_url",
        "photo",
        "secure_url",
        "url",
      ]) ??
      readMediaUrl(rawMember, [
        "avatar_url",
        "avatar",
        "profile_picture",
        "profile_image",
        "image_url",
        "image",
        "photo_url",
        "photo",
        "secure_url",
        "url",
      ]) ??
      null,
  };
}

function dedupeConversationParticipants(
  participants: ApiConversationParticipantRecord[],
) {
  return Array.from(
    new Map(
      participants.map((participant) => {
        const normalizedId = participant.id.trim().toLowerCase();
        const normalizedEmail = participant.email?.trim().toLowerCase() ?? "";
        const normalizedName = participant.name.trim().toLowerCase();
        const dedupeKey =
          normalizedEmail || normalizedId || normalizedName || "participant";

        return [dedupeKey, participant];
      }),
    ).values(),
  );
}

function collectConversationMemberSources(rawConversation: ApiRecord) {
  const groupRecord = getNestedRecord(rawConversation, ["group", "community", "clique"]);

  return [
    ...extractRecordArray(rawConversation, ["participants", "members", "users"]),
    ...(groupRecord
      ? extractRecordArray(groupRecord, [
          "participants",
          "members",
          "users",
          "admins",
          "moderators",
        ])
      : []),
    getNestedRecord(rawConversation, ["owner"]),
    getNestedRecord(rawConversation, ["creator"]),
    getNestedRecord(rawConversation, ["admin"]),
    getNestedRecord(groupRecord, ["owner"]),
    getNestedRecord(groupRecord, ["creator"]),
    getNestedRecord(groupRecord, ["admin"]),
  ].filter((record): record is ApiRecord => Boolean(record));
}

function normalizeConversation(rawConversation: unknown): ApiConversationRecord | null {
  if (!isRecord(rawConversation)) return null;

  const id = readString(rawConversation, ["id", "pk", "uuid", "conversation_id"]);
  if (!id) return null;

  const conversationType = readString(rawConversation, ["type", "conversation_type", "kind"]);
  const description = readString(rawConversation, ["description", "bio", "about", "summary"]);
  const lastMessageRecord = getNestedRecord(rawConversation, [
    "last_message",
    "latest_message",
    "lastMessage",
  ]);
  const memberRecords = collectConversationMemberSources(rawConversation);
  const participants = dedupeConversationParticipants(
    memberRecords
    .map((memberRecord) => normalizeConversationParticipant(memberRecord))
    .filter(
      (participant): participant is ApiConversationParticipantRecord =>
        Boolean(participant),
    ),
  );
  const participantRecords = memberRecords
    .map((memberRecord) => normalizeConversationMemberRecord(memberRecord))
    .filter((memberRecord): memberRecord is ApiRecord => Boolean(memberRecord));
  const participantRecord =
    participantRecords.find(
      (candidate) =>
        Boolean(buildDisplayName(candidate) ?? readString(candidate, ["email"])),
    ) ?? null;
  const participantName =
    buildDisplayName(participantRecord) ??
    readString(participantRecord, ["email"]);
  const groupRecord = getNestedRecord(rawConversation, ["group", "community", "clique"]);
  const preview =
    readString(lastMessageRecord, ["content", "text", "message", "body"]) ??
    readString(rawConversation, ["preview", "snippet", "last_message_preview"]) ??
    (conversationType?.trim().toLowerCase() === "group" ? description : null) ??
    "No messages yet.";

  return {
    id,
    name:
      readString(rawConversation, ["name", "title", "subject"]) ??
      participantName ??
      `Conversation ${id}`,
    preview,
    unreadCount:
      readNumber(rawConversation, [
        "unread_count",
        "unread",
        "unread_messages",
        "unreadCount",
        "unseen_count",
        "unseen_messages",
        "message_unread_count",
        "new_messages_count",
      ]) ?? 0,
    lastMessageAt:
      readString(lastMessageRecord, [
        "created_at",
        "createdAt",
        "sent_at",
        "timestamp",
      ]) ??
      readString(rawConversation, ["updated_at", "last_message_at", "modified"]) ??
      null,
    conversationType,
    participantId:
      participants[0]?.id ??
      readString(participantRecord, ["id", "pk", "uuid", "user_id"]) ??
      readString(rawConversation, ["participant_id", "user_id", "other_user_id"]) ??
      null,
    participantName: participantName ?? null,
    participants,
    groupId:
      readString(groupRecord, ["id", "pk", "uuid"]) ??
      readString(rawConversation, ["group_id", "community_id", "clique_id"]) ??
      null,
    groupSlug:
      readString(groupRecord, ["slug", "group_slug"]) ??
      readString(rawConversation, ["group_slug", "community_slug", "clique_slug"]) ??
      null,
  };
}

function normalizeReplySnippet(value: string | null | undefined) {
  if (!value) return "";

  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function encodeReplyMetadata(replyTo: ApiMessageReplyRecord) {
  const encodedReplyPayload = encodeURIComponent(
    JSON.stringify({
      id: replyTo.id,
      senderName: replyTo.senderName,
      text: normalizeReplySnippet(replyTo.text),
    }),
  );

  return `${REPLY_METADATA_PREFIX}${encodedReplyPayload}`;
}

function parseReplyMetadata(value: string) {
  const trimmedValue = value.trimStart();
  if (!trimmedValue.startsWith(REPLY_METADATA_PREFIX)) {
    return { text: value, replyTo: null as ApiMessageReplyRecord | null };
  }

  const separatorIndex = trimmedValue.indexOf("\n");
  const encodedPayload = trimmedValue
    .slice(
      REPLY_METADATA_PREFIX.length,
      separatorIndex >= 0 ? separatorIndex : undefined,
    )
    .trim();

  let replyTo: ApiMessageReplyRecord | null = null;

  if (encodedPayload) {
    try {
      const parsedPayload = JSON.parse(decodeURIComponent(encodedPayload)) as {
        id?: unknown;
        senderName?: unknown;
        text?: unknown;
      };

      if (
        typeof parsedPayload.id === "string" &&
        typeof parsedPayload.senderName === "string"
      ) {
        replyTo = {
          id: parsedPayload.id,
          senderName: parsedPayload.senderName,
          text:
            typeof parsedPayload.text === "string"
              ? normalizeReplySnippet(parsedPayload.text)
              : "",
        };
      }
    } catch {
      replyTo = null;
    }
  }

  const cleanedText =
    separatorIndex >= 0 ? trimmedValue.slice(separatorIndex + 1) : "";

  return {
    text: cleanedText,
    replyTo,
  };
}

function normalizeReplyRecord(rawMessage: ApiRecord) {
  const replyRecord =
    getNestedRecord(rawMessage, ["reply_to"]) ??
    getNestedRecord(rawMessage, ["replyTo"]) ??
    getNestedRecord(rawMessage, ["parent_message"]) ??
    getNestedRecord(rawMessage, ["parentMessage"]) ??
    getNestedRecord(rawMessage, ["quoted_message"]) ??
    getNestedRecord(rawMessage, ["quotedMessage"]);

  if (!replyRecord) return null;

  const replyId = readString(replyRecord, ["id", "pk", "uuid", "message_id"]);
  const replySenderRecord = getNestedRecord(replyRecord, [
    "sender",
    "author",
    "user",
    "participant",
    "from_user",
  ]);
  const replyText = normalizeReplySnippet(
    readString(replyRecord, ["content", "text", "message", "body"]),
  );

  if (!replyId) return null;

  return {
    id: replyId,
    senderName:
      buildDisplayName(replySenderRecord) ??
      readString(replyRecord, ["sender_name", "author_name", "name"]) ??
      readString(replySenderRecord, ["email"]) ??
      "Unknown sender",
    text: replyText,
  } satisfies ApiMessageReplyRecord;
}

export function buildReplyMessageContent(
  content: string,
  replyTo?: ApiMessageReplyRecord | null,
) {
  if (!replyTo) {
    return content;
  }

  return `${encodeReplyMetadata(replyTo)}\n${content}`;
}

function normalizeMessage(rawMessage: unknown): ApiMessageRecord | null {
  if (!isRecord(rawMessage)) return null;

  const id = readString(rawMessage, ["id", "pk", "uuid", "message_id"]);
  if (!id) return null;

  const senderContainerRecord = getNestedRecord(rawMessage, [
    "sender",
    "author",
    "user",
    "participant",
    "from_user",
  ]);
  const senderRecord =
    getNestedRecord(senderContainerRecord, [
      "profile",
      "user",
      "account",
      "owner",
      "member",
      "participant",
    ]) ?? senderContainerRecord;
  const attachments = extractArrayPayload(rawMessage, ["attachments", "files"])
    .map((attachment, index) => normalizeAttachment(attachment, index))
    .filter((attachment): attachment is ApiAttachmentRecord => Boolean(attachment));
  const topLevelAttachment =
    attachments.length === 0 ? normalizeTopLevelFileAttachment(rawMessage, id) : null;
  const normalizedAttachments = topLevelAttachment ? [topLevelAttachment] : attachments;

  const normalizedText =
    readString(rawMessage, ["content", "text", "message", "body"]) ??
    (normalizedAttachments.length > 0 ? "" : "Unsupported message payload.");
  const parsedReplyContent = parseReplyMetadata(normalizedText);
  const normalizedReplyRecord = normalizeReplyRecord(rawMessage);

  return {
    id,
    text:
      parsedReplyContent.text === FILE_ONLY_MESSAGE_PLACEHOLDER
        ? ""
        : parsedReplyContent.text,
    senderId:
      readString(senderRecord, ["id", "pk", "uuid", "user_id"]) ??
      readString(senderContainerRecord, ["id", "pk", "uuid", "user_id"]) ??
      readString(rawMessage, ["sender_id", "author_id", "user_id"]) ??
      null,
    senderName:
      buildDisplayName(senderRecord) ??
      readString(senderContainerRecord, [
        "name",
        "full_name",
        "display_name",
        "fullName",
        "displayName",
        "username",
        "handle",
        "slug",
      ]) ??
      readString(rawMessage, [
        "sender_name",
        "author_name",
        "name",
        "senderName",
        "authorName",
        "full_name",
        "display_name",
        "fullName",
        "displayName",
        "username",
        "handle",
        "slug",
      ]) ??
      readString(senderContainerRecord, ["email"]) ??
      readString(senderRecord, ["email"]) ??
      "Unknown sender",
    senderEmail:
      readString(senderRecord, ["email"]) ??
      readString(senderContainerRecord, ["email"]) ??
      readString(rawMessage, ["sender_email", "author_email"]) ??
      null,
    senderAvatarUrl:
      readMediaUrl(senderRecord, [
        "avatar_url",
        "avatar",
        "profile_picture",
        "profile_image",
        "image_url",
        "image",
        "photo_url",
        "photo",
        "secure_url",
        "url",
      ]) ??
      readMediaUrl(rawMessage, [
        "sender_avatar_url",
        "author_avatar_url",
        "avatar_url",
        "avatar",
      ]) ??
      null,
    createdAt:
      readString(rawMessage, ["created_at", "createdAt", "sent_at", "timestamp"]) ??
      null,
    isOwn:
      readBoolean(rawMessage, [
        "is_mine",
        "isMine",
        "own_message",
        "is_own_message",
      ]) ?? null,
    attachments: normalizedAttachments,
    replyTo: normalizedReplyRecord ?? parsedReplyContent.replyTo,
  };
}

function normalizePresence(payload: unknown): ApiPresenceRecord {
  const presenceRecord =
    getNestedRecord(payload, ["presence", "data", "result"]) ??
    (isRecord(payload) ? payload : null);

  return {
    isOnline:
      readBoolean(presenceRecord, ["is_online", "online", "isOnline"]) ?? false,
    lastSeen:
      readString(presenceRecord, ["last_seen", "lastSeen", "updated_at"]) ?? null,
    status:
      readString(presenceRecord, ["status", "state", "label"]) ?? null,
  };
}

function formatConversationTime(value: string | null): string {
  if (!value) return "";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "";

  const diffMs = Date.now() - parsedValue.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
    return `${diffMinutes}M`;
  }

  if (diffHours < 24) {
    return `${Math.max(1, Math.round(diffHours))}HR`;
  }

  if (diffHours < 48) {
    return "YESTERDAY";
  }

  return parsedValue
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

export function toDashboardConversation(
  conversation: ApiConversationRecord,
  index: number,
): ConversationRecord {
  return {
    id: conversation.id,
    name: conversation.name,
    preview: conversation.preview,
    time: formatConversationTime(conversation.lastMessageAt),
    unreadCount: conversation.unreadCount,
    tone: CONVERSATION_TONES[index % CONVERSATION_TONES.length],
    initial: conversation.name[0]?.toUpperCase() ?? "C",
  };
}

function matchesGroupConversation(
  conversation: ApiConversationRecord,
  group: {
    id: string;
    slug?: string | null;
    name: string;
  },
  options?: {
    ignoredConversationIds?: Set<string>;
  },
) {
  if (options?.ignoredConversationIds?.has(conversation.id)) {
    return false;
  }

  if (conversation.groupId === group.id) {
    return true;
  }

  if (group.slug && conversation.groupSlug === group.slug) {
    return true;
  }

  const normalizedConversationType = conversation.conversationType?.trim().toLowerCase() ?? null;
  if (normalizedConversationType && normalizedConversationType !== "group") {
    return false;
  }

  return conversation.name.trim().toLowerCase() === group.name.trim().toLowerCase();
}

function matchesDirectConversation(
  conversation: ApiConversationRecord,
  peer: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
  },
) {
  const normalizedConversationType = conversation.conversationType?.trim().toLowerCase() ?? "";
  if (["group", "community", "clique"].includes(normalizedConversationType)) {
    return false;
  }

  const normalizedPeerId = peer.id?.trim().toLowerCase() ?? "";
  const normalizedPeerEmail = peer.email?.trim().toLowerCase() ?? "";
  const normalizedPeerName = peer.name?.trim().toLowerCase() ?? "";
  const normalizedParticipantId = conversation.participantId?.trim().toLowerCase() ?? "";
  const normalizedParticipantName = conversation.participantName?.trim().toLowerCase() ?? "";
  const normalizedConversationName = conversation.name.trim().toLowerCase();
  const participantEmails = conversation.participants
    .map((participant) => participant.email?.trim().toLowerCase() ?? "")
    .filter(Boolean);

  return (
    (normalizedPeerId && normalizedParticipantId === normalizedPeerId) ||
    (normalizedPeerEmail && participantEmails.includes(normalizedPeerEmail)) ||
    (normalizedPeerName && normalizedParticipantName === normalizedPeerName) ||
    (normalizedPeerName && normalizedConversationName === normalizedPeerName)
  );
}

export async function fetchConversations(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationCollectionPaths(),
    {
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );

  return extractArrayPayload(payload, ["conversations", "results", "items", "data"])
    .map((conversation) => normalizeConversation(conversation))
    .filter(
      (conversation): conversation is ApiConversationRecord => Boolean(conversation),
    );
}

export async function createConversation(
  tokens: Partial<AuthTokens>,
  body: Record<string, unknown>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationCollectionPaths(),
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
      body,
    },
    rememberWorkingConversationPath,
  );
}

export async function ensureDirectConversation(
  peer: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
  },
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const existingConversations = await fetchConversations(tokens, onAuthRefresh);
  const existingConversation = existingConversations.find((conversation) =>
    matchesDirectConversation(conversation, peer),
  );

  if (existingConversation) {
    return existingConversation;
  }

  const normalizedPeerId = peer.id?.trim() ?? "";
  const normalizedPeerEmail = peer.email?.trim() ?? "";
  const normalizedPeerName = peer.name?.trim() ?? "";
  const requestBodies = dedupeRequestBodies([
    { participant_id: normalizedPeerId },
    { user_id: normalizedPeerId },
    { other_user_id: normalizedPeerId },
    { recipient_id: normalizedPeerId },
    { participant: normalizedPeerId },
    { recipient: normalizedPeerId },
    { user: normalizedPeerId },
    { participant_id: normalizedPeerId, name: normalizedPeerName },
    { user_id: normalizedPeerId, name: normalizedPeerName },
    { recipient_id: normalizedPeerId, name: normalizedPeerName },
    { participant_email: normalizedPeerEmail },
    { recipient_email: normalizedPeerEmail },
    { email: normalizedPeerEmail },
    { participant_email: normalizedPeerEmail, name: normalizedPeerName },
    { recipient_email: normalizedPeerEmail, name: normalizedPeerName },
    { email: normalizedPeerEmail, name: normalizedPeerName },
    { participant_id: normalizedPeerId, participant_name: normalizedPeerName },
    { user_id: normalizedPeerId, participant_name: normalizedPeerName },
    { recipient_id: normalizedPeerId, participant_name: normalizedPeerName },
    { participant_id: normalizedPeerId, title: normalizedPeerName },
    { user_id: normalizedPeerId, title: normalizedPeerName },
    { recipient_id: normalizedPeerId, title: normalizedPeerName },
  ]).filter((body) =>
    Object.values(body).some((value) => typeof value === "string" && value.trim().length > 0),
  );

  const payload = await authenticatedApiRequestWithBodyFallback<unknown>(
    getConversationCollectionPaths(),
    requestBodies,
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
    "ensureDirectConversation",
    [400, 404, 405, 422, 500],
  );

  const createdConversation =
    normalizeConversation(payload) ??
    normalizeConversation(getNestedRecord(payload, ["conversation", "data", "result"]));

  if (createdConversation) {
    return createdConversation;
  }

  const refreshedConversations = await fetchConversations(tokens, onAuthRefresh);
  const matchedConversation = refreshedConversations.find((conversation) =>
    matchesDirectConversation(conversation, peer),
  );

  if (matchedConversation) {
    return matchedConversation;
  }

  throw new ApiError("Unable to create a direct conversation for this user.", 500, payload);
}

export async function ensureGroupConversation(
  group: {
    id: string;
    slug?: string | null;
    name: string;
    conversationId?: string | null;
  },
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
  options?: {
    ignoredConversationIds?: string[];
  },
) {
  const ignoredConversationIds = new Set(
    (options?.ignoredConversationIds ?? []).filter(Boolean),
  );
  const normalizedGroupId = group.id.trim();
  const numericGroupId = Number(normalizedGroupId);
  const canonicalGroupId =
    Number.isFinite(numericGroupId) && numericGroupId > 0
      ? numericGroupId
      : normalizedGroupId;

  if (group.conversationId && !ignoredConversationIds.has(group.conversationId)) {
    try {
      const existingConversation = await fetchConversation(
        group.conversationId,
        tokens,
        onAuthRefresh,
      );

      if (
        matchesGroupConversation(existingConversation, group, {
          ignoredConversationIds,
        })
      ) {
        return {
          ...existingConversation,
          groupId: existingConversation.groupId ?? group.id,
          groupSlug: existingConversation.groupSlug ?? group.slug ?? null,
        } satisfies ApiConversationRecord;
      }
    } catch (error) {
      if (!(error instanceof ApiError) || ![403, 404].includes(error.status)) {
        throw error;
      }
    }
  }

  const liveConversations = await fetchConversations(tokens, onAuthRefresh);
  const matchedConversation = liveConversations.find((conversation) =>
    matchesGroupConversation(conversation, group, {
      ignoredConversationIds,
    }),
  );

  if (matchedConversation) {
    return matchedConversation;
  }

  const slugBodies = group.slug
    ? [
        { name: group.name, slug: group.slug },
        { name: group.name, group_slug: group.slug },
      ]
    : [];
  const payload = await authenticatedApiRequestWithBodyFallback<unknown>(
    getConversationCollectionPaths(),
    [
      { name: group.name, group_id: canonicalGroupId },
      { name: group.name, group: canonicalGroupId },
      { name: group.name, groupId: canonicalGroupId },
      { name: group.name, group_id: canonicalGroupId, slug: group.slug ?? undefined },
      { name: group.name, group_id: canonicalGroupId, group_slug: group.slug ?? undefined },
      ...slugBodies,
      { name: group.name },
      { title: group.name, group_id: canonicalGroupId },
      { title: group.name, group: canonicalGroupId },
      { title: group.name, groupId: canonicalGroupId },
    ],
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
    "ensureGroupConversation",
  );

  const createdConversation =
    normalizeConversation(payload) ??
    normalizeConversation(getNestedRecord(payload, ["conversation", "data", "result"]));

  if (!createdConversation) {
    throw new ApiError("Unable to read the group conversation payload.", 500, payload);
  }

  return {
    ...createdConversation,
    groupId: createdConversation.groupId ?? group.id,
    groupSlug: createdConversation.groupSlug ?? group.slug ?? null,
  };
}

export async function fetchConversation(
  conversationId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationDetailPaths(conversationId),
    {
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );

  const conversation =
    normalizeConversation(payload) ??
    normalizeConversation(getNestedRecord(payload, ["conversation", "data", "result"]));

  if (!conversation) {
    throw new ApiError("Unable to read the conversation payload.", 500, payload);
  }

  return conversation;
}

export async function updateConversation(
  conversationId: string,
  tokens: Partial<AuthTokens>,
  body: Record<string, unknown>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationDetailPaths(conversationId),
    {
      method: "PATCH",
      auth: tokens,
      onAuthRefresh,
      body,
    },
    rememberWorkingConversationPath,
  );
}

export async function deleteConversation(
  conversationId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationDetailPaths(conversationId),
    {
      method: "DELETE",
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );
}

export async function fetchConversationMessages(
  conversationId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationMessagePaths(conversationId),
    {
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );

  return extractArrayPayload(payload, ["messages", "results", "items", "data"])
    .map((message) => normalizeMessage(message))
    .filter((message): message is ApiMessageRecord => Boolean(message));
}

export async function sendConversationMessage(
  conversationId: string,
  content: string,
  attachments: ApiAttachmentRecord[] = [],
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
  context?: {
    groupId?: string | null;
    groupSlug?: string | null;
  },
) {
  const attachmentIds = attachments.map((attachment) => attachment.id);
  const attachmentUrls = attachments
    .map((attachment) => attachment.url)
    .filter((url): url is string => Boolean(url));
  const contentCandidates = Array.from(
    new Set([
      content,
      ...(content === FILE_ONLY_MESSAGE_PLACEHOLDER ? [""] : []),
    ]),
  );
  const messageFallbackStatusCodes = [400, 404, 422, 500];
  const messageContextBodies = dedupeRequestBodies([
    { conversation_id: conversationId },
    { conversation: conversationId },
    { conversationId },
    { thread_id: conversationId },
    ...(context?.groupId
      ? [
          { group_id: context.groupId },
          { group: context.groupId },
          { groupId: context.groupId },
        ]
      : []),
    ...(context?.groupSlug
      ? [
          { group_slug: context.groupSlug },
          { slug: context.groupSlug },
        ]
      : []),
    {},
  ]);
  const messageBodies = dedupeRequestBodies(
    contentCandidates.flatMap((contentValue) =>
      messageContextBodies.flatMap((messageContext) => {
        const baseBodies: Record<string, unknown>[] = [
          { content: contentValue, ...messageContext },
          { message: contentValue, ...messageContext },
          { text: contentValue, ...messageContext },
          { body: contentValue, ...messageContext },
        ];

        if (attachments.length === 0) {
          return baseBodies;
        }

        const attachmentBodies: Record<string, unknown>[] = baseBodies.flatMap((baseBody) => [
          { ...baseBody, attachment_ids: attachmentIds },
          { ...baseBody, file_keys: attachmentIds },
          { ...baseBody, files: attachmentIds },
          { ...baseBody, attachments: attachmentIds },
          { ...baseBody, attachments: attachmentUrls },
          { ...baseBody, file_urls: attachmentUrls },
          { ...baseBody, message_type: "file", attachment_ids: attachmentIds },
          { ...baseBody, message_type: "file", attachments: attachmentUrls },
        ]);

        if (attachmentIds.length === 1 && attachmentUrls.length === 1) {
          attachmentBodies.push(
            ...baseBodies.flatMap((baseBody) => [
              { ...baseBody, file: attachmentIds[0] },
              { ...baseBody, attachment_id: attachmentIds[0] },
              { ...baseBody, file_url: attachmentUrls[0] },
              { ...baseBody, attachment_url: attachmentUrls[0] },
              { ...baseBody, message_type: "file", file_url: attachmentUrls[0] },
            ]),
          );
        }

        return [...baseBodies, ...attachmentBodies];
      }),
    ),
  );

  let payload: unknown;

  try {
    payload = await authenticatedApiRequestWithBodyFallback<unknown>(
      getConversationMessagePaths(conversationId),
      messageBodies,
      {
        method: "POST",
        auth: tokens,
        onAuthRefresh,
      },
      rememberWorkingConversationPath,
      "sendConversationMessage.direct",
      messageFallbackStatusCodes,
    );
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      ![400, 403, 404, 405, 422, 500].includes(error.status)
    ) {
      throw error;
    }

    payload = await authenticatedApiRequestWithBodyFallback<unknown>(
      getConversationCollectionPaths(),
      messageBodies,
      {
        method: "POST",
        auth: tokens,
        onAuthRefresh,
      },
      rememberWorkingConversationPath,
      "sendConversationMessage.fallback",
      messageFallbackStatusCodes,
    );
  }

  const message =
    normalizeMessage(payload) ??
    normalizeMessage(getNestedRecord(payload, ["message", "data", "result"]));

  if (!message) {
    throw new ApiError("Unable to read the sent message payload.", 500, payload);
  }

  if (attachments.length > 0 && message.attachments.length === 0) {
    try {
      const refreshedMessages = await fetchConversationMessages(
        conversationId,
        tokens,
        onAuthRefresh,
      );
      const refreshedMessage = refreshedMessages.find(
        (candidateMessage) => candidateMessage.id === message.id,
      );

      if (refreshedMessage && refreshedMessage.attachments.length > 0) {
        return refreshedMessage;
      }
    } catch (error) {
      console.warn("[sendConversationMessage] unable to verify uploaded attachments", {
        conversationId,
        messageId: message.id,
        error,
      });
    }

    console.warn("[sendConversationMessage] server response omitted uploaded attachments", {
      conversationId,
      messageId: message.id,
      attachmentIds,
      attachmentUrls,
      payload,
    });

    return {
      ...message,
      attachments: attachments.map((attachment) => stripAttachmentRuntimeFields(attachment)),
    };
  }

  return message;
}

export function buildFileOnlyMessagePlaceholder() {
  return FILE_ONLY_MESSAGE_PLACEHOLDER;
}

export async function markConversationSeen(
  conversationId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getConversationSeenPaths(conversationId),
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );
}

export async function uploadMessageAttachments(
  attachments: ApiAttachmentRecord[],
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
  context?: {
    conversationId?: string | null;
  },
) {
  if (!context?.conversationId) {
    throw new ApiError("A conversation id is required before uploading attachments.", 400);
  }

  const uploadedAttachments: ApiAttachmentRecord[] = [];

  for (const attachment of attachments) {
    if (!attachment.file) {
      uploadedAttachments.push(stripAttachmentRuntimeFields(attachment));
      continue;
    }

    const file = attachment.file;
    const signaturePayload = await authenticatedApiRequestWithBodyFallback<unknown>(
      getConversationUploadSignaturePaths(),
      dedupeRequestBodies([
        { conversation_id: context.conversationId },
        { conversation: context.conversationId },
        { conversationId: context.conversationId },
        { thread_id: context.conversationId },
      ]),
      {
        method: "POST",
        auth: tokens,
        onAuthRefresh,
      },
      undefined,
      "uploadMessageAttachments.signature",
      [400, 404, 422, 500],
    );
    const { formEntries, signatureRecord, uploadTargets } = buildCloudinarySignedUploadRequest(
      signaturePayload,
      file,
      "auto",
    );

    let uploadedFilePayload: unknown = null;
    let lastUploadStatus = 500;
    const uploadAttemptErrors: Array<{ status: number; url: string; payload: unknown }> = [];

    for (const uploadUrl of uploadTargets) {
      const formData = new FormData();
      for (const [key, value] of formEntries) {
        formData.append(key, value);
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      const uploadResponsePayload = await parseUploadResponse(uploadResponse);

      if (uploadResponse.ok) {
        uploadedFilePayload = uploadResponsePayload;
        lastUploadStatus = uploadResponse.status;
        break;
      }

      lastUploadStatus = uploadResponse.status;
      uploadedFilePayload = uploadResponsePayload;
      uploadAttemptErrors.push({
        status: uploadResponse.status,
        url: uploadUrl,
        payload: uploadResponsePayload,
      });
    }

    const uploadedFileRecord = isRecord(uploadedFilePayload) ? uploadedFilePayload : null;
    const uploadedAttachmentId =
      readString(uploadedFileRecord, ["public_id", "asset_id", "file_id", "id"]) ??
      attachment.id;
    const uploadedSecureUrl =
      readString(uploadedFileRecord, ["secure_url", "url", "file_url", "public_url", "path"]) ??
      null;

    if (!uploadedSecureUrl) {
      logCloudinaryUploadFailure(
        "message-attachment",
        signatureRecord,
        formEntries,
        uploadTargets,
        file,
        uploadAttemptErrors,
      );
      throw new ApiError(
        lastUploadStatus === 401
          ? "Cloudinary rejected the attachment upload signature. This usually means the backend returned an invalid or expired signature."
          : "Unable to upload the selected attachment.",
        lastUploadStatus,
        {
          attempts: uploadAttemptErrors,
          lastResponse: uploadedFilePayload,
        },
      );
    }

    uploadedAttachments.push(
      stripAttachmentRuntimeFields({
        id: uploadedAttachmentId,
        name: file.name,
        url: uploadedSecureUrl,
        mimeType: file.type || null,
        file: null,
        uploadStatus: "uploaded",
      }),
    );

    // Tell the backend the Cloudinary URL so it can persist it with the
    // conversation. Without this step the backend has no record of the
    // uploaded file and fetchConversationMessages returns no attachment
    // data, causing attachments to disappear on reload.
    // Non-fatal: if confirm fails we still have the URL client-side for
    // the current session, so we warn rather than throw.
    try {
      await authenticatedApiRequestWithBodyFallback<unknown>(
        ["/api/v1/messages/attachments/confirm/"],
        dedupeRequestBodies([
          {
            conversation_id: context.conversationId,
            public_id: uploadedAttachmentId,
            secure_url: uploadedSecureUrl,
            url: uploadedSecureUrl,
            file_name: file.name,
            mime_type: file.type || null,
          },
          {
            conversation: context.conversationId,
            public_id: uploadedAttachmentId,
            secure_url: uploadedSecureUrl,
            url: uploadedSecureUrl,
            file_name: file.name,
            content_type: file.type || null,
          },
        ]),
        {
          method: "POST",
          auth: tokens,
          onAuthRefresh,
        },
        undefined,
        "uploadMessageAttachments.confirm",
        [400, 404, 422, 500],
      );
    } catch (confirmError) {
      console.warn(
        "[uploadMessageAttachments] attachment confirm step failed — " +
        "file will be visible this session but may disappear on reload " +
        "until the backend confirm endpoint is correctly wired.",
        { conversationId: context.conversationId, uploadedAttachmentId, confirmError },
      );
    }
  }

  return uploadedAttachments;
}

export async function sendConversationFileMessage(
  conversationId: string,
  attachment: ApiAttachmentRecord,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  if (!attachment.url) {
    throw new ApiError("The uploaded file is missing a public URL.", 400, attachment);
  }

  return sendConversationMessage(
    conversationId,
    FILE_ONLY_MESSAGE_PLACEHOLDER,
    [attachment],
    tokens,
    onAuthRefresh,
  );
}

export async function fetchUnreadMessageCount(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const unreadSnapshot = await fetchUnreadConversationSnapshot(tokens, onAuthRefresh);

  return unreadSnapshot.totalCount;
}

export async function fetchUnreadConversationSnapshot(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    getUnreadConversationPaths(),
    {
      auth: tokens,
      onAuthRefresh,
    },
    rememberWorkingConversationPath,
  );

  const countsByConversationId: Record<string, number> = {};
  const accumulateUnreadCount = (conversationId: string | null, count = 1) => {
    const normalizedConversationId = conversationId?.trim();
    if (!normalizedConversationId) return;

    countsByConversationId[normalizedConversationId] =
      (countsByConversationId[normalizedConversationId] ?? 0) + count;
  };

  const unreadItems = Array.isArray(payload)
    ? payload
    : extractArrayPayload(payload, ["messages", "conversations", "results", "items", "data"]);

  for (const unreadItem of unreadItems) {
    if (!isRecord(unreadItem)) continue;

    const nestedConversationRecord = getNestedRecord(unreadItem, [
      "conversation",
      "thread",
      "chat",
    ]);
    const conversationId =
      readString(unreadItem, ["conversation_id", "conversationId", "thread_id"]) ??
      readString(nestedConversationRecord, ["id", "pk", "uuid", "conversation_id"]);
    const explicitUnreadCount =
      readNumber(unreadItem, [
        "unread_count",
        "unread",
        "unread_messages",
        "unreadCount",
        "unseen_count",
        "unseen_messages",
        "message_unread_count",
        "new_messages_count",
      ]) ??
      readNumber(nestedConversationRecord, [
        "unread_count",
        "unread",
        "unread_messages",
        "unreadCount",
        "unseen_count",
        "unseen_messages",
        "message_unread_count",
        "new_messages_count",
      ]);

    accumulateUnreadCount(conversationId, explicitUnreadCount ?? 1);
  }

  if (Array.isArray(payload)) {
    return {
      totalCount: payload.length,
      countsByConversationId,
    };
  }

  const totalCount =
    readNumber(payload, ["count", "total", "unread", "unread_count"]) ??
    readNumber(getNestedRecord(payload, ["data", "result"]), [
      "count",
      "total",
      "unread",
      "unread_count",
    ]) ??
    unreadItems.length;

  return {
    totalCount,
    countsByConversationId,
  };
}

export async function sendDirectMessage(
  userId: string,
  content: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
  context?: {
    conversationId?: string | null;
  },
): Promise<SendDirectMessageResult> {
  const normalizedUserId = userId.trim();
  const normalizedConversationId = context?.conversationId?.trim() ?? "";
  const directMessageBodies = dedupeRequestBodies(
    [
      { receiver_id: normalizedUserId, content },
      { recipient_id: normalizedUserId, content },
      { user_id: normalizedUserId, content },
      { receiver: normalizedUserId, content },
      { recipient: normalizedUserId, content },
      { user: normalizedUserId, content },
      { receiver_id: normalizedUserId, message: content },
      { recipient_id: normalizedUserId, message: content },
      { user_id: normalizedUserId, message: content },
      { receiver_id: normalizedUserId, text: content },
      { recipient_id: normalizedUserId, text: content },
      { user_id: normalizedUserId, text: content },
      { receiver_id: normalizedUserId, body: content },
      { recipient_id: normalizedUserId, body: content },
      { user_id: normalizedUserId, body: content },
      ...(normalizedConversationId
        ? [
            {
              receiver_id: normalizedUserId,
              conversation_id: normalizedConversationId,
              content,
            },
            {
              recipient_id: normalizedUserId,
              conversation_id: normalizedConversationId,
              content,
            },
            {
              user_id: normalizedUserId,
              conversation_id: normalizedConversationId,
              content,
            },
            {
              receiver_id: normalizedUserId,
              conversation: normalizedConversationId,
              content,
            },
          ]
        : []),
    ].filter((body) =>
      Object.values(body).some(
        (value) => typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );

  const payload = await authenticatedApiRequestWithBodyFallback<unknown>(
    getDirectMessagePaths(normalizedUserId),
    directMessageBodies,
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
    undefined,
    "sendDirectMessage",
    [400, 403, 404, 405, 422, 500],
  );

  const message =
    normalizeMessage(payload) ??
    normalizeMessage(getNestedRecord(payload, ["message", "data", "result"]));

  if (!message) {
    throw new ApiError("Unable to read the sent direct message payload.", 500, payload);
  }

  const responseRoot =
    getNestedRecord(payload, ["data", "result"]) ??
    (isRecord(payload) ? payload : null);
  const nestedMessageRecord = getNestedRecord(payload, ["message"]);
  const nestedConversationRecord =
    getNestedRecord(payload, ["conversation", "thread", "chat"]) ??
    getNestedRecord(responseRoot, ["conversation", "thread", "chat"]) ??
    getNestedRecord(nestedMessageRecord, ["conversation", "thread", "chat"]);
  const fallbackConversationId =
    readString(responseRoot, [
      "conversation_id",
      "conversationId",
      "thread_id",
      "threadId",
      "chat_id",
      "chatId",
    ]) ??
    readString(nestedMessageRecord, [
      "conversation_id",
      "conversationId",
      "thread_id",
      "threadId",
      "chat_id",
      "chatId",
    ]) ??
    null;
  const conversation =
    normalizeConversation(nestedConversationRecord) ??
    (fallbackConversationId
      ? ({
          id: fallbackConversationId,
          name:
            readString(responseRoot, [
              "conversation_name",
              "conversationName",
              "participant_name",
              "participantName",
            ]) ?? "Message",
          preview: message.text || "No messages yet.",
          unreadCount: 0,
          lastMessageAt: message.createdAt ?? null,
          conversationType: "direct",
          participantId: normalizedUserId,
          participantName:
            readString(responseRoot, [
              "participant_name",
              "participantName",
              "conversation_name",
              "conversationName",
            ]) ?? null,
          participants: [],
          groupId: null,
          groupSlug: null,
        } satisfies ApiConversationRecord)
      : null);

  return {
    message,
    conversation,
    conversationId: conversation?.id ?? fallbackConversationId,
  };
}

export async function fetchDirectMessageHistory(
  userId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    getDirectMessageHistoryPaths(userId),
    {
      auth: tokens,
      onAuthRefresh,
    },
  );

  return extractArrayPayload(payload, ["messages", "results", "items", "data"])
    .map((message) => normalizeMessage(message))
    .filter((message): message is ApiMessageRecord => Boolean(message));
}

export async function markDirectMessageSeen(
  userId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getDirectMessageSeenPaths(userId),
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function editMessage(
  messageId: string,
  content: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithBodyFallback<unknown>(
    getMessageEditPaths(messageId),
    [
      { content },
      { message: content },
      { text: content },
      { body: content },
    ],
    {
      method: "PATCH",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function deleteMessage(
  messageId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getMessageDeletePaths(messageId),
    {
      method: "DELETE",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function reactToMessage(
  messageId: string,
  reaction: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithBodyFallback<unknown>(
    getMessageReactionPaths(messageId),
    [
      { reaction },
      { emoji: reaction },
    ],
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function removeMessageReaction(
  messageId: string,
  reaction: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithBodyFallback<unknown>(
    getMessageReactionPaths(messageId),
    [
      { reaction },
      { emoji: reaction },
    ],
    {
      method: "DELETE",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function fetchMessageReactions(
  messageId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getMessageReactionsListPaths(messageId),
    {
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function fetchMessageReceipts(
  messageId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    getMessageReceiptsPaths(messageId),
    {
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function requestMessageUploadSignature(
  tokens: Partial<AuthTokens>,
  body: Record<string, unknown>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    ["/api/v1/messages/upload-signature/"],
    {
      method: "POST",
      auth: tokens,
      onAuthRefresh,
      body,
    },
  );
}

export async function fetchUserPresence(
  userId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    [`/api/v1/messages/presence/${userId}/`],
    {
      auth: tokens,
      onAuthRefresh,
    },
  );

  return normalizePresence(payload);
}

export function getRealtimePresenceWebSocketUrl(userId?: string) {
  const apiBaseUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://scuib-chat-rrx6.onrender.com"
  ).replace(/\/+$/, "");
  const socketBaseUrl = apiBaseUrl.replace(/^http/i, "ws");

  if (userId) {
    return `${socketBaseUrl}/ws/presence/${userId}/`;
  }

  return `${socketBaseUrl}/ws/presence/`;
}
