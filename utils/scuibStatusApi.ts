import {
  ApiError,
  type AuthTokens,
  apiRequest,
  buildDisplayName,
  buildCloudinarySignedUploadRequest,
  extractArrayPayload,
  isRecord,
  readBoolean,
  readMediaUrl,
  readNumber,
  readString,
  readStringArray,
  refreshAccessToken,
  type ApiRecord,
} from "@/utils/scuibApi";

/**
 * Status feature API client.
 *
 * Backend contract (confirmed by founder, see status-feature-spec.md):
 *   GET    /api/statuses/                 Feed — active statuses, pinned contacts first
 *   POST   /api/statuses/                 Create a new status
 *   GET    /api/statuses/me/              Your own statuses + view counts
 *   DELETE /api/statuses/<pk>/            Delete your status
 *   POST   /api/statuses/<pk>/view/       Record that you viewed a status
 *   GET    /api/statuses/<pk>/view/       View count + viewer list (owner only)
 *   GET    /api/statuses/pins/            List your pinned contacts
 *   POST   /api/statuses/pins/            Pin a contact
 *   DELETE /api/statuses/pins/<user_id>/  Unpin a contact
 *
 * Server-enforced business rules (client mirrors these for instant feedback,
 * but the server remains the source of truth):
 *   - Max 50 statuses per user per day
 *   - 24-hour automatic expiry
 *   - Videos <= 5 minutes
 *   - Max 10 pinned contacts
 *   - Only the owner can delete their status
 *   - Only the owner sees the viewer list (everyone sees the view count)
 *
 * Media upload (photo/video/file) follows a 4-step flow confirmed by the
 * backend dev (FE_STATUS_UPLOAD_CONSUMPTION.md):
 *   1. POST /api/statuses/upload/       — create placeholder, get signature
 *   2. Upload directly to Cloudinary    — using the returned signature
 *   3. POST /api/statuses/upload/confirm/ — confirm with status_id + public_id
 *   4. Status is now live
 *
 * `authenticatedApiRequest` in scuibApi.ts is not exported, so — following
 * the same precedent already set in scuibMessagingApi.ts (which keeps its
 * own local copy) — this file defines a local equivalent below with
 * identical refresh-on-401 behavior, rather than reimplementing it ad hoc
 * per call.
 */

export const STATUS_DAILY_QUOTA = 50;
export const STATUS_MAX_PINNED_CONTACTS = 10;
export const STATUS_MAX_VIDEO_SECONDS = 5 * 60;
export const STATUS_EXPIRY_MS = 24 * 60 * 60 * 1000;

const STATUS_COLLECTION_PATH = "/api/statuses/";
const STATUS_OWN_PATH = "/api/statuses/me/";
const STATUS_PINS_PATH = "/api/statuses/pins/";

function statusDetailPath(statusId: string) {
  return `/api/statuses/${statusId}/`;
}

function statusViewPath(statusId: string) {
  return `/api/statuses/${statusId}/view/`;
}

function statusPinPath(userId: string) {
  return `/api/statuses/pins/${userId}/`;
}

function statusCommentsPath(statusId: string) {
  return `/api/statuses/${statusId}/comments/`;
}

function commentRepliesPath(commentId: string | number) {
  return `/api/statuses/comments/${commentId}/replies/`;
}

type StatusRequestInit = Omit<RequestInit, "body" | "headers"> & {
  auth: Partial<AuthTokens>;
  body?: unknown;
  headers?: HeadersInit;
  onAuthRefresh?: (tokens: AuthTokens) => void;
};

