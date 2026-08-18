import {
  ApiError,
  apiRequest,
  buildDisplayName,
  extractArrayPayload,
  getNestedRecord,
  isRecord,
  readBoolean,
  readMediaUrl,
  readNumber,
  readString,
  refreshAccessToken,
  type AuthTokens,
} from "@/utils/scuibApi";

type ApiRequestInit = Omit<RequestInit, "body" | "headers"> & {
  auth?: Partial<AuthTokens> | null;
  body?: unknown;
  headers?: HeadersInit;
};

type AuthenticatedRequestInit = ApiRequestInit & {
  auth: Partial<AuthTokens>;
  onAuthRefresh?: (tokens: AuthTokens) => void;
};

export type GroupMutationInput = {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

export type ApiGroupMemberRecord = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  role: string | null;
  bio: string | null;
  joinedAt: string | null;
};

export type GroupMutationResult = {
  id: string | null;
  name: string | null;
  payload: unknown;
};

function isRefreshableAuthError(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 401) return true;
  if (error.status !== 403) return false;

  const normalizedMessage = error.message.trim().toLowerCase();
  return (
    normalizedMessage.includes("token not valid") ||
    normalizedMessage.includes("given token not valid") ||
    normalizedMessage.includes("invalid token") ||
    normalizedMessage.includes("token is invalid")
  );
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

async function authenticatedApiRequestWithFallbackPaths<T>(
  paths: string[],
  init: AuthenticatedRequestInit,
  fallbackStatusCodes: number[] = [404],
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    try {
      return await authenticatedApiRequest<T>(path, init);
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

function buildGroupPayloads(input: GroupMutationInput) {
  const basePayload = {
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.icon ? { icon: input.icon } : {}),
    ...(input.color ? { color: input.color } : {}),
  };

  return [
    basePayload,
    {
      name: input.name,
      ...(input.color ? { color: input.color } : {}),
    },
    {
      title: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      title: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      title: input.name,
      ...(input.color ? { color: input.color } : {}),
    },
    {
      group_name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      group_name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      group_name: input.name,
      ...(input.color ? { color: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { bio: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { about: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon ? { icon: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon ? { emoji: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon ? { symbol: input.icon } : {}),
      ...(input.color ? { color: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color ? { accent: input.color } : {}),
    },
    {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color ? { hex: input.color } : {}),
    },
  ];
}

function normalizeGroupMember(rawMember: unknown): ApiGroupMemberRecord | null {
  if (!isRecord(rawMember)) return null;

  const containerRecord =
    getNestedRecord(rawMember, ["user", "member", "profile", "account", "owner"]) ??
    rawMember;
  const userRecord =
    getNestedRecord(containerRecord, [
      "profile",
      "user",
      "account",
      "owner",
      "member",
      "participant",
    ]) ?? containerRecord;
  const id =
    readString(userRecord, ["id", "pk", "uuid", "user_id"]) ??
    readString(rawMember, ["id", "pk", "uuid", "user_id"]);
  const name =
    buildDisplayName(userRecord) ??
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
    ]);

  if (!id || !name) return null;

  return {
    id,
    name,
    email:
      readString(userRecord, ["email", "user_email", "member_email"]) ??
      readString(rawMember, ["email", "member_email", "user_email"]) ??
      null,
    avatarUrl:
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
    role:
      readString(rawMember, ["role", "membership_role", "member_role"]) ??
      readString(userRecord, ["role", "type"]) ??
      null,
    bio:
      readString(userRecord, ["bio", "about", "description"]) ??
      readString(rawMember, ["bio", "about", "description"]) ??
      null,
    joinedAt:
      readString(rawMember, ["joined_at", "joinedAt", "created_at"]) ?? null,
  };
}

function normalizeGroupMutationResult(payload: unknown): GroupMutationResult {
  const nestedPayloads = [
    payload,
    getNestedRecord(payload, ["data", "result", "group", "community"]),
  ].filter(Boolean);

  for (const candidate of nestedPayloads) {
    const id = readString(candidate, ["id", "pk", "uuid", "group_id", "groupId"]);
    const name = readString(candidate, ["name", "title", "group_name", "groupName"]);

    if (id || name) {
      return {
        id,
        name,
        payload,
      };
    }
  }

  return {
    id: null,
    name: null,
    payload,
  };
}

export async function createGroup(
  tokens: Partial<AuthTokens>,
  input: GroupMutationInput,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
    ["/api/admin/groups/", "/admin/groups/", "/admin/groups/create/"],
    ["POST"],
    buildGroupPayloads(input),
    {
      auth: tokens,
      onAuthRefresh,
    },
    [400, 403, 404, 405, 422],
  );

  return normalizeGroupMutationResult(payload);
}

export async function editGroup(
  groupId: string,
  tokens: Partial<AuthTokens>,
  input: Partial<GroupMutationInput>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const trimmedInput = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  };

  return authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
    [
      `/api/admin/groups/${groupId}/`,
      `/api/admin/groups/${groupId}/edit/`,
      `/api/admin/groups/${groupId}/update/`,
      `/admin/groups/${groupId}/edit/`,
      `/admin/groups/${groupId}/update/`,
    ],
    ["PATCH", "PUT", "POST"],
    [
      trimmedInput,
      ...buildGroupPayloads({
        name: input.name ?? "",
        description: input.description,
        icon: input.icon,
        color: input.color,
      }).filter((payload) => {
        if (!isRecord(payload)) return false;
        return Object.keys(payload).length > 0;
      }),
    ],
    {
      auth: tokens,
      onAuthRefresh,
    },
    [400, 403, 404, 405, 422],
  );
}

export async function fetchGroupMembers(
  groupId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    [
      `/api/admin/groups/${groupId}/members/`,
      `/admin/groups/${groupId}/members/`,
    ],
    {
      auth: tokens,
      onAuthRefresh,
    },
    [403, 404],
  );

  return extractArrayPayload(payload, ["members", "results", "items", "data", "users"])
    .map((member) => normalizeGroupMember(member))
    .filter((member): member is ApiGroupMemberRecord => Boolean(member));
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithFallbackPaths<unknown>(
    [
      `/api/admin/groups/${groupId}/members/${userId}/`,
      `/admin/groups/${groupId}/members/${userId}/`,
      `/admin/groups/${groupId}/remove/${userId}/`,
    ],
    {
      method: "DELETE",
      auth: tokens,
      onAuthRefresh,
    },
  );
}

