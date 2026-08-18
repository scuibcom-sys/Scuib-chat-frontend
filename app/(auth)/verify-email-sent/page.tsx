import Link from "next/link";
import { AuthCard } from "@/components/auths/AuthCard";

export const metadata = {
  title: "Verify Your Email - Scuib Chat",
};

export default async function VerifyEmailSentPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string | string[] | undefined;
    group?: string | string[] | undefined;
  }>;
}) {
  const params = await searchParams;
  const rawEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const rawGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const email = rawEmail?.trim() || null;
  const sharedGroupSlug = rawGroup?.trim() || null;
  const signInHref = `/signin?notice=verify-email${
    sharedGroupSlug ? `&group=${encodeURIComponent(sharedGroupSlug)}` : ""
  }`;

  return (
    <AuthCard
      title="Check Your Email"
      subtitle={
        email
          ? `We sent a verification link to ${email}. Open it to verify your email before signing in.`
          : "We sent you a verification link. Open it to verify your email before signing in."
      }
    >
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-[#736B66]">
          After verification, come back here and sign in to continue.
        </p>
        <Link
          href={signInHref}
          className="inline-flex rounded-full bg-[#4F3422] px-6 py-4 text-lg font-extrabold leading-[100%] tracking-[-0.4%] text-white transition-colors hover:bg-[#4a3728]"
        >
          Back to Sign In
        </Link>
      </div>
    </AuthCard>
  );
}
