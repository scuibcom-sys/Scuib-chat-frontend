"use client";

import { useEffect } from "react";
import { BUILD_SIGNATURE, BUILD_TAG } from "@/utils/buildSignature";

// Logs a one-time signature to the browser console so it's obvious, after a
// deploy, that the latest build is the one actually running. Renders nothing.
export function BuildSignature() {
  useEffect(() => {
    (window as unknown as { __SCUIB_BUILD__?: typeof BUILD_SIGNATURE }).__SCUIB_BUILD__ =
      BUILD_SIGNATURE;

    console.info(
      `%c Scuib Chat %c ${BUILD_TAG} `,
      "background:#2b6bed;color:#fff;border-radius:4px 0 0 4px;padding:2px 6px;font-weight:700;",
      "background:#10243f;color:#cfe2ff;border-radius:0 4px 4px 0;padding:2px 6px;",
    );
    console.info("This build includes:", BUILD_SIGNATURE.shipped.join(" • "));
  }, []);

  return null;
}
