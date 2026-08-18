const ACTIVE_GROUP_STORAGE_PREFIX = "scuib.active-group";

type PersistedActiveGroupRecord = {
  groupId: string | null;
  groupSlug: string | null;
  updatedAt: number;
};

function normalizeUserStorageKey(userKey: string) {
  return `${ACTIVE_GROUP_STORAGE_PREFIX}:${userKey.trim().toLowerCase()}`;
}

function normalizeValue(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  return normalizedValue || null;
}

export function readPersistedActiveGroup(userKey: string | null | undefined) {
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

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedActiveGroupRecord>;
    return {
      groupId: normalizeValue(parsedValue.groupId),
      groupSlug: normalizeValue(parsedValue.groupSlug),
      updatedAt:
        typeof parsedValue.updatedAt === "number" &&
        Number.isFinite(parsedValue.updatedAt)
          ? parsedValue.updatedAt
          : Date.now(),
    } satisfies PersistedActiveGroupRecord;
  } catch {
    return null;
  }
}

export function persistActiveGroup(
  userKey: string | null | undefined,
  group: {
    id?: string | null;
    slug?: string | null;
  },
) {
  if (typeof window === "undefined" || !userKey?.trim()) {
    return;
  }

  const nextValue = {
    groupId: normalizeValue(group.id),
    groupSlug: normalizeValue(group.slug),
    updatedAt: Date.now(),
  } satisfies PersistedActiveGroupRecord;

  window.localStorage.setItem(
    normalizeUserStorageKey(userKey),
    JSON.stringify(nextValue),
  );
}