async function authenticatedApiRequest<T>(
  path: string,
  init: StatusRequestInit,
): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (error) {
    const isExpiredToken =
      error instanceof ApiError &&
      (error.status === 401 ||
        (error.status === 403 &&
          error.message.trim().toLowerCase().includes("token not valid")));

    if (isExpiredToken && init.auth.refreshToken) {
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

export type StatusContentType = "image" | "video" | "text";

export type ApiStatusRecord = {
  id: string;
  authorId: string | null;
  authorName: string | undefined;
  authorAvatarUrl: string | null;
  type: StatusContentType;
  mediaUrl: string | null;
  mimeType: string | null;
  textContent: string | null;
  backgroundColor: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  viewedByMe: boolean;
  isPinnedAuthor: boolean;
};

export type ApiStatusPinRecord = {
  userId: string;
  name: string | undefined;
  avatarUrl: string | null;
};

export type ApiStatusViewerRecord = {
  userId: string;
  name: string | undefined;
  avatarUrl: string | null;
  viewedAt: string | null;
};

function getAuthorRecord(statusRecord: ApiRecord): ApiRecord | null {
  if (isRecord(statusRecord.author)) return statusRecord.author;
  if (isRecord(statusRecord.user)) return statusRecord.user;
  if (isRecord(statusRecord.owner)) return statusRecord.owner;
  return statusRecord;
}

function resolveStatusType(record: ApiRecord): StatusContentType {
  const explicitType = readString(record, ["type", "content_type", "contentType", "kind"]);
  if (explicitType === "image" || explicitType === "video" || explicitType === "text") {
    return explicitType;
  }

  const mimeType = readString(record, ["mime_type", "mimeType"]);
  if (mimeType?.startsWith("video/")) return "video";
  if (mimeType?.startsWith("image/")) return "image";

  const mediaUrl = readMediaUrl(record, ["media_url", "mediaUrl", "url", "file_url", "fileUrl"]);
  if (mediaUrl) return "image";

  return "text";
}

function normalizeStatus(rawStatus: unknown): ApiStatusRecord | null {
  if (!isRecord(rawStatus)) return null;

  const id = readString(rawStatus, ["id", "pk", "status_id", "statusId"]);
  if (!id) return null;

  const authorRecord = getAuthorRecord(rawStatus);
  const isNestedAuthor = authorRecord !== rawStatus;

  return {
    id,
    authorId:
      (isNestedAuthor && authorRecord
        ? readString(authorRecord, ["id", "user_id", "userId", "pk"])
        : null) ?? readString(rawStatus, ["user_id", "userId", "user"]),
    authorName: buildDisplayName(authorRecord),
    authorAvatarUrl: readMediaUrl(authorRecord, [
      "avatar_url",
      "avatarUrl",
      "avatar",
      "profile_picture",
      "profilePicture",
      "image",
    ]),
    type: resolveStatusType(rawStatus),
    mediaUrl: readMediaUrl(rawStatus, ["media_url", "mediaUrl", "url", "file_url", "fileUrl"]),
    mimeType: readString(rawStatus, ["mime_type", "mimeType"]),
    textContent: readString(rawStatus, ["text", "text_content", "textContent", "caption", "content"]),
    backgroundColor: readString(rawStatus, ["background_color", "backgroundColor", "bg_color", "bgColor"]),
    createdAt: readString(rawStatus, ["created_at", "createdAt"]),
    expiresAt: readString(rawStatus, ["expires_at", "expiresAt"]),
    viewCount: readNumber(rawStatus, ["view_count", "viewCount", "views"]) ?? 0,
    viewedByMe: readBoolean(rawStatus, ["viewed_by_me", "viewedByMe", "is_viewed", "isViewed"]) ?? false,
    isPinnedAuthor: readBoolean(rawStatus, ["is_pinned_author", "isPinnedAuthor", "author_is_pinned"]) ?? false,
  };
}

function normalizeStatusPin(rawPin: unknown): ApiStatusPinRecord | null {
  if (!isRecord(rawPin)) return null;

  const userId = readString(rawPin, ["user_id", "userId", "id", "pk"]);
  if (!userId) return null;

  const userRecord = isRecord(rawPin.user) ? rawPin.user : rawPin;

  return {
    userId,
    name: buildDisplayName(userRecord),
    avatarUrl: readMediaUrl(userRecord, ["avatar_url", "avatarUrl", "avatar", "profile_picture", "profilePicture"]),
  };
}

function normalizeStatusViewer(rawViewer: unknown): ApiStatusViewerRecord | null {
  if (!isRecord(rawViewer)) return null;

  const userRecord = isRecord(rawViewer.user) ? rawViewer.user : rawViewer;
  const userId = readString(userRecord, ["id", "user_id", "userId", "pk"]);
  if (!userId) return null;

  return {
    userId,
    name: buildDisplayName(userRecord),
    avatarUrl: readMediaUrl(userRecord, ["avatar_url", "avatarUrl", "avatar", "profile_picture", "profilePicture"]),
    viewedAt: readString(rawViewer, ["viewed_at", "viewedAt", "created_at", "createdAt"]),
  };
}

/** GET /api/statuses/ — feed, pinned contacts first (server-ordered). */
export async function fetchStatusFeed(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>(STATUS_COLLECTION_PATH, {
    auth: tokens,
    onAuthRefresh,
  });

  return extractArrayPayload(payload, ["statuses", "results", "items", "data"])
    .map((status) => normalizeStatus(status))
    .filter((status): status is ApiStatusRecord => Boolean(status));
}

/** GET /api/statuses/me/ — your own active statuses + view counts. */
export async function fetchMyStatuses(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>(STATUS_OWN_PATH, {
    auth: tokens,
    onAuthRefresh,
  });

  return extractArrayPayload(payload, ["statuses", "results", "items", "data"])
    .map((status) => normalizeStatus(status))
    .filter((status): status is ApiStatusRecord => Boolean(status));
}

/** POST /api/statuses/ — create a text-only status. */
export async function createTextStatus(
  input: { text: string; backgroundColor?: string | null },
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const trimmedText = input.text.trim();
  if (!trimmedText) {
    throw new ApiError("Status text cannot be empty.", 400);
  }

  const payload = await authenticatedApiRequest<unknown>(STATUS_COLLECTION_PATH, {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: {
      content_type: "text",
      text_content: trimmedText,
      background_color: input.backgroundColor ?? null,
    },
  });

  const created = normalizeStatus(payload);
  if (!created) {
    throw new ApiError("Unable to read the created status from the API response.", 500, payload);
  }

  return created;
}

/**
 * POST /api/statuses/ — create a photo/video/file status from an
 * already-uploaded Cloudinary URL. Call uploadStatusMedia() first.
 */
export async function createMediaStatus(
  input: { mediaUrl: string; mimeType: string | null; type: "image" | "video" | "file" },
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>(STATUS_COLLECTION_PATH, {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: {
      content_type: input.type,
      media_url: input.mediaUrl,
      mime_type: input.mimeType,
    },
  });

  const created = normalizeStatus(payload);
  if (!created) {
    throw new ApiError("Unable to read the created status from the API response.", 500, payload);
  }

  return created;
}

/**
 * Full 4-step media upload flow per backend dev spec
 * (FE_STATUS_UPLOAD_CONSUMPTION.md):
 *
 * Step 1 — POST /api/statuses/upload/
 *   Create a placeholder status and get back a status_id + Cloudinary
 *   upload signature.
 *
 * Step 2 — Upload directly to Cloudinary using the signature.
 *
 * Step 3 — POST /api/statuses/upload/confirm/
 *   Tell the backend the upload succeeded with the status_id and
 *   Cloudinary public_id.
 *
 * Step 4 — The status is now live.
 */
export async function uploadStatusMedia(
  file: File,
  contentType: "image" | "video" | "file",
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  if (file.type.startsWith("video/")) {
    const durationSeconds = await readVideoDurationSeconds(file).catch(() => null);
    if (durationSeconds !== null && durationSeconds > STATUS_MAX_VIDEO_SECONDS) {
      throw new ApiError("Videos for your status must be 5 minutes or shorter.", 400);
    }
  }

  // Step 1: Create placeholder status and get upload signature
  const initPayload = await authenticatedApiRequest<unknown>("/api/statuses/upload/", {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: {
      content_type: contentType,
      file_name: file.name,
      mime_type: file.type || null,
    },
  });

  const initRecord = isRecord(initPayload) ? initPayload : null;
  const statusId = readString(initRecord, ["status_id", "statusId", "id", "pk"]);
  if (!statusId) {
    throw new ApiError("Backend didn't return a status ID for the upload.", 500, initPayload);
  }

  // Step 2: Upload to Cloudinary using the signature from step 1
  const resourceType = file.type.startsWith("video/") ? "video" : "image";
  const { formEntries, uploadTargets } = buildCloudinarySignedUploadRequest(
    initPayload,
    file,
    resourceType,
  );

  let uploadedFilePayload: unknown = null;
  let lastUploadStatus = 500;

  for (const uploadUrl of uploadTargets) {
    const formData = new FormData();
    for (const [key, value] of formEntries) {
      formData.append(key, value);
    }

    const uploadResponse = await fetch(uploadUrl, { method: "POST", body: formData });
    const uploadResponseText = await uploadResponse.text();
    try {
      uploadedFilePayload = uploadResponseText ? JSON.parse(uploadResponseText) : null;
    } catch {
      uploadedFilePayload = uploadResponseText || null;
    }
    lastUploadStatus = uploadResponse.status;

    if (uploadResponse.ok) break;
  }

  const uploadedRecord = isRecord(uploadedFilePayload) ? uploadedFilePayload : null;
  const secureUrl = readString(uploadedRecord, ["secure_url", "url", "file_url", "public_url"]);
  const publicId = readString(uploadedRecord, ["public_id", "publicId"]);

  if (!secureUrl || !publicId) {
    throw new ApiError(
      lastUploadStatus === 401
        ? "Cloudinary rejected the upload signature."
        : "Unable to upload the selected file.",
      lastUploadStatus,
      uploadedFilePayload,
    );
  }

  // Step 3: Confirm the upload with the backend
  await authenticatedApiRequest<unknown>("/api/statuses/upload/confirm/", {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: {
      status_id: statusId,
      public_id: publicId,
      secure_url: secureUrl,
    },
  });

  // Step 4: Return the media info for use in the composer
  return {
    mediaUrl: secureUrl,
    mimeType: file.type || null,
    type: contentType,
  };
}

function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(videoEl.src);
      resolve(videoEl.duration);
    };
    videoEl.onerror = () => reject(new Error("Could not read video metadata."));
    videoEl.src = URL.createObjectURL(file);
  });
}

