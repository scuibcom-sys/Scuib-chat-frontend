const SHARED_GROUP_SLUG_KEY = "scuib.pending-shared-group.slug";
const SHARED_GROUP_REQUESTED_AT_KEY = "scuib.pending-shared-group.requested-at";
const SHARED_GROUP_COOKIE_PREFIX = "scuib_pending_shared_group";
const SHARED_GROUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHARED_GROUP_TTL_SECONDS = SHARED_GROUP_TTL_MS / 1000;

export function rememberPendingSharedGroup(groupSlug: string) {
  if (typeof window === "undefined") return;

  const normalizedGroupSlug = groupSlug.trim();
  if (!normalizedGroupSlug) return;

  const requestedAt = Date.now();

  window.sessionStorage.setItem(SHARED_GROUP_SLUG_KEY, normalizedGroupSlug);
  window.sessionStorage.setItem(
    SHARED_GROUP_REQUESTED_AT_KEY,
    String(requestedAt),
  );

  document.cookie = buildCookieString(
    `${SHARED_GROUP_COOKIE_PREFIX}_slug`,
    encodeURIComponent(normalizedGroupSlug),
    SHARED_GROUP_TTL_SECONDS,
  );
  document.cookie = buildCookieString(
    `${SHARED_GROUP_COOKIE_PREFIX}_requested_at`,
    String(requestedAt),
    SHARED_GROUP_TTL_SECONDS,
  );
}

export function readPendingSharedGroup() {
  if (typeof window === "undefined") return null;

  const groupSlug = window.sessionStorage.getItem(SHARED_GROUP_SLUG_KEY)?.trim();
  const requestedAt = Number(
    window.sessionStorage.getItem(SHARED_GROUP_REQUESTED_AT_KEY),
  );

  if (!groupSlug || !Number.isFinite(requestedAt)) {
    clearPendingSharedGroup();
    return null;
  }

  if (!isPendingSharedGroupFresh(requestedAt)) {
    clearPendingSharedGroup();
    return null;
  }

  return {
    groupSlug,
    requestedAt,
  };
}

export function clearPendingSharedGroup() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(SHARED_GROUP_SLUG_KEY);
  window.sessionStorage.removeItem(SHARED_GROUP_REQUESTED_AT_KEY);

  document.cookie = buildCookieString(
    `${SHARED_GROUP_COOKIE_PREFIX}_slug`,
    "",
    0,
  );
  document.cookie = buildCookieString(
    `${SHARED_GROUP_COOKIE_PREFIX}_requested_at`,
    "",
    0,
  );
}

export function getPendingSharedGroupCookieNames() {
  return {
    slug: `${SHARED_GROUP_COOKIE_PREFIX}_slug`,
    requestedAt: `${SHARED_GROUP_COOKIE_PREFIX}_requested_at`,
  };
}

export function isPendingSharedGroupFresh(
  requestedAt: number,
  now = Date.now(),
) {
  return Number.isFinite(requestedAt) && now - requestedAt <= SHARED_GROUP_TTL_MS;
}

function buildCookieString(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}
