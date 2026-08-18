const JOINED_GROUPS_STORAGE_PREFIX = "scuib.joined-groups";

type PersistedJoinedGroupsRecord = {
  groupIds: string[];
  groupSlugs: string[];
  updatedAt: number;
};

function normalizeUserStorageKey(userKey: string) {
  return `${JOINED_GROUPS_STORAGE_PREFIX}:${userKey.trim().toLowerCase()}`;
}

function normalizeValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter(Boolean),
    ),
  );
}

export function readPersistedJoinedGroups(userKey: string | null | undefined) {
  if (typeof window === "undefined" || !userKey?.trim()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(
      normalizeUserStorageKey(userKey),
    );
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedJoinedGroupsRecord>;
    return {
      groupIds: normalizeValues(parsedValue.groupIds ?? []),
      groupSlugs: normalizeValues(parsedValue.groupSlugs ?? []),
      updatedAt:
        typeof parsedValue.updatedAt === "number" &&
        Number.isFinite(parsedValue.updatedAt)
          ? parsedValue.updatedAt
          : Date.now(),
    } satisfies PersistedJoinedGroupsRecord;
  } catch {
    return null;
  }
}

export function persistJoinedGroup(
  userKey: string | null | undefined,
  group: {
    id?: string | null;
    slug?: string | null;
  },
) {
  if (typeof window === "undefined" || !userKey?.trim()) {
    return;
  }

  const currentValue = readPersistedJoinedGroups(userKey);
  const nextValue = {
    groupIds: normalizeValues([...(currentValue?.groupIds ?? []), group.id]),
    groupSlugs: normalizeValues([...(currentValue?.groupSlugs ?? []), group.slug]),
    updatedAt: Date.now(),
  } satisfies PersistedJoinedGroupsRecord;

  window.localStorage.setItem(
    normalizeUserStorageKey(userKey),
    JSON.stringify(nextValue),
  );
}

export function replacePersistedJoinedGroups(
  userKey: string | null | undefined,
  groups: Array<{
    id?: string | null;
    slug?: string | null;
  }>,
) {
  if (typeof window === "undefined" || !userKey?.trim()) {
    return;
  }

  const nextValue = {
    groupIds: normalizeValues(groups.map((group) => group.id)),
    groupSlugs: normalizeValues(groups.map((group) => group.slug)),
    updatedAt: Date.now(),
  } satisfies PersistedJoinedGroupsRecord;

  window.localStorage.setItem(
    normalizeUserStorageKey(userKey),
    JSON.stringify(nextValue),
  );
}