/** DELETE /api/statuses/<pk>/ — only the owner can delete their own status. */
export async function deleteStatus(
  statusId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  await authenticatedApiRequest<unknown>(statusDetailPath(statusId), {
    method: "DELETE",
    auth: tokens,
    onAuthRefresh,
  });
}

/** POST /api/statuses/<pk>/view/ — record that the current user viewed a status. */
export async function recordStatusView(
  statusId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  await authenticatedApiRequest<unknown>(statusViewPath(statusId), {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
  });
}

/** GET /api/statuses/<pk>/view/ — view count + viewer list. Owner-only on the backend. */
export async function fetchStatusViewers(
  statusId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>(statusViewPath(statusId), {
    auth: tokens,
    onAuthRefresh,
  });

  const viewCount =
    readNumber(payload, ["view_count", "viewCount", "views"]) ??
    extractArrayPayload(payload, ["viewers", "results", "items", "data"]).length;

  const viewers = extractArrayPayload(payload, ["viewers", "results", "items", "data"])
    .map((viewer) => normalizeStatusViewer(viewer))
    .filter((viewer): viewer is ApiStatusViewerRecord => Boolean(viewer));

  return { viewCount, viewers };
}

/** GET /api/statuses/pins/ — list your pinned contacts (max 10). */
export async function fetchStatusPins(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>(STATUS_PINS_PATH, {
    auth: tokens,
    onAuthRefresh,
  });

  return extractArrayPayload(payload, ["pins", "results", "items", "data"])
    .map((pin) => normalizeStatusPin(pin))
    .filter((pin): pin is ApiStatusPinRecord => Boolean(pin));
}

