import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auths/AuthCard";
import { SignInForm } from "@/components/auths/forms/SignInForm";

export const metadata = {
  title: "Sign In - Scuib Chat",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    notice?: string | string[] | undefined;
    group?: string | string[] | undefined;
    key?: string | string[] | undefined;
    verified?: string | string[] | undefined;
    email_verified?: string | string[] | undefined;
    account_verified?: string | string[] | undefined;
    verification?: string | string[] | undefined;
    status?: string | string[] | undefined;
  }>;
}) {
  const params = await searchParams;
  const rawNotice = Array.isArray(params.notice)
    ? params.notice[0]
    : params.notice;
  const rawGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const rawKey = Array.isArray(params.key) ? params.key[0] : params.key;
  const sharedGroupSlug = rawGroup?.trim() || null;
  const verificationSuccessSignals = [
    params.verified,
    params.email_verified,
    params.account_verified,
    params.verification,
    params.status,
  ]
    .map((value) => (Array.isArray(value) ? value[0] : value))
    .map((value) => value?.trim().toLowerCase() ?? "");

  if (rawKey?.trim()) {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("key", rawKey.trim());

    if (sharedGroupSlug) {
      nextSearchParams.set("group", sharedGroupSlug);
    }

    redirect(`/verify-email?${nextSearchParams.toString()}`);
  }

  if (
    verificationSuccessSignals.some((value) =>
      ["1", "true", "success", "verified", "confirmed", "complete"].includes(value),
    )
  ) {
    redirect(
      sharedGroupSlug
        ? `/verify-email-success?group=${encodeURIComponent(sharedGroupSlug)}`
        : "/verify-email-success",
    );
  }

  return (
    <AuthCard title="Sign In To Scuib Chat">
      <SignInForm
        notice={
          rawNotice === "verify-email"
            ? "verify-email"
            : rawNotice === "session-expired"
              ? "session-expired"
              : null
        }
        sharedGroupSlug={sharedGroupSlug}
      />
    </AuthCard>
  );
}
