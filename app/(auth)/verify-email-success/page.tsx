import { ArrowRight } from "lucide-react";
import { VerificationStatusPanel } from "@/components/auths/VerificationStatusPanel";

export const metadata = {
  title: "Email Verified - Scuib Chat",
};

export default async function VerifyEmailSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    group?: string | string[] | undefined;
  }>;
}) {
  const params = await searchParams;
  const rawGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const sharedGroupSlug = rawGroup?.trim() || null;
  const signInHref = sharedGroupSlug
    ? `/signin?group=${encodeURIComponent(sharedGroupSlug)}`
    : "/signin";

  return (
    <VerificationStatusPanel
      badge="Verification complete"
      title="Your email is verified."
      description="Your email has been verified successfully. You can sign in now."
      tone="success"
      primaryAction={{
        href: signInHref,
        label: "Log In",
        icon: <ArrowRight className="h-4 w-4" />,
      }}
      secondaryAction={{
        href: "/",
        label: "Back to Welcome",
      }}
      footer="Your account is confirmed and ready for sign in."
    />
  );
}
