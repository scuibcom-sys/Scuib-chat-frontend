import type { User } from "@/types/auths";
import type { CommunityRecord } from "@/types/community";
import type { GroupRecord } from "@/types/dashboard";
import { normalizeAbsoluteUrl } from "@/utils/url";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://scuib-chat-04do.onrender.com"
).replace(/\/+$/, "");

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

export const DEFAULT_GROUP_ACCENT_CHOICES = [
  "#12E66B",
  "#4294F7",
  "#EB72B6",
  "#FF9B42",
  "#B184F5",
  "#F3C623",
] as const;

const GROUP_STYLE_PRESETS = [
  {
    accent: "#12E66B",
    accentSoft: "#E9FBF0",
    avatarBackground: "#12E66B",
    joinBackground: "#12E66B",
    avatarSrc: "/design.svg",
  },
  {
    accent: "#4294F7",
    accentSoft: "#EAF3FF",
    avatarBackground: "#4294F7",
    joinBackground: "#4294F7",
    avatarSrc: "/design.svg",
  },
  {
    accent: "#EB72B6",
    accentSoft: "#FDEBF5",
    avatarBackground: "#EB72B6",
    joinBackground: "#EB72B6",
    avatarSrc: "/design.svg",
  },
  {
    accent: "#FF9B42",
    accentSoft: "#FFF1E5",
    avatarBackground: "#FF9B42",
    joinBackground: "#FF9B42",
    avatarSrc: "/design.svg",
  },
  {
    accent: "#B184F5",
    accentSoft: "#F2ECFF",
    avatarBackground: "#B184F5",
    joinBackground: "#B184F5",
    avatarSrc: "/design.svg",
  },
  {
    accent: "#F3C623",
    accentSoft: "#FFF7DB",
    avatarBackground: "#F3C623",
    joinBackground: "#F3C623",
    avatarSrc: "/design.svg",
  },
];