async function authenticatedApiRequestWithMethodAndBodyFallback<T>(
  paths: string[],
  methods: Array<"POST" | "PATCH" | "PUT" | "DELETE">,
  bodies: Array<unknown | undefined>,
  init: Omit<AuthenticatedRequestInit, "body" | "method">,
  fallbackStatusCodes: number[] = [400, 404, 405, 422],
): Promise<T> {
  const uniquePaths = Array.from(new Set(paths));
  let lastError: unknown = null;

  for (const path of uniquePaths) {
    for (const method of methods) {
      for (const body of bodies) {
        try {
          return await authenticatedApiRequest<T>(path, {
            ...init,
            method,
            body,
          });
        } catch (error) {
          lastError = error;

          if (
            error instanceof ApiError &&
            fallbackStatusCodes.includes(error.status)
          ) {
            continue;
          }

          throw error;
        }
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", 500);
}

export async function updateGroupStatus(
  groupId: string,
  status: "active" | "paused",
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const isPausing = status === "paused";

  return authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
    [
      isPausing
        ? `/api/admin/groups/${groupId}/pause/`
        : `/api/admin/groups/${groupId}/resume/`,
      isPausing
        ? `/admin/groups/${groupId}/pause/`
        : `/admin/groups/${groupId}/resume/`,
      isPausing
        ? `/admin/groups/${groupId}/status/`
        : `/admin/groups/${groupId}/status/`,
      isPausing
        ? `/admin/groups/${groupId}/activate/`
        : `/admin/groups/${groupId}/activate/`,
    ],
    ["POST", "PATCH"],
    [
      undefined,
      { status },
      { state: status },
      { is_paused: isPausing },
      { paused: isPausing },
      { is_active: !isPausing },
      { active: !isPausing },
    ],
    {
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function deleteGroup(
  groupId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  return authenticatedApiRequestWithMethodAndBodyFallback<unknown>(
    [
      `/api/admin/groups/${groupId}/delete/`,
      `/admin/groups/${groupId}/delete/`,
      `/admin/groups/${groupId}/`,
    ],
    ["DELETE", "POST"],
    [undefined, { id: groupId }],
    {
      auth: tokens,
      onAuthRefresh,
    },
  );
}

export async function fetchGroupMemberCount(
  groupId: string,
  tokens: Partial<AuthTokens>,
  onAuthRefresh?: (tokens: AuthTokens) => void,
) {
  const payload = await authenticatedApiRequestWithFallbackPaths<unknown>(
    [
      `/api/admin/groups/${groupId}/member-count/`,
      `/admin/groups/${groupId}/member-count/`,
      `/groups/${groupId}/count/`,
    ],
    {
      auth: tokens,
      onAuthRefresh,
    },
    [403, 404],
  );

  const nestedData = getNestedRecord(payload, ["data", "result"]);
  const approvedOnly = readBoolean(payload, ["approved_only", "approvedOnly"]);
  const approvedOnlyNested =
    readBoolean(nestedData, ["approved_only", "approvedOnly"]) ?? null;

  return (
    readNumber(payload, ["count", "member_count", "members", "total_members"]) ??
    readNumber(nestedData, ["count", "member_count", "members", "total_members"]) ??
    (approvedOnly || approvedOnlyNested
      ? readNumber(payload, ["approved_members_count"]) ??
        readNumber(nestedData, ["approved_members_count"])
      : null) ??
    0
  );
}
