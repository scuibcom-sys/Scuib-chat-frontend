import { AuthCard } from "@/components/auths/AuthCard";
import { ForgotPasswordForm } from "@/components/auths/forms/ForgotPasswordForm";

export const metadata = {
  title: "Forgot Password - Scuib Chat",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot Password"
      subtitle="Enter email details where you want to reset your password."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
