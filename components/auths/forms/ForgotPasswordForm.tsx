"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useForm } from "@/hooks/useForm";
import { useAuthStore } from "@/store/authStore";
import { rememberPendingPasswordReset } from "@/utils/passwordResetFlow";
import { LockIcon } from "@/utils/icons";

interface ForgotValues {
  email: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordForm() {
  const { forgotPassword, isLoading, error, clearError } = useAuthStore();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const validate = (values: ForgotValues) => {
    const errors: Record<string, string> = {};
    const normalizedEmail = values.email.trim();

    if (!normalizedEmail) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.email = "Invalid email address";
    }

    return errors;
  };

  const { values, errors, handleChange, handleSubmit } = useForm<ForgotValues>({
    initialValues: { email: "" },
    validate,
    onSubmit: async (formValues) => {
      const normalizedEmail = formValues.email.trim();

      clearError();
      await forgotPassword(normalizedEmail);
      rememberPendingPasswordReset(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setShowSuccessModal(true);
    },
  });

  const maskEmail = (email: string) => {
    const [local, domain] = email.split("@");
    if (!domain) return email;

    const [domainName, tld] = domain.split(".");
    const visibleLocalChars = Math.min(2, local.length);
    const maskedLocal =
      local.slice(0, visibleLocalChars) +
      "*".repeat(Math.max(0, local.length - visibleLocalChars));
    const maskedDomain = "*".repeat(Math.max(1, domainName?.length || 0));

    return `${maskedLocal}@${maskedDomain}.${tld || "com"}`;
  };

  return (
    <>
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            type="email"
            placeholder="Enter your email..."
            icon={<img src="/lock.svg" alt="" />}
            value={values.email}
            onChange={(event) => handleChange("email", event.target.value)}
            error={errors.email}
            py="py-14"
            iconPl="pl-32"
          />

          {error ? (
            <div className="rounded-lg border border-[#e67e22] bg-[#fef3e2] p-3 text-sm text-[#e67e22]">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            rightIcon={<LockIcon className="text-white" />}
          >
            Send Password
          </Button>

          <Link
            href="/signin"
            className="block w-full text-center text-sm text-[#8b7355] transition-colors hover:text-[#5d4037]"
          >
            Back to Sign In
          </Link>
        </form>
      </div>

      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      >
        <div className="relative p-8 text-center">
          <button
            type="button"
            onClick={() => setShowSuccessModal(false)}
            className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-[#E7DED8] bg-white text-[#6A4227] shadow-[0_10px_24px_rgba(77,52,34,0.12)] transition-colors hover:bg-[#F7F4F2]"
            aria-label="Close reset password dialog"
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>

          <div className="relative h-62 w-full">
            <Image
              src="/frame.png"
              alt="Reset password email illustration"
              fill
              className="object-cover"
            />
          </div>

          <h3 className="mt-6 mb-3 text-left text-2xl font-extrabold leading-[100%] tracking-[-0.8%] text-[#4F3422]">
            We&apos;ve Sent Reset Instructions to {maskEmail(submittedEmail)}
          </h3>

          <p className="mb-6 text-left text-lg leading-[160%] tracking-[-0.4%] text-[#736B66]">
            Didn&apos;t receive the link? Re-send the password reset email below.
          </p>

          <Button
            onClick={() => handleSubmit()}
            className="w-full"
            isLoading={isLoading}
            size="md"
          >
            Re-Send Password
          </Button>
        </div>
      </Modal>
    </>
  );
}