/**
 * POST /api/statuses/pins/ — pin a contact so their status always surfaces
 * first. Mirrors the server's max-10 rule client-side for instant feedback;
 * the server remains the source of truth and will reject past the limit.
 */
export async function pinStatusContact(
  userId: string,
  currentPinCount: number,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  if (currentPinCount >= STATUS_MAX_PINNED_CONTACTS) {
    throw new ApiError(
      `You can only pin up to ${STATUS_MAX_PINNED_CONTACTS} contacts. Unpin someone first.`,
      400,
    );
  }

  await authenticatedApiRequest<unknown>(STATUS_PINS_PATH, {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: { user_id: userId },
  });
}

/** DELETE /api/statuses/pins/<user_id>/ — unpin a contact. */
export async function unpinStatusContact(
  userId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  await authenticatedApiRequest<unknown>(statusPinPath(userId), {
    method: "DELETE",
    auth: tokens,
    onAuthRefresh,
  });
}

/**
 * Sorts a feed so pinned authors' statuses lead, preserving relative order
 * within each group. Use this client-side as a safety net even though the
 * backend already orders pinned-first — defends against feed responses that
 * get merged/paginated out of order on the client.
 */
export function sortStatusFeedPinnedFirst(statuses: ApiStatusRecord[]): ApiStatusRecord[] {
  const pinned = statuses.filter((status) => status.isPinnedAuthor);
  const everyoneElse = statuses.filter((status) => !status.isPinnedAuthor);
  return [...pinned, ...everyoneElse];
}

/** Groups a flat status feed into one entry per author, newest status first. */
export function groupStatusesByAuthor(statuses: ApiStatusRecord[]) {
  const byAuthor = new Map<string, ApiStatusRecord[]>();

  for (const status of statuses) {
    const key = status.authorId ?? status.id;
    const existing = byAuthor.get(key) ?? [];
    existing.push(status);
    byAuthor.set(key, existing);
  }

  for (const statusesForAuthor of byAuthor.values()) {
    statusesForAuthor.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }

  return byAuthor;
}

