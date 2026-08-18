// Bump BUILD_TAG whenever you cut a deploy you want to confirm went live.
// After deploying, open the hosted site, open the browser console, and look for
// the signature below. You can also type `window.__SCUIB_BUILD__` in the console
// to read it back. If you see this tag, the push made it through.
export const BUILD_TAG = "msg-refresh-2026.06.02";

export const BUILD_SIGNATURE = {
  app: "Scuib Chat",
  tag: BUILD_TAG,
  shipped: [
    "attach button re-enabled",
    "inline image / video / file rendering",
    "onboarding save no longer fails silently",
    "modern chat UI + read receipts + dark mode",
  ],
} as const;
