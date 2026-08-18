import { cookies } from "next/headers";
import { AuthCard } from "@/components/auths/AuthCard";
import { ResetPasswordForm } from "@/components/auths/forms/ResetPasswordForm";
import {
  getPendingPasswordResetCookieNames,
  isPendingPasswordResetFresh,
} from "@/utils/passwordResetFlow";

export const metadata = {
  title: "Reset Password - Scuib Chat",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const cookieNames = getPendingPasswordResetCookieNames();
  const cookieEmail = cookieStore.get(cookieNames.email)?.value;
  const cookieRequestedAt = Number(
    cookieStore.get(cookieNames.requestedAt)?.value,
  );

  const verificationParams = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value[0] ? [[key, value[0]]] : [];
      }

      return value ? [[key, value]] : [];
    }),
  );

  const initialEmail =
    isPendingPasswordResetFresh(cookieRequestedAt) && cookieEmail
      ? decodeURIComponent(cookieEmail)
      : "";

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Choose a new password for your account."
    >
      <ResetPasswordForm
        initialEmail={initialEmail}
        verificationParams={verificationParams}
      />
    </AuthCard>
  );
}