function normalizeGroupColor(color: string | null | undefined) {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : null;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return `rgba(92, 58, 38, ${alpha})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getGroupStylePreset(group: ApiGroupRecord, index: number) {
  const normalizedGroupKey = `${group.name} ${group.slug ?? ""}`
    .trim()
    .toLowerCase();

  if (
    normalizedGroupKey.includes("ui/ux") ||
    normalizedGroupKey.includes("uiux") ||
    normalizedGroupKey.includes("design")
  ) {
    return GROUP_STYLE_PRESETS[0];
  }

  if (normalizedGroupKey.includes("frontend")) {
    return GROUP_STYLE_PRESETS[3];
  }

  if (normalizedGroupKey.includes("backend")) {
    return GROUP_STYLE_PRESETS[1];
  }

  if (normalizedGroupKey.includes("mobile")) {
    return GROUP_STYLE_PRESETS[5];
  }

  return GROUP_STYLE_PRESETS[index % GROUP_STYLE_PRESETS.length];
}

export type ApiRecord = Record<string, unknown>;

export type AuthTokenType = "Bearer" | "Token";

export type AuthTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: AuthTokenType;
};

export type ApiGroupRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  icon?: string | null;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  unreadCount?: number;
  conversationId?: string | null;
  status?: "active" | "paused";
  color?: string | null;
  createdAt: string | null;
};

export type ApiProfileRecord = {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  categories: string[];
  skills: string[];
  linkedin: string;
  xHandle: string;
  portfolio: string;
};

type ApiRequestInit = Omit<RequestInit, "body" | "headers"> & {
  auth?: Partial<AuthTokens> | null;
  body?: unknown;
  headers?: HeadersInit;
};

type ApiQueryValue = string | string[] | undefined;

type AuthenticatedRequestInit = ApiRequestInit & {
  auth: Partial<AuthTokens>;
  onAuthRefresh?: (tokens: AuthTokens) => void;
};

const GENERIC_HTTP_ERROR_MESSAGES = new Set([
  "bad request",
  "unauthorized",
  "forbidden",
  "not found",
  "method not allowed",
  "conflict",
  "unprocessable entity",
  "too many requests",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
  "server error (500)",
  "request failed",
  "failed to fetch",
  "load failed",
  "network request failed",
]);

const PROFILE_READ_PATHS = [
  "/api/profile/me/",
];

const PROFILE_WRITE_PATHS = [
  "/api/profile/me/",
];

let preferredProfileReadPath: string | null = null;
let preferredProfileWritePath: string | null = null;

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getNestedRecord(value: unknown, keys: string[]): ApiRecord | null {
  for (const key of keys) {
    if (!isRecord(value)) continue;
    const nestedValue = value[key];
    if (isRecord(nestedValue)) {
      return nestedValue;
    }
  }

  return null;
}

export function getNestedArray(value: unknown, keys: string[]): unknown[] | null {
  for (const key of keys) {
    if (!isRecord(value)) continue;
    const nestedValue = value[key];
    if (Array.isArray(nestedValue)) {
      return nestedValue;
    }
  }

  return null;
}

export function extractArrayPayload(
  payload: unknown,
  keys: string[] = ["results", "items", "data", "groups", "conversations", "messages"],
): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const rootCandidates = [payload, getNestedRecord(payload, ["data", "result"])];

  for (const candidate of rootCandidates) {
    const nestedArray = getNestedArray(candidate, keys);
    if (nestedArray) {
      return nestedArray;
    }
  }

  return [];
}

export function readString(source: unknown, keys: string[]): string | null {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

export function readNumber(source: unknown, keys: string[]): number | null {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.replace(/,/g, "").trim();
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function readBoolean(source: unknown, keys: string[]): boolean | null {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

export function readStringArray(source: unknown, keys: string[]): string[] | null {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;

    const strings = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);

    if (strings.length > 0) {
      return strings;
    }

    if (value.length === 0) {
      return [];
    }
  }

  return null;
}

export function readStringList(source: unknown, keys: string[]): string[] | null {
  if (!isRecord(source)) return null;

  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;

    const strings = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (!isRecord(item)) {
          return "";
        }

        return (
          readString(item, [
            "name",
            "label",
            "title",
            "value",
            "slug",
            "id",
            "category",
            "skill",
          ]) ?? ""
        );
      })
      .filter(Boolean);

    if (strings.length > 0) {
      return strings;
    }

    if (value.length === 0) {
      return [];
    }
  }

  return null;
}

function normalizeMediaUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  if (trimmedValue.startsWith("data:")) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return `${API_BASE_URL}${trimmedValue}`;
  }

  const normalizedAbsoluteUrl = normalizeAbsoluteUrl(trimmedValue);
  if (normalizedAbsoluteUrl) {
    return normalizedAbsoluteUrl;
  }

  return `${API_BASE_URL}/${trimmedValue.replace(/^\/+/, "")}`;
}

export function readMediaUrl(source: unknown, keys: string[]) {
  return normalizeMediaUrl(readString(source, keys));
}

function getUserRecord(payload: unknown): ApiRecord | null {
  const rootCandidates = [payload, getNestedRecord(payload, ["data", "result"])];

  for (const candidate of rootCandidates) {
    const userRecord = getNestedRecord(candidate, ["user", "profile", "account"]);
    if (userRecord) return userRecord;
    if (isRecord(candidate) && readString(candidate, ["email", "username"])) {
      return candidate;
    }
  }

  return null;
}

export function buildDisplayName(userRecord: ApiRecord | null): string | undefined {
  if (!userRecord) return undefined;

  const directName = readString(userRecord, [
    "name",
    "full_name",
    "display_name",
    "fullName",
    "displayName",
    "member_name",
    "memberName",
    "participant_name",
    "participantName",
  ]);
  if (directName) return directName;

  const firstName = readString(userRecord, ["first_name", "firstName"]);
  const lastName = readString(userRecord, ["last_name", "lastName"]);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (combinedName) return combinedName;

  const fallbackName = readString(userRecord, [
    "username",
    "handle",
    "nickname",
    "user_name",
    "userName",
    "slug",
  ]);

  if (fallbackName) return fallbackName;

  return undefined;
}

function splitFullName(fullName: string | undefined) {
  const normalizedFullName = fullName?.trim() ?? "";
  if (!normalizedFullName) {
    return {
      normalizedFullName: "",
      firstName: "",
      lastName: "",
    };
  }

  const nameParts = normalizedFullName.split(/\s+/).filter(Boolean);
  const [firstName = "", ...remainingParts] = nameParts;

  return {
    normalizedFullName,
    firstName,
    lastName: remainingParts.join(" ").trim(),
  };
}

function buildProfileNameFieldVariants(fullName: string | undefined) {
  const { normalizedFullName, firstName, lastName } = splitFullName(fullName);

  if (!normalizedFullName) {
    return {};
  }

  return {
    name: normalizedFullName,
    full_name: normalizedFullName,
    display_name: normalizedFullName,
    fullName: normalizedFullName,
    displayName: normalizedFullName,
    nickname: normalizedFullName,
    ...(firstName ? { first_name: firstName, firstName } : {}),
    ...(lastName ? { last_name: lastName, lastName } : {}),
  };
}

function buildProfileUsernameFieldVariants(username: string | undefined) {
  const normalizedUsername = username?.trim() ?? "";
  if (!normalizedUsername) {
    return {};
  }

  return {
    username: normalizedUsername,
    handle: normalizedUsername,
    slug: normalizedUsername,
    user_name: normalizedUsername,
    userName: normalizedUsername,
  };
}

function detectAdmin(...sources: Array<ApiRecord | null>): boolean {
  const validSources = sources.filter(Boolean) as ApiRecord[];
  if (validSources.length === 0) return false;

  for (const source of validSources) {
    const explicitAdmin =
      readBoolean(source, [
        "is_admin",
        "isAdmin",
        "admin",
        "is_staff",
        "isStaff",
        "staff",
        "is_superuser",
        "isSuperuser",
        "superuser",
      ]) ?? false;

    if (explicitAdmin) {
      return true;
    }

    const role = readString(source, [
      "role",
      "user_role",
      "user_type",
      "type",
      "account_type",
      "membership_role",
      "member_role",
    ]);

    if (isElevatedRole(role)) {
      return true;
    }
  }

  return false;
}

export function isElevatedRole(role: string | null | undefined): boolean {
  if (!role) return false;

  return [
    "admin",
    "administrator",
    "superadmin",
    "super_admin",
    "staff",
    "owner",
    "manager",
  ].includes(role.trim().toLowerCase());
}

function looksLikeJwt(token: string) {
  const segments = token.split(".");
  if (segments.length !== 3) return false;
  return segments.every((segment) => segment.trim().length > 0);
}

function resolveTokenType(
  source: unknown,
  accessToken?: string | null,
): AuthTokenType {
  const tokenType = readString(source, ["token_type", "tokenType"]);
  if (tokenType?.toLowerCase() === "token") {
    return "Token";
  }
  if (tokenType?.toLowerCase() === "bearer") {
    return "Bearer";
  }

  const tokenHint =
    readString(source, ["key", "auth_token", "token"]) ?? accessToken;

  if (tokenHint && !looksLikeJwt(tokenHint)) {
    return "Token";
  }

  return "Bearer";
}

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return normalizeApiMessage(payload, fallback);
  }

  if (!isRecord(payload)) {
    return fallback;
  }

  const directMessage = readString(payload, [
    "detail",
    "message",
    "error",
    "non_field_errors",
  ]);

  if (directMessage) {
    return normalizeApiMessage(directMessage, fallback);
  }

  for (const [field, value] of Object.entries(payload)) {
    if (Array.isArray(value) && value.length > 0) {
      return normalizeApiMessage(`${field}: ${value.join(", ")}`, fallback);
    }
  }

  return fallback;
}

function normalizeApiMessage(
  message: string | null | undefined,
  fallback: string,
) {
  if (!message) return fallback;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) return fallback;

  const normalizedMessage = trimmedMessage.toLowerCase();
  if (
    normalizedMessage.startsWith("<!doctype html") ||
    normalizedMessage.startsWith("<html") ||
    normalizedMessage.includes("<head>") ||
    normalizedMessage.includes("<body>")
  ) {
    return fallback;
  }

  if (GENERIC_HTTP_ERROR_MESSAGES.has(normalizedMessage)) {
    return fallback;
  }

  if (
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("request failed")
  ) {
    return "We're having trouble connecting to our services. Please check your connection and try again.";
  }

  return trimmedMessage;
}

function buildAuthHeader(tokens?: Partial<AuthTokens> | null): string | null {
  if (!tokens?.accessToken) return null;
  return `${tokens.tokenType ?? "Bearer"} ${tokens.accessToken}`;
}

export function isSessionInvalidationError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 401 && error.status !== 403) return false;

  const normalizedMessage = error.message.trim().toLowerCase();
  return (
    normalizedMessage.includes("token is blacklisted") ||
    normalizedMessage.includes("blacklisted") ||
    normalizedMessage.includes("token not valid") ||
    normalizedMessage.includes("given token not valid") ||
    normalizedMessage.includes("invalid token") ||
    normalizedMessage.includes("token is invalid") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden")
  );
}

function isRefreshableAuthError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  if (error.status !== 403) return false;

  return isSessionInvalidationError(error);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const authHeader = buildAuthHeader(init.auth ?? null);

  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  const hasBody = init.body !== undefined;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body: hasBody ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    credentials: "include",
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(
      parseErrorMessage(payload, response.statusText || "Request failed"),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function refreshAccessToken(refreshToken: string) {
  const payload = await apiRequest<unknown>("/api/auth/refresh/", {
    method: "POST",
    body: { refresh: refreshToken },
  });
  const refreshedTokens = resolveAuthTokens(payload);

  if (!refreshedTokens.accessToken) {
    throw new ApiError("Refresh token response did not include an access token.", 500, payload);
  }

  return {
    accessToken: refreshedTokens.accessToken,
    refreshToken: refreshedTokens.refreshToken ?? refreshToken,
    tokenType: refreshedTokens.tokenType,
  } satisfies AuthTokens;
}

async function authenticatedApiRequest<T>(
  path: string,
  init: AuthenticatedRequestInit,
): Promise<T> {
  try {
    return await apiRequest<T>(path, init);
  } catch (error) {
    if (isRefreshableAuthError(error) && init.auth.refreshToken) {
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

function isRetryableGroupRequestError(error: unknown) {
  return (
    error instanceof ApiError &&
    [404, 500, 502, 503, 504].includes(error.status)
  );
}

async function waitForRetry(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function prioritizePreferredPath(paths: string[], preferredPath: string | null) {
  const uniquePaths = Array.from(new Set(paths));
  if (!preferredPath || !uniquePaths.includes(preferredPath)) {
    return uniquePaths;
  }

  return [
    preferredPath,
    ...uniquePaths.filter((path) => path !== preferredPath),
  ];
}

function rememberWorkingProfileReadPath(path: string) {
  if (PROFILE_READ_PATHS.includes(path)) {
    preferredProfileReadPath = path;
  }
}

function rememberWorkingProfileWritePath(path: string) {
  if (PROFILE_WRITE_PATHS.includes(path)) {
    preferredProfileWritePath = path;
  }
}

async function loadGroupRequestWithRetry<T>(
  path: string,
  tokens?: Partial<AuthTokens> | null,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  try {
    return tokens?.accessToken
      ? await authenticatedApiRequest<T>(path, {
          auth: tokens,
          onAuthRefresh,
        })
      : await apiRequest<T>(path);
  } catch (error) {
    if (
      error instanceof ApiError &&
      [500, 502, 503, 504].includes(error.status)
    ) {
      await waitForRetry(250);

      return tokens?.accessToken
        ? await authenticatedApiRequest<T>(path, {
            auth: tokens,
            onAuthRefresh,
          })
        : await apiRequest<T>(path);
    }

    throw error;
  }
}

async function apiRequestWithFallbackPaths<T>(
  paths: string[],
  init: ApiRequestInit = {},
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    try {
      return await apiRequest<T>(path, init);
    } catch (error) {
      lastError = error;

      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

async function authenticatedApiRequestWithFallbackPaths<T>(
  paths: string[],
  init: AuthenticatedRequestInit,
  fallbackStatusCodes: number[] = [404],
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

      if (
        !(error instanceof ApiError) ||
        !fallbackStatusCodes.includes(error.status)
      ) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

async function authenticatedApiRequestWithMethodAndBodyFallback<T>(
  paths: string[],
  methods: Array<"POST" | "PATCH" | "PUT">,
  bodies: Array<unknown | undefined>,
  init: Omit<AuthenticatedRequestInit, "body" | "method">,
  fallbackStatusCodes: number[] = [400, 404, 405, 415, 422],
  onSuccessPath?: (path: string) => void,
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    for (const method of methods) {
      for (const body of bodies) {
        try {
          const payload = await authenticatedApiRequest<T>(path, {
            ...init,
            method,
            body,
          });
          onSuccessPath?.(path);
          return payload;
        } catch (error) {
          lastError = error;

          if (
            !(error instanceof ApiError) ||
            !fallbackStatusCodes.includes(error.status)
          ) {
            throw error;
          }
        }
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

let preferredGroupApiBase = "/api/groups";

function getGroupPathCandidates(suffix = "/") {
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  const fallbackBase =
    preferredGroupApiBase === "/api/groups" ? "/groups" : "/api/groups";

  return [
    `${preferredGroupApiBase}${normalizedSuffix}`,
    `${fallbackBase}${normalizedSuffix}`,
  ];
}

function rememberWorkingGroupPath(path: string) {
  preferredGroupApiBase = path.startsWith("/api/groups/") ? "/api/groups" : "/groups";
}

export function normalizeUser(
  payload: unknown,
  tokens?: Partial<AuthTokens>,
  fallbackEmail?: string,
): User | null {
  const userRecord = getUserRecord(payload);
  const rootRecord = isRecord(payload) ? payload : null;
  const nestedResultRecord = getNestedRecord(payload, ["data", "result"]);
  const resolvedTokens = resolveAuthTokens(payload);
  const email =
    readString(userRecord, ["email"]) ??
    readString(payload, ["email"]) ??
    fallbackEmail;
  const avatarUrl =
    readMediaUrl(userRecord, [
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
    readMediaUrl(payload, [
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
    ]);
  const username =
    readString(userRecord, ["username", "handle", "slug"]) ??
    readString(payload, ["username", "handle", "slug"]);

  if (!email) return null;

  const role =
    readString(userRecord, ["role", "user_type", "type"]) ??
    readString(payload, ["role", "user_type", "type"]);

  const accessToken =
    tokens?.accessToken ??
    resolvedTokens.accessToken ??
    null;
  const refreshToken =
    tokens?.refreshToken ??
    resolvedTokens.refreshToken ??
    null;
  const tokenType = tokens?.tokenType ?? resolveTokenType(payload, accessToken);
  const emailVerified =
    readBoolean(userRecord, [
      "email_verified",
      "is_email_verified",
      "is_verified",
      "verified",
    ]) ??
    readBoolean(payload, [
      "email_verified",
      "is_email_verified",
      "is_verified",
      "verified",
    ]);

  return {
    id:
      readString(userRecord, ["id", "pk", "uuid"]) ??
      readString(payload, ["id", "pk", "uuid"]) ??
      email,
    email,
    name: buildDisplayName(userRecord),
    username,
    avatarUrl,
    role,
    isAdmin: detectAdmin(userRecord, rootRecord, nestedResultRecord),
    emailVerified,
    accessToken,
    refreshToken,
    tokenType,
  };
}

export function resolveAuthTokens(payload: unknown): AuthTokens {
  const tokenRoot =
    getNestedRecord(payload, ["tokens", "data", "result"]) ??
    (isRecord(payload) ? payload : null);

  const accessToken =
    readString(tokenRoot, [
      "access",
      "access_token",
      "token",
      "auth_token",
      "key",
      "jwt",
    ]) ?? null;
  const refreshToken =
    readString(tokenRoot, ["refresh", "refresh_token"]) ?? null;

  return {
    accessToken,
    refreshToken,
    tokenType: resolveTokenType(tokenRoot, accessToken),
  };
}

export async function loginWithApi(email: string, password: string) {
  return apiRequest<unknown>("/api/auth/login/", {
    method: "POST",
    body: { email, password },
  });
}

export async function registerWithApi(
  email: string,
  password: string,
  confirmPassword: string,
) {
  const baseBody = {
    email,
    password,
    confirm_password: confirmPassword,
  };
  const verifyEmailEntryUrl = buildVerifyEmailEntryUrl();
  const requestBodies = verifyEmailEntryUrl
    ? [
        {
          body: {
            ...baseBody,
            verification_url: verifyEmailEntryUrl,
          },
          callbackField: "verification_url",
        },
        {
          body: {
            ...baseBody,
            redirect_url: verifyEmailEntryUrl,
          },
          callbackField: "redirect_url",
        },
        {
          body: {
            ...baseBody,
            callback_url: verifyEmailEntryUrl,
          },
          callbackField: "callback_url",
        },
        {
          body: {
            ...baseBody,
            frontend_url: verifyEmailEntryUrl,
          },
          callbackField: "frontend_url",
        },
        {
          body: {
            ...baseBody,
            confirm_email_url: verifyEmailEntryUrl,
          },
          callbackField: "confirm_email_url",
        },
        {
          body: {
            ...baseBody,
            email_verification_url: verifyEmailEntryUrl,
          },
          callbackField: "email_verification_url",
        },
        {
          body: {
            ...baseBody,
            confirmation_url: verifyEmailEntryUrl,
          },
          callbackField: "confirmation_url",
        },
        {
          body: baseBody,
          callbackField: null,
        },
      ]
    : [
        {
          body: baseBody,
          callbackField: null,
        },
      ];

  for (const requestBody of requestBodies) {
    try {
      return await apiRequest<unknown>("/api/auth/register/", {
        method: "POST",
        body: requestBody.body,
      });
    } catch (error) {
      if (
        requestBody.callbackField &&
        isUnsupportedCallbackFieldError(error, requestBody.callbackField)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ApiError("Signup failed", 500);
}

export async function fetchApiRootStatus() {
  return apiRequest<unknown>("/api");
}

function buildQueryString(params: Record<string, ApiQueryValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) {
          searchParams.append(key, entry);
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      searchParams.set(key, value);
    }
  }

  return searchParams.toString();
}

export async function verifyEmailWithApi(
  params: Record<string, ApiQueryValue>,
) {
  const queryString = buildQueryString(params);
  const path = queryString
    ? `/api/auth/verify-email/?${queryString}`
    : "/api/auth/verify-email/";

  return apiRequest<unknown>(path);
}

export async function completeGoogleAuthCallback(
  params: Record<string, ApiQueryValue>,
) {
  const queryString = buildQueryString(params);
  const paths = [
    queryString
      ? `/auth/google/callback/?${queryString}`
      : "/auth/google/callback/",
    queryString
      ? `/api/auth/google/callback/?${queryString}`
      : "/api/auth/google/callback/",
  ];

  return apiRequestWithFallbackPaths<unknown>(paths);
}

export async function fetchCurrentUser(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequest<unknown>("/api/auth/me/", {
    auth: tokens,
    onAuthRefresh,
  });

  return normalizeUser(payload, tokens) ?? null;
}

export async function requestPasswordReset(email: string) {
  return apiRequest<unknown>("/api/auth/password/forgot/", {
    method: "POST",
    body: { email },
  });
}

export async function resetPasswordWithToken(
  options: {
    body: Record<string, unknown>;
    queryParams?: Record<string, ApiQueryValue>;
  },
) {
  const queryString = buildQueryString(options.queryParams ?? {});
  const paths = [
    queryString
      ? `/api/auth/password/reset/confirm/?${queryString}`
      : "/api/auth/password/reset/confirm/",
    queryString
      ? `/api/auth/password/reset/?${queryString}`
      : "/api/auth/password/reset/",
  ];

  return apiRequestWithFallbackPaths<unknown>(
    paths.map((path) => path),
    {
      method: "POST",
      body: options.body,
    },
  );
}

export async function logoutWithApi(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequest<unknown>("/api/auth/logout/", {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body: tokens.refreshToken ? { refresh: tokens.refreshToken } : {},
  });
}

function normalizeProfile(payload: unknown): ApiProfileRecord {
  const rootRecord = isRecord(payload) ? payload : null;
  const topLevelDataRecord = getNestedRecord(payload, ["data", "result"]);
  const profileContainerRecord =
    getNestedRecord(payload, ["profile"]) ??
    getNestedRecord(topLevelDataRecord, ["profile"]) ??
    topLevelDataRecord ??
    rootRecord;
  const profileRecord =
    getNestedRecord(profileContainerRecord, ["profile"]) ?? profileContainerRecord;
  const nestedUserRecord =
    getNestedRecord(profileRecord, ["user", "account", "owner"]) ??
    getNestedRecord(profileContainerRecord, ["user", "account", "owner"]) ??
    getNestedRecord(payload, ["user", "account", "owner"]);
  const profileName =
    buildDisplayName(profileRecord) ??
    buildDisplayName(profileContainerRecord) ??
    buildDisplayName(nestedUserRecord) ??
    readString(topLevelDataRecord, [
      "name",
      "full_name",
      "display_name",
      "fullName",
      "displayName",
      "username",
      "handle",
      "slug",
    ]) ??
    readString(rootRecord, [
      "name",
      "full_name",
      "display_name",
      "fullName",
      "displayName",
      "username",
      "handle",
      "slug",
    ]) ??
    "";
  const profileUsername =
    readString(profileRecord, ["username", "handle", "slug"]) ??
    readString(profileContainerRecord, ["username", "handle", "slug"]) ??
    readString(nestedUserRecord, ["username", "handle", "slug"]) ??
    readString(topLevelDataRecord, ["username", "handle", "slug"]) ??
    "";
  const avatarUrl =
    readMediaUrl(profileRecord, [
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
    readMediaUrl(profileContainerRecord, [
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
    readMediaUrl(nestedUserRecord, [
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
    ]);

  return {
    fullName: profileName,
    username: profileUsername,
    avatarUrl,
    bio:
      readString(profileRecord, ["bio", "about", "description"]) ??
      readString(profileContainerRecord, ["bio", "about", "description"]) ??
      "",
    categories:
      readStringList(profileRecord, [
        "categories",
        "selected_categories",
        "interests",
      ]) ??
      readStringList(profileContainerRecord, [
        "categories",
        "selected_categories",
        "interests",
      ]) ??
      [],
    skills:
      readStringList(profileRecord, ["skills", "selected_skills"]) ??
      readStringList(profileContainerRecord, ["skills", "selected_skills"]) ??
      [],
    linkedin:
      readString(profileRecord, ["linkedin", "linkedin_url", "linkedinUrl"]) ??
      readString(profileContainerRecord, ["linkedin", "linkedin_url", "linkedinUrl"]) ??
      "",
    xHandle:
      readString(profileRecord, ["x", "x_handle", "xHandle", "twitter", "twitter_handle"]) ??
      readString(profileContainerRecord, [
        "x",
        "x_handle",
        "xHandle",
        "twitter",
        "twitter_handle",
      ]) ??
      "",
    portfolio:
      readString(profileRecord, ["portfolio", "portfolio_url", "website", "website_url"]) ??
      readString(profileContainerRecord, [
        "portfolio",
        "portfolio_url",
        "website",
        "website_url",
      ]) ??
      "",
  };
}

export function isProfileComplete(profile: ApiProfileRecord) {
  return (
    profile.bio.trim().length > 0 &&
    profile.categories.length > 0 &&
    profile.skills.length > 0
  );
}

export async function fetchProfile(
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    prioritizePreferredPath(PROFILE_READ_PATHS, preferredProfileReadPath),
    {
      auth: tokens,
      onAuthRefresh,
    },
    [404, 500, 502, 503, 504],
    rememberWorkingProfileReadPath,
  );

  return normalizeProfile(payload);
}

// ─── Public profile + Guest DM ───────────────────────────────────────────────
// These two endpoints are unauthenticated — AllowAny on the backend.
// They support the Public DM feature where a guest visitor can view a
// user's public profile and send them a direct message without signing in.

export type ApiPublicProfileRecord = {
  username: string | null;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  categories: string[];
  skills: string[];
  xUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
};

function normalizePublicProfile(payload: unknown): ApiPublicProfileRecord {
  const record = isRecord(payload) ? payload : null;

  return {
    username: readString(record, ["username", "handle"]),
    email: readString(record, ["email"]),
    bio: readString(record, ["bio", "description"]),
    avatarUrl: readMediaUrl(record, [
      "avatar_url",
      "avatarUrl",
      "avatar",
      "profile_picture",
      "profilePicture",
      "image",
    ]),
    categories: readStringArray(record, ["categories"]) ?? [],
    skills: readStringArray(record, ["skills"]) ?? [],
    xUrl: readString(record, ["x_url", "xUrl", "twitter_url", "twitterUrl"]),
    linkedinUrl: readString(record, ["linkedin_url", "linkedinUrl", "linkedin"]),
    portfolioUrl: readString(record, ["portfolio_url", "portfolioUrl", "portfolio"]),
  };
}

/**
 * GET /profile?username= — fetch a user's public profile.
 * No authentication required. Returns null if the user doesn't exist (404).
 */
export async function fetchPublicProfile(
  username: string,
): Promise<ApiPublicProfileRecord | null> {
  try {
    const payload = await apiRequest<unknown>(
      `/api/profile${buildQueryString({ username: username.trim() })}`,
    );
    return normalizePublicProfile(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export type PublicDmError =
  | "self_message"
  | "email_registered"
  | "rate_limited"
  | "unknown";

export type SendPublicDmResult =
  | { ok: true; conversationId: string }
  | { ok: false; errorType: PublicDmError; message: string };

/**
 * POST /messages/dm/<username>/ — send a DM as a guest.
 * No authentication required.
 *
 * Returns a typed result object rather than throwing, so the calling
 * component can handle the two documented edge cases cleanly:
 *   - self_message: guest used the profile owner's own email
 *   - email_registered: email belongs to an existing user → prompt login
 */
export async function sendPublicDm(
  username: string,
  input: { senderEmail: string; content: string },
): Promise<SendPublicDmResult> {
  try {
    const payload = await apiRequest<unknown>(
      `/api/messages/dm/${username.trim()}/`,
      {
        method: "POST",
        body: {
          sender_email: input.senderEmail.trim(),
          content: input.content.trim(),
          message_type: "text",
        },
      },
    );

    const record = isRecord(payload) ? payload : null;
    const conversationId =
      readString(record, ["conversation_id", "conversationId"]) ?? "";

    return { ok: true, conversationId };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      const details = isRecord(error.details) ? error.details : null;
      const errorMessage =
        readString(details, ["error", "detail", "message"]) ?? "";

      if (
        errorMessage.toLowerCase().includes("yourself") ||
        errorMessage.toLowerCase().includes("self")
      ) {
        return {
          ok: false,
          errorType: "self_message",
          message: "You can't send a message to yourself.",
        };
      }

      if (
        errorMessage.toLowerCase().includes("registered") ||
        errorMessage.toLowerCase().includes("log in") ||
        errorMessage.toLowerCase().includes("sign in")
      ) {
        return {
          ok: false,
          errorType: "email_registered",
          message:
            "That email belongs to an existing account. Please sign in to send a message.",
        };
      }

      return {
        ok: false,
        errorType: "unknown",
        message: errorMessage || "Couldn't send your message. Please try again.",
      };
    }

    if (error instanceof ApiError && error.status === 429) {
      return {
        ok: false,
        errorType: "rate_limited",
        message: "Too many messages sent. Please wait a moment before trying again.",
      };
    }

    return {
      ok: false,
      errorType: "unknown",
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn't send your message. Please try again.",
    };
  }
}

export async function updateProfile(
  tokens: Partial<AuthTokens>,
  profile: {
    fullName?: string;
    username?: string;
    avatarUrl?: string | null;
    bio: string;
    categories: string[];
    skills: string[];
    categoryLabels?: string[];
    skillLabels?: string[];
    linkedin?: string;
    xHandle?: string;
    portfolio?: string;
  },
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const normalizedNameFields = buildProfileNameFieldVariants(profile.fullName);
  const normalizedUsernameFields = buildProfileUsernameFieldVariants(profile.username);
  const normalizedCategoryLabels =
    profile.categoryLabels?.map((category) => category.trim()).filter(Boolean) ?? [];
  const normalizedSkillLabels =
    profile.skillLabels?.map((skill) => skill.trim()).filter(Boolean) ?? [];
  const normalizedLinkedin = profile.linkedin?.trim() ?? "";
  const normalizedXHandle = profile.xHandle?.trim() ?? "";
  const normalizedPortfolio = profile.portfolio?.trim() ?? "";
  const requestBodies = [
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? {
        avatar_url: profile.avatarUrl,
        avatar: profile.avatarUrl,
        profile_picture: profile.avatarUrl,
        image: profile.avatarUrl,
      } : {}),
      bio: profile.bio,
      about: profile.bio,
      description: profile.bio,
      categories: profile.categories,
      skills: profile.skills,
      selected_categories:
        normalizedCategoryLabels.length > 0
          ? normalizedCategoryLabels
          : profile.categories,
      selected_skills:
        normalizedSkillLabels.length > 0
          ? normalizedSkillLabels
          : profile.skills,
      ...(normalizedLinkedin
        ? {
            linkedin: normalizedLinkedin,
            linkedin_url: normalizedLinkedin,
          }
        : {}),
      ...(normalizedXHandle
        ? {
            x: normalizedXHandle,
            x_handle: normalizedXHandle,
            twitter: normalizedXHandle,
            twitter_handle: normalizedXHandle,
          }
        : {}),
      ...(normalizedPortfolio
        ? {
            portfolio: normalizedPortfolio,
            portfolio_url: normalizedPortfolio,
            website: normalizedPortfolio,
            website_url: normalizedPortfolio,
          }
        : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { avatar_url: profile.avatarUrl } : {}),
      bio: profile.bio,
      categories: profile.categories,
      skills: profile.skills,
      ...(normalizedLinkedin ? { linkedin: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { x_handle: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { portfolio: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { avatar: profile.avatarUrl } : {}),
      bio: profile.bio,
      selected_categories: profile.categories,
      selected_skills: profile.skills,
      ...(normalizedLinkedin ? { linkedin_url: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { x: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { portfolio_url: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { profile_picture: profile.avatarUrl } : {}),
      bio: profile.bio,
      categories: profile.categories,
      skills: profile.skills,
      selected_categories: profile.categories,
      selected_skills: profile.skills,
      ...(normalizedLinkedin ? { linkedin: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { twitter: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { website: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { avatar: profile.avatarUrl } : {}),
      about: profile.bio,
      categories: profile.categories,
      skills: profile.skills,
      ...(normalizedLinkedin ? { linkedin: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { x_handle: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { website_url: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      description: profile.bio,
      categories: profile.categories,
      skills: profile.skills,
      ...(normalizedLinkedin ? { linkedin_url: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { twitter_handle: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { portfolio: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { avatar_url: profile.avatarUrl } : {}),
      bio: profile.bio,
      categories:
        normalizedCategoryLabels.length > 0
          ? normalizedCategoryLabels
          : profile.categories,
      skills:
        normalizedSkillLabels.length > 0 ? normalizedSkillLabels : profile.skills,
      ...(normalizedLinkedin ? { linkedin: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { x_handle: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { portfolio: normalizedPortfolio } : {}),
    },
    {
      ...normalizedNameFields,
      ...normalizedUsernameFields,
      ...(profile.avatarUrl ? { avatar: profile.avatarUrl } : {}),
      bio: profile.bio,
      selected_categories:
        normalizedCategoryLabels.length > 0
          ? normalizedCategoryLabels
          : profile.categories,
      selected_skills:
        normalizedSkillLabels.length > 0 ? normalizedSkillLabels : profile.skills,
      ...(normalizedLinkedin ? { linkedin_url: normalizedLinkedin } : {}),
      ...(normalizedXHandle ? { x: normalizedXHandle } : {}),
      ...(normalizedPortfolio ? { portfolio_url: normalizedPortfolio } : {}),
    },
  ];

  const payload = await authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
    prioritizePreferredPath(PROFILE_WRITE_PATHS, preferredProfileWritePath),
    ["PATCH", "POST", "PUT"],
    requestBodies,
    {
      auth: tokens,
      onAuthRefresh,
    },
    [400, 404, 405, 415, 422, 500, 502, 503, 504],
    rememberWorkingProfileWritePath,
  );

  return normalizeProfile(payload);
}

export async function requestProfileAvatarUploadSignature(
  tokens: Partial<AuthTokens>,
  body: Record<string, unknown>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequest<unknown>("/api/profile/avatar/signature/", {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body,
  });
}

export async function confirmProfileAvatarUpload(
  tokens: Partial<AuthTokens>,
  body: Record<string, unknown>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequest<unknown>("/api/profile/avatar/confirm/", {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
    body,
  });
}

async function parseUploadResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

export const SESSION_EXPIRED_ERROR_MESSAGE = "Your session expired. Please sign in again.";

const CLOUDINARY_SIGNATURE_RECORD_KEYS = [
  "params",
  "parameters",
  "fields",
  "form",
  "upload",
  "upload_params",
  "signature_params",
] as const;

const CLOUDINARY_SIGNATURE_META_KEYS = new Set([
  "cloud_name",
  "cloudName",
  "resource_type",
  "resourceType",
  "upload_url",
  "uploadUrl",
  "url",
  "endpoint",
  "api_base_url",
  "apiBaseUrl",
]);

const CLOUDINARY_UPLOAD_PARAM_ALIASES: Record<string, string> = {
  apiKey: "api_key",
  assetFolder: "asset_folder",
  displayName: "display_name",
  invalidateDerived: "invalidate_derived",
  overwriteOriginal: "overwrite_original",
  publicId: "public_id",
  resourceType: "resource_type",
  uniqueFilename: "unique_filename",
  uploadPreset: "upload_preset",
  useFilename: "use_filename",
};

const CLOUDINARY_DEBUG_MASKED_KEYS = new Set([
  "api_key",
  "signature",
]);

function normalizeCloudinaryUploadParamKey(key: string) {
  return CLOUDINARY_UPLOAD_PARAM_ALIASES[key] ?? key;
}

function maskCloudinaryDebugValue(key: string, value: string) {
  if (!CLOUDINARY_DEBUG_MASKED_KEYS.has(key)) {
    return value;
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function appendCloudinaryUploadParam(
  params: Map<string, string>,
  key: string,
  value: unknown,
) {
  const normalizedKey = normalizeCloudinaryUploadParamKey(key);

  if (CLOUDINARY_SIGNATURE_META_KEYS.has(key) || CLOUDINARY_SIGNATURE_META_KEYS.has(normalizedKey)) {
    return;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      params.set(normalizedKey, trimmed);
    }
    return;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    params.set(normalizedKey, String(value));
    return;
  }

  if (Array.isArray(value)) {
    const normalizedValue = value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (typeof item === "number" || typeof item === "boolean") {
          return String(item);
        }

        return "";
      })
      .filter(Boolean)
      .join(",");

    if (normalizedValue) {
      params.set(normalizedKey, normalizedValue);
    }
  }
}

function collectCloudinaryUploadParams(signatureRecord: ApiRecord | null) {
  const params = new Map<string, string>();

  if (!signatureRecord) {
    return params;
  }

  const paramSources = [
    ...CLOUDINARY_SIGNATURE_RECORD_KEYS.map((key) => getNestedRecord(signatureRecord, [key])),
    signatureRecord,
  ];

  for (const source of paramSources) {
    if (!isRecord(source)) {
      continue;
    }

    for (const [key, value] of Object.entries(source)) {
      if (isRecord(value)) {
        continue;
      }

      appendCloudinaryUploadParam(params, key, value);
    }
  }

  return params;
}

function buildCloudinaryUploadTargets(
  signatureRecord: ApiRecord | null,
  fallbackResourceType: string,
) {
  const cloudName = readString(signatureRecord, ["cloud_name", "cloudName"]);
  const uploadUrl =
    readString(signatureRecord, ["upload_url", "uploadUrl", "endpoint"]) ??
    readString(getNestedRecord(signatureRecord, ["upload"]), ["url", "endpoint"]);
  const apiBaseUrl =
    readString(signatureRecord, ["api_base_url", "apiBaseUrl"]) ??
    "https://api.cloudinary.com/v1_1";
  const resourceType =
    readString(signatureRecord, ["resource_type", "resourceType"]) ?? fallbackResourceType;

  const inferredTargets =
    cloudName && resourceType
      ? [
          `${apiBaseUrl}/${cloudName}/${resourceType}/upload`,
          `${apiBaseUrl}/${cloudName}/image/upload`,
          `${apiBaseUrl}/${cloudName}/auto/upload`,
        ]
      : [];

  return Array.from(
    new Set(
      [uploadUrl, ...inferredTargets].filter((target): target is string => Boolean(target)),
    ),
  );
}

function buildCloudinaryUploadDebugSummary(
  signatureRecord: ApiRecord | null,
  formEntries: Array<[string, string | Blob]>,
  uploadTargets: string[],
  file: File,
) {
  const paramsPreviewEntries: Array<[string, string]> = [];
  for (const [key, value] of formEntries) {
    if (key === "file" || typeof value !== "string") {
      continue;
    }

    paramsPreviewEntries.push([key, maskCloudinaryDebugValue(key, value)]);
  }

  const paramsPreview = Object.fromEntries(paramsPreviewEntries);

  return {
    file: {
      name: file.name,
      type: file.type || null,
      size: file.size,
    },
    cloudName: readString(signatureRecord, ["cloud_name", "cloudName"]),
    resourceType:
      readString(signatureRecord, ["resource_type", "resourceType"]) ?? "unknown",
    uploadTargets,
    signatureRecordKeys: signatureRecord ? Object.keys(signatureRecord) : [],
    uploadParamKeys: formEntries.map(([key]) => key),
    paramsPreview,
  };
}

function buildCloudinaryUploadFailureMessage(lastUploadStatus: number, fallbackMessage: string) {
  if (lastUploadStatus === 401) {
    return "Cloudinary rejected the upload signature. This usually means the backend returned an invalid or expired signature.";
  }

  return fallbackMessage;
}

export function logCloudinaryUploadFailure(
  context: string,
  signatureRecord: ApiRecord | null,
  formEntries: Array<[string, string | Blob]>,
  uploadTargets: string[],
  file: File,
  attempts: Array<{ status: number; url: string; payload: unknown }>,
) {
  console.error("[Scuib Cloudinary upload debug]", {
    context,
    summary: buildCloudinaryUploadDebugSummary(signatureRecord, formEntries, uploadTargets, file),
    attempts,
  });
}

export function buildCloudinarySignedUploadRequest(
  signaturePayload: unknown,
  file: File,
  fallbackResourceType = "image",
) {
  const signatureRecord =
    getNestedRecord(signaturePayload, ["data", "result"]) ??
    getNestedRecord(signaturePayload, ["data"]) ??
    getNestedRecord(signaturePayload, ["result"]) ??
    (isRecord(signaturePayload) ? signaturePayload : null);

  const cloudName = readString(signatureRecord, ["cloud_name", "cloudName"]);
  const apiKey = readString(signatureRecord, ["api_key", "apiKey"]);
  const signature = readString(signatureRecord, ["signature"]);
  const timestamp = readString(signatureRecord, ["timestamp"]);
  const uploadTargets = buildCloudinaryUploadTargets(signatureRecord, fallbackResourceType);
  const uploadParams = collectCloudinaryUploadParams(signatureRecord);

  if (!cloudName || !apiKey || !signature || !timestamp || uploadTargets.length === 0) {
    throw new ApiError(
      "The upload signature response is missing required Cloudinary fields.",
      500,
      signaturePayload,
    );
  }

  uploadParams.set("api_key", apiKey);
  uploadParams.set("timestamp", timestamp);
  uploadParams.set("signature", signature);

  const formEntries: Array<[string, string | Blob]> = [["file", file]];
  for (const [key, value] of uploadParams.entries()) {
    formEntries.push([key, value]);
  }

  return {
    formEntries,
    signatureRecord,
    uploadTargets,
  };
}

export async function uploadProfileAvatar(
  file: File,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const signaturePayload = await requestProfileAvatarUploadSignature(
    tokens,
    {
      file_name: file.name,
      content_type: file.type || undefined,
      resource_type: "image",
    },
    onAuthRefresh,
  );
  const { formEntries, signatureRecord, uploadTargets } = buildCloudinarySignedUploadRequest(
    signaturePayload,
    file,
    "image",
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

    uploadedFilePayload = uploadResponsePayload;
    lastUploadStatus = uploadResponse.status;
    uploadAttemptErrors.push({
      status: uploadResponse.status,
      url: uploadUrl,
      payload: uploadResponsePayload,
    });
  }

  const uploadedFileRecord = isRecord(uploadedFilePayload) ? uploadedFilePayload : null;
  const uploadedPublicId =
    readString(uploadedFileRecord, ["public_id", "asset_id", "file_id", "id"]) ?? null;
  const uploadedAssetId =
    readString(uploadedFileRecord, ["asset_id", "public_id", "file_id", "id"]) ?? null;
  const uploadedSecureUrl =
    readMediaUrl(uploadedFileRecord, ["secure_url", "url", "file_url", "public_url", "path"]) ??
    null;

  if (!uploadedSecureUrl) {
    logCloudinaryUploadFailure(
      "profile-avatar",
      signatureRecord,
      formEntries,
      uploadTargets,
      file,
      uploadAttemptErrors,
    );
    throw new ApiError(
      buildCloudinaryUploadFailureMessage(
        lastUploadStatus,
        "Unable to upload the selected profile photo.",
      ),
      lastUploadStatus,
      {
        attempts: uploadAttemptErrors,
        lastResponse: uploadedFilePayload,
      },
    );
  }

  const confirmBodies = [
    {
      avatar_url: uploadedSecureUrl,
      public_id: uploadedPublicId,
      asset_id: uploadedAssetId,
    },
    {
      avatar: uploadedSecureUrl,
      public_id: uploadedPublicId,
      asset_id: uploadedAssetId,
    },
    {
      profile_picture: uploadedSecureUrl,
      public_id: uploadedPublicId,
      asset_id: uploadedAssetId,
    },
    {
      image: uploadedSecureUrl,
      public_id: uploadedPublicId,
      asset_id: uploadedAssetId,
    },
    {
      secure_url: uploadedSecureUrl,
      public_id: uploadedPublicId,
      asset_id: uploadedAssetId,
    },
  ];

  try {
    const confirmationPayload = await authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
      ["/api/profile/avatar/confirm/"],
      ["POST"],
      confirmBodies,
      {
        auth: tokens,
        onAuthRefresh,
      },
    );
    const confirmationRecord =
      getNestedRecord(confirmationPayload, ["data", "result"]) ??
      getNestedRecord(confirmationPayload, ["data"]) ??
      getNestedRecord(confirmationPayload, ["result"]) ??
      (isRecord(confirmationPayload) ? confirmationPayload : null);

    return (
      readMediaUrl(confirmationRecord, [
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
      uploadedSecureUrl
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return uploadedSecureUrl;
    }

    throw error;
  }
}

function normalizeGroup(rawGroup: unknown): ApiGroupRecord | null {
  if (!isRecord(rawGroup)) return null;

  const slug = readString(rawGroup, ["slug", "group_slug"]) ?? null;
  const id =
    readString(rawGroup, ["id", "pk", "uuid"]) ??
    readString(rawGroup, ["group_id", "community_id", "clique_id"]) ??
    slug;
  const name = readString(rawGroup, ["name", "title", "group_name"]);
  const conversationRecord = getNestedRecord(rawGroup, [
    "conversation",
    "chat",
    "thread",
    "message_thread",
  ]);
  const explicitStatus = readString(rawGroup, ["status", "state", "label"]);
  const isPaused =
    readBoolean(rawGroup, ["is_paused", "paused"]) ?? null;
  const isActive =
    readBoolean(rawGroup, ["is_active", "active", "enabled"]) ?? null;

  if (!id || !name) return null;

  let status: "active" | "paused" = "active";
  const normalizedStatus = explicitStatus?.trim().toLowerCase() ?? null;

  if (
    normalizedStatus &&
    ["paused", "inactive", "disabled", "archived"].includes(normalizedStatus)
  ) {
    status = "paused";
  } else if (
    normalizedStatus &&
    ["active", "enabled", "live"].includes(normalizedStatus)
  ) {
    status = "active";
  } else if (isPaused === true || isActive === false) {
    status = "paused";
  }

  const appearanceRecord =
    getNestedRecord(rawGroup, ["appearance", "theme", "style", "branding", "settings"]) ??
    getNestedRecord(rawGroup, ["group", "community", "clique"]);

  return {
    id,
    slug,
    name,
    description:
      readString(rawGroup, ["description", "bio", "about", "summary"]) ??
      "Community ready for members and conversation.",
    icon: readString(rawGroup, ["icon", "emoji", "symbol"]) ?? null,
    memberCount:
      readNumber(rawGroup, [
        "member_count",
        "members_count",
        "members",
        "total_members",
      ]) ?? 0,
    postCount:
      readNumber(rawGroup, ["post_count", "posts_count", "posts", "total_posts"]) ?? 0,
    isJoined:
      readBoolean(rawGroup, ["is_member", "joined", "is_joined", "member"]) ?? false,
    unreadCount:
      readNumber(rawGroup, [
        "unread_count",
        "unread",
        "unread_messages",
        "unreadCount",
      ]) ?? 0,
    conversationId:
      readString(conversationRecord, ["id", "pk", "uuid", "conversation_id"]) ??
      readString(rawGroup, [
        "conversation_id",
        "chat_id",
        "thread_id",
        "message_thread_id",
      ]) ??
      null,
    status,
    color:
      readString(rawGroup, [
        "color",
        "accent",
        "hex",
        "group_color",
        "theme_color",
        "brand_color",
      ]) ??
      readString(appearanceRecord, [
        "color",
        "accent",
        "hex",
        "group_color",
        "theme_color",
        "brand_color",
      ]) ??
      null,
    createdAt:
      readString(rawGroup, ["created_at", "createdAt", "created", "date_created"]) ??
      null,
  };
}

export async function fetchGroups(
  tokens?: Partial<AuthTokens> | null,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  try {
    const paths = getGroupPathCandidates("/");
    let payload: unknown;
    let workingPath: string | null = null;

    for (const path of paths) {
      try {
        payload = await loadGroupRequestWithRetry<unknown>(
          path,
          tokens,
          onAuthRefresh,
        );
        workingPath = path;
        break;
      } catch (error) {
        if (!isRetryableGroupRequestError(error)) {
          throw error;
        }
      }
    }

    if (!workingPath) {
      throw new ApiError("Unable to load groups from the API.", 404);
    }

    rememberWorkingGroupPath(workingPath);

    return extractArrayPayload(payload, ["groups", "results", "items", "data"])
      .map((group) => normalizeGroup(group))
      .filter((group): group is ApiGroupRecord => Boolean(group));
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      return [];
    }

    throw error;
  }
}

async function apiRequestWithWorkingGroupPath<T>(
  suffix: string,
  init: ApiRequestInit = {},
) {
  const paths = getGroupPathCandidates(suffix);
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const payload = await apiRequest<T>(path, init);
      rememberWorkingGroupPath(path);
      return payload;
    } catch (error) {
      lastError = error;

      if (!isRetryableGroupRequestError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 404);
}

async function authenticatedApiRequestWithWorkingGroupPath<T>(
  suffix: string,
  init: AuthenticatedRequestInit,
) {
  const paths = getGroupPathCandidates(suffix);
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const payload = await authenticatedApiRequest<T>(path, init);
      rememberWorkingGroupPath(path);
      return payload;
    } catch (error) {
      lastError = error;

      if (!isRetryableGroupRequestError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 404);
}

function buildUniqueGroupIdentifiers(
  identifiers: Array<string | null | undefined>,
) {
  return Array.from(
    new Set(
      identifiers
        .map((identifier) => identifier?.trim())
        .filter((identifier): identifier is string => Boolean(identifier)),
    ),
  );
}

export async function fetchGroupDetail(groupSlug: string) {
  const payload = await apiRequestWithWorkingGroupPath<unknown>(`/${groupSlug}/`);
  const group = normalizeGroup(payload);

  if (!group) {
    throw new ApiError("Unable to read group details from the API response.", 500, payload);
  }

  return group;
}

export async function joinGroup(
  group:
    | string
    | {
        id?: string | null;
        slug?: string | null;
      },
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const candidateIdentifiers =
    typeof group === "string"
      ? buildUniqueGroupIdentifiers([group])
      : buildUniqueGroupIdentifiers([group.slug, group.id]);

  let lastError: unknown = null;

  for (const identifier of candidateIdentifiers) {
    try {
      return await authenticatedApiRequestWithWorkingGroupPath<unknown>(
        `/${identifier}/join/`,
        {
          method: "POST",
          auth: tokens,
          onAuthRefresh,
        },
      );
    } catch (error) {
      lastError = error;

      if (
        !(error instanceof ApiError) ||
        error.status !== 404 ||
        candidateIdentifiers.length === 1
      ) {
        throw error;
      }
    }
  }

  throw lastError ?? new ApiError("Unable to join this group.", 400);
}

export async function leaveGroup(
  groupSlug: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithWorkingGroupPath<unknown>(`/${groupSlug}/exit/`, {
    method: "POST",
    auth: tokens,
    onAuthRefresh,
  });
}

export async function fetchGroupShareLink(groupSlug: string) {
  const payload = await apiRequestWithWorkingGroupPath<unknown>(`/${groupSlug}/share/`);
  const shareLink =
    readString(payload, ["share_link", "share_url", "url", "link", "shareLink"]) ??
    readString(getNestedRecord(payload, ["data", "result"]), [
      "share_link",
      "share_url",
      "url",
      "link",
      "shareLink",
    ]);

  if (!shareLink) {
    throw new ApiError("The group share endpoint did not return a usable link.", 500, payload);
  }

  return normalizeGroupShareLink(shareLink, groupSlug);
}

export async function fetchGoogleAuthUrl() {
  const callbackUrl = buildGoogleCallbackEntryUrl();
  const basePaths = ["/auth/google/url/", "/api/auth/google/"];
  const paths: string[] = [];
  const callbackParamKeys = [
    "redirect_url",
    "redirect_uri",
    "callback_url",
    "frontend_url",
    "return_url",
  ];

  if (callbackUrl) {
    for (const basePath of basePaths) {
      for (const key of callbackParamKeys) {
        const queryString = buildQueryString({ [key]: callbackUrl });
        paths.push(queryString ? `${basePath}?${queryString}` : basePath);
      }
    }
  }

  paths.push(...basePaths);

  const payload = await apiRequestWithFallbackPaths<unknown>(paths);
  const authUrl =
    readString(payload, ["auth_url", "url", "redirect_url"]) ??
    readString(getNestedRecord(payload, ["data", "result"]), [
      "auth_url",
      "url",
      "redirect_url",
    ]);

  if (!authUrl) {
    throw new ApiError("Google OAuth did not return an authorization URL.", 500, payload);
  }

  return authUrl;
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCreatedLabel(value: string | null): string {
  if (!value) return "Created: Recently";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `Created: ${value}`;
  }

  return `Created: ${parsed.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
}

export function toDashboardGroup(
  group: ApiGroupRecord,
  index: number,
): GroupRecord {
  const preset = getGroupStylePreset(group, index);
  const resolvedAccent = normalizeGroupColor(group.color) ?? preset.accent;
  const membersLabel = `${formatCompactCount(group.memberCount)} members`;
  const unreadCount = group.unreadCount ?? 0;
  const unreadLabel = `${formatCompactCount(unreadCount)} unread message${
    unreadCount === 1 ? "" : "s"
  }`;

  return {
    id: group.id,
    listTitle: group.name,
    headerTitle: group.name,
    membersLabel,
    headerMembersLabel: membersLabel,
    unreadLabel,
    unreadCount,
    accent: resolvedAccent,
    accentSoft:
      normalizeGroupColor(group.color) !== null
        ? hexToRgba(resolvedAccent, 0.12)
        : preset.accentSoft,
    avatarBackground: resolvedAccent,
    joinBackground: resolvedAccent,
    avatarSrc: preset.avatarSrc,
  };
}

export function toCommunityRecord(
  group: ApiGroupRecord,
  index: number,
): CommunityRecord {
  const preset = getGroupStylePreset(group, index);
  const resolvedAccent = normalizeGroupColor(group.color) ?? preset.accent;

  return {
    id: group.id,
    name: group.name,
    icon: group.icon ?? "\u{1F465}",
    memberCount: group.memberCount,
    members: formatCompactCount(group.memberCount),
    posts: formatCompactCount(group.postCount),
    status: group.status ?? "active",
    description: group.description,
    createdLabel: formatCreatedLabel(group.createdAt),
    accent: resolvedAccent,
  };
}

export function extractApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
) {
  if (isSessionInvalidationError(error)) {
    return SESSION_EXPIRED_ERROR_MESSAGE;
  }
  if (error instanceof ApiError) {
    return normalizeApiMessage(error.message, fallback);
  }
  if (isNetworkError(error)) {
    return "We're having trouble connecting to the server. Please check your connection and try again.";
  }
  if (error instanceof Error && error.message.trim()) {
    return normalizeApiMessage(error.message, fallback);
  }
  return fallback;
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.trim().toLowerCase();
    return (
      msg === "failed to fetch" ||
      msg === "load failed" ||
      msg === "network request failed" ||
      msg.includes("networkerror") ||
      msg.includes("network error")
    );
  }
  if (error instanceof Error) {
    const msg = error.message.trim().toLowerCase();
    return (
      msg === "failed to fetch" ||
      msg === "fetch failed" ||
      msg === "load failed" ||
      msg === "network request failed" ||
      msg.includes("networkerror") ||
      msg.includes("network error") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

function normalizeGroupShareLink(shareLink: string, groupSlug: string) {
  try {
    const parsedUrl = new URL(shareLink);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");

    if (
      normalizedPath === `/groups/${groupSlug}` ||
      normalizedPath === "/dashboard" ||
      isApiOrigin(parsedUrl.origin)
    ) {
      return buildGroupShareLink(groupSlug);
    }

    return parsedUrl.toString();
  } catch {
    return buildGroupShareLink(groupSlug);
  }
}

export function buildGroupShareLink(groupSlug: string) {
  const sharePath = `/dashboard?group=${encodeURIComponent(groupSlug)}`;
  const shareBaseUrl = resolvePublicAppBaseUrl();

  if (!shareBaseUrl) {
    return sharePath;
  }

  try {
    return new URL(sharePath, `${shareBaseUrl}/`).toString();
  } catch {
    return sharePath;
  }
}

function buildVerifyEmailEntryUrl() {
  return buildPublicAppUrl("/api/auth/verify-email");
}

function buildGoogleCallbackEntryUrl() {
  return buildPublicAppUrl("/api/auth/google/callback");
}

function buildPublicAppUrl(path: string) {
  const publicAppBaseUrl = resolvePublicAppBaseUrl();
  if (!publicAppBaseUrl) {
    return null;
  }

  try {
    return new URL(path, `${publicAppBaseUrl}/`).toString();
  } catch {
    return null;
  }
}

function resolvePublicAppBaseUrl() {
  const configuredAppUrl = normalizeAbsoluteUrl(APP_BASE_URL);
  const currentOrigin =
    typeof window !== "undefined"
      ? normalizeAbsoluteUrl(window.location.origin)
      : null;

  if (
    currentOrigin &&
    !isApiOrigin(currentOrigin) &&
    (!configuredAppUrl ||
      isApiOrigin(configuredAppUrl) ||
      isLocalOrigin(configuredAppUrl))
  ) {
    return currentOrigin;
  }

  if (configuredAppUrl) {
    return configuredAppUrl;
  }

  return normalizeAbsoluteUrl(API_BASE_URL);
}

function isUnsupportedCallbackFieldError(
  error: unknown,
  fieldName: string,
) {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return false;
  }

  const normalizedFieldName = fieldName.trim().toLowerCase();
  if (!normalizedFieldName) {
    return false;
  }

  const errorText = [
    error.message,
    typeof error.details === "string" ? error.details : JSON.stringify(error.details),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    errorText.includes(normalizedFieldName) &&
    [
      "not allowed",
      "unknown field",
      "unexpected field",
      "unexpected keyword",
      "extra fields",
      "invalid field",
      "not a valid",
    ].some((indicator) => errorText.includes(indicator))
  );
}

function isApiOrigin(candidateOrigin: string) {
  try {
    return new URL(candidateOrigin).origin === new URL(API_BASE_URL).origin;
  } catch {
    return false;
  }
}

function isLocalOrigin(candidateOrigin: string) {
  try {
    const hostname = new URL(candidateOrigin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