// ---------------------------------------------------------------------------
// Comments & Replies
// ---------------------------------------------------------------------------

export type ApiStatusCommentRecord = {
  id: number;
  userId: string;
  statusId: string;
  text: string;
  createdAt: string | null;
};

export type ApiStatusReplyRecord = {
  id: number;
  userId: string;
  commentId: number;
  text: string;
  createdAt: string | null;
};

function normalizeComment(raw: unknown): ApiStatusCommentRecord | null {
  if (!isRecord(raw)) return null;

  const rawId = raw.id;
  const id = typeof rawId === "number" ? rawId : typeof rawId === "string" ? Number(rawId) : NaN;
  if (!Number.isFinite(id)) return null;

  const userId = readString(raw, ["user", "user_id", "userId"]);
  if (!userId) return null;

  const statusId = readString(raw, ["status", "status_id", "statusId"]);
  if (!statusId) return null;

  const text = readString(raw, ["text", "content", "body"]);
  if (!text) return null;

  return {
    id,
    userId,
    statusId,
    text,
    createdAt: readString(raw, ["created_at", "createdAt"]),
  };
}

function normalizeReply(raw: unknown): ApiStatusReplyRecord | null {
  if (!isRecord(raw)) return null;

  const rawId = raw.id;
  const id = typeof rawId === "number" ? rawId : typeof rawId === "string" ? Number(rawId) : NaN;
  if (!Number.isFinite(id)) return null;

  const userId = readString(raw, ["user", "user_id", "userId"]);
  if (!userId) return null;

  const rawCommentId = raw.comment;
  const commentId =
    typeof rawCommentId === "number"
      ? rawCommentId
      : typeof rawCommentId === "string"
        ? Number(rawCommentId)
        : NaN;
  if (!Number.isFinite(commentId)) return null;

  const text = readString(raw, ["text", "content", "body"]);
  if (!text) return null;

  return {
    id,
    userId,
    commentId,
    text,
    createdAt: readString(raw, ["created_at", "createdAt"]),
  };
}

/** GET /api/statuses/<status_id>/comments/ — sorted oldest-first by the server. */
export async function fetchStatusComments(
  statusId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<ApiStatusCommentRecord[]> {
  const payload = await authenticatedApiRequest<unknown>(statusCommentsPath(statusId), {
    auth: tokens,
    onAuthRefresh,
  });

  return extractArrayPayload(payload, ["comments", "results", "items", "data"])
    .map((item) => normalizeComment(item))
    .filter((item): item is ApiStatusCommentRecord => Boolean(item));
}

/** POST /api/statuses/<status_id>/comments/ — post a comment on a status. */
export async function postStatusComment(
  statusId: string,
  text: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError("Comment text cannot be empty.", 400);
  }

  await authenticatedApiRequest<unknown>(statusCommentsPath(statusId), {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: { text: trimmed },
  });
}

/** DELETE /api/statuses/<status_id>/comments/ — delete a comment you authored. */
export async function deleteStatusComment(
  statusId: string,
  commentId: number,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<void> {
  await authenticatedApiRequest<unknown>(statusCommentsPath(statusId), {
    method: "DELETE",
    auth: tokens,
    onAuthRefresh,
    body: { comment_id: commentId },
  });
}

/** GET /api/statuses/comments/<comment_id>/replies/ — nested replies for a comment. */
export async function fetchCommentReplies(
  commentId: number,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<ApiStatusReplyRecord[]> {
  const payload = await authenticatedApiRequest<unknown>(commentRepliesPath(commentId), {
    auth: tokens,
    onAuthRefresh,
  });

  return extractArrayPayload(payload, ["replies", "results", "items", "data"])
    .map((item) => normalizeReply(item))
    .filter((item): item is ApiStatusReplyRecord => Boolean(item));
}

/** POST /api/statuses/comments/<comment_id>/replies/ — reply to a comment. */
export async function postCommentReply(
  commentId: number,
  text: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError("Reply text cannot be empty.", 400);
  }

  await authenticatedApiRequest<unknown>(commentRepliesPath(commentId), {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: { text: trimmed },
  });
}

/** DELETE /api/statuses/comments/<comment_id>/replies/ — delete a reply you authored. */
export async function deleteCommentReply(
  commentId: number,
  replyId: number,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
): Promise<void> {
  await authenticatedApiRequest<unknown>(commentRepliesPath(commentId), {
    method: "DELETE",
    auth: tokens,
    onAuthRefresh,
    body: { reply_id: replyId },
  });
}

export { readStringArray };

