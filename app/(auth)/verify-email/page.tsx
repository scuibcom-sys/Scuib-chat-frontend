import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, RefreshCcw } from "lucide-react";
import { VerificationStatusPanel } from "@/components/auths/VerificationStatusPanel";
import {
  extractApiErrorMessage,
  readString,
  verifyEmailWithApi,
} from "@/utils/scuibApi";
import {
  getPendingPasswordResetCookieNames,
  isPendingPasswordResetFresh,
} from "@/utils/passwordResetFlow";
import {
  getPendingSharedGroupCookieNames,
  isPendingSharedGroupFresh,
} from "@/utils/sharedGroupFlow";

export const metadata = {
  title: "Verify Email - Scuib Chat",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const normalizedParams = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value[0] ? [[key, value[0]]] : [];
      }

      return value ? [[key, value]] : [];
    }),
  );
  const hasQueryParams = Object.keys(normalizedParams).length > 0;

  if (!hasQueryParams) {
    return (
      <VerificationStatusPanel
        badge="Link unavailable"
        title="This verification link is incomplete."
        description="Please use the latest verification email we sent to you."
        tone="warning"
        primaryAction={{
          href: "/signin",
          label: "Back to Sign In",
          icon: <ArrowRight className="h-4 w-4" />,
        }}
      />
    );
  }

  const cookieStore = await cookies();
  const passwordResetCookieNames = getPendingPasswordResetCookieNames();
  const sharedGroupCookieNames = getPendingSharedGroupCookieNames();
  const cookieEmail = cookieStore.get(passwordResetCookieNames.email)?.value;
  const cookieRequestedAt = Number(
    cookieStore.get(passwordResetCookieNames.requestedAt)?.value,
  );
  const sharedGroupSlug = decodeURIComponent(
    cookieStore.get(sharedGroupCookieNames.slug)?.value ?? "",
  ).trim();
  const sharedGroupRequestedAt = Number(
    cookieStore.get(sharedGroupCookieNames.requestedAt)?.value,
  );
  const isPasswordResetFlow =
    Boolean(cookieEmail) && isPendingPasswordResetFresh(cookieRequestedAt);
  const signInHref = `/signin${
    sharedGroupSlug && isPendingSharedGroupFresh(sharedGroupRequestedAt)
      ? `?group=${encodeURIComponent(sharedGroupSlug)}`
      : ""
  }`;

  let successMessage =
    "Your email has been verified successfully. You can sign in now.";
  let failureMessage: string | null = null;

  try {
    const payload = await verifyEmailWithApi(normalizedParams);
    successMessage =
      sanitizeMessage(
        readString(payload, ["message", "detail", "success", "status"]),
      ) ?? successMessage;
  } catch (error) {
    failureMessage =
      sanitizeMessage(
        extractApiErrorMessage(
          error,
          "We could not verify your email with this link. It may have expired or already been used.",
        ),
      ) ??
      "We could not verify your email with this link. It may have expired or already been used.";
  }

  if (!failureMessage && isPasswordResetFlow) {
    const nextSearchParams = new URLSearchParams(normalizedParams);
    redirect(`/reset-password?${nextSearchParams.toString()}`);
  }

  if (failureMessage) {
    return (
      <VerificationStatusPanel
        badge="Verification failed"
        title="We couldn't verify this email."
        description={failureMessage}
        tone="warning"
        primaryAction={{
          href: signInHref,
          label: "Back to Sign In",
          icon: <ArrowRight className="h-4 w-4" />,
        }}
        secondaryAction={{
          href: "/verify-email-sent",
          label: "Check Instructions",
          icon: <RefreshCcw className="h-4 w-4" />,
        }}
        footer="If this keeps happening, request a fresh verification email and try the newest link."
      />
    );
  }

  return (
    <VerificationStatusPanel
      badge="Verification complete"
      title="Your email is verified."
      description={successMessage}
      tone="success"
      primaryAction={{
        href: signInHref,
        label: "Sign In Now",
        icon: <ArrowRight className="h-4 w-4" />,
      }}
      secondaryAction={{
        href: "/",
        label: "Back to Welcome",
      }}
      footer="You can sign in now and continue into the Scuib Chat community."
    />
  );
}

function sanitizeMessage(message: string | null) {
  if (!message) return null;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) return null;

  if (
    trimmedMessage.startsWith("<!doctype html") ||
    trimmedMessage.startsWith("<html")
  ) {
    return null;
  }

  return trimmedMessage;
}
