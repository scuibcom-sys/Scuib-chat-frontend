const PASSWORD_RESET_EMAIL_KEY = "scuib.pending-password-reset.email";
const PASSWORD_RESET_REQUESTED_AT_KEY = "scuib.pending-password-reset.requested-at";
const PASSWORD_RESET_COOKIE_PREFIX = "scuib_pending_password_reset";
const PASSWORD_RESET_TTL_MS = 2 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_SECONDS = PASSWORD_RESET_TTL_MS / 1000;

export function rememberPendingPasswordReset(email: string) {
  if (typeof window === "undefined") return;

  const normalizedEmail = email.trim();
  if (!normalizedEmail) return;

  const requestedAt = Date.now();

  window.sessionStorage.setItem(PASSWORD_RESET_EMAIL_KEY, normalizedEmail);
  window.sessionStorage.setItem(
    PASSWORD_RESET_REQUESTED_AT_KEY,
    String(requestedAt),
  );

  document.cookie = buildCookieString(
    `${PASSWORD_RESET_COOKIE_PREFIX}_email`,
    encodeURIComponent(normalizedEmail),
    PASSWORD_RESET_TTL_SECONDS,
  );
  document.cookie = buildCookieString(
    `${PASSWORD_RESET_COOKIE_PREFIX}_requested_at`,
    String(requestedAt),
    PASSWORD_RESET_TTL_SECONDS,
  );
}

export function readPendingPasswordReset() {
  if (typeof window === "undefined") return null;

  const email = window.sessionStorage
    .getItem(PASSWORD_RESET_EMAIL_KEY)
    ?.trim();
  const requestedAt = Number(
    window.sessionStorage.getItem(PASSWORD_RESET_REQUESTED_AT_KEY),
  );

  if (!email || !Number.isFinite(requestedAt)) {
    clearPendingPasswordReset();
    return null;
  }

  if (Date.now() - requestedAt > PASSWORD_RESET_TTL_MS) {
    clearPendingPasswordReset();
    return null;
  }

  return {
    email,
    requestedAt,
  };
}

export function clearPendingPasswordReset() {
  if (typeof window === "undefined") return;

  window.sessionStorage.removeItem(PASSWORD_RESET_EMAIL_KEY);
  window.sessionStorage.removeItem(PASSWORD_RESET_REQUESTED_AT_KEY);

  document.cookie = buildCookieString(
    `${PASSWORD_RESET_COOKIE_PREFIX}_email`,
    "",
    0,
  );
  document.cookie = buildCookieString(
    `${PASSWORD_RESET_COOKIE_PREFIX}_requested_at`,
    "",
    0,
  );
}

export function getPendingPasswordResetCookieNames() {
  return {
    email: `${PASSWORD_RESET_COOKIE_PREFIX}_email`,
    requestedAt: `${PASSWORD_RESET_COOKIE_PREFIX}_requested_at`,
  };
}

export function isPendingPasswordResetFresh(
  requestedAt: number,
  now = Date.now(),
) {
  return Number.isFinite(requestedAt) && now - requestedAt <= PASSWORD_RESET_TTL_MS;
}

function buildCookieString(name: string, value: string, maxAgeSeconds: number) {
  return `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}
