"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useForm } from "@/hooks/useForm";
import {
  clearPendingPasswordReset,
  readPendingPasswordReset,
} from "@/utils/passwordResetFlow";
import {
  extractApiErrorMessage,
  readString,
  resetPasswordWithToken,
} from "@/utils/scuibApi";
import { ArrowRightIcon, LockIcon } from "@/utils/icons";

interface ResetPasswordValues {
  email: string;
  password: string;
  confirmPassword: string;
}

interface ResetPasswordFormProps {
  initialEmail?: string;
  verificationParams?: Record<string, string>;
}

export function ResetPasswordForm({
  initialEmail = "",
  verificationParams = {},
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [resetError, setResetError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resolvedVerificationParams = Object.fromEntries(
    Object.entries(verificationParams).filter(([, value]) => value.trim()),
  );

  const validate = (values: ResetPasswordValues) => {
    const errors: Record<string, string> = {};

    if (!values.password) {
      errors.password = "Password is required";
    } else if (values.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }
    if (!values.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (values.password !== values.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    return errors;
  };

  const { values, errors, handleChange, handleSubmit, setValues, isSubmitting } =
    useForm<ResetPasswordValues>({
      initialValues: {
        email: initialEmail,
        password: "",
        confirmPassword: "",
      },
      validate,
      onSubmit: async (formValues) => {
        setResetError(null);
        setSuccessMessage(null);

        if (!hasVerificationContext) {
          setResetError(
            "Open this page from the password reset link in your email before choosing a new password.",
          );
          return;
        }

        const normalizedEmail = formValues.email.trim();
        const payload = {
          ...resolvedVerificationParams,
          password: formValues.password,
          confirm_password: formValues.confirmPassword,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
        };

        try {
          const response = await resetPasswordWithToken({
            body: payload,
            queryParams: resolvedVerificationParams,
          });
          const detailMessage = readString(response, [
            "message",
            "detail",
            "success",
            "status",
          ]);

          if (isPasswordResetEmailResponse(detailMessage)) {
            throw new Error(
              "The backend verified the link, but the password update was not completed. Please confirm the final reset payload with the backend team.",
            );
          }

          clearPendingPasswordReset();
          setSuccessMessage(
            detailMessage ??
              "Password updated successfully. You can sign in with your new password now.",
          );
          router.push("/signin");
        } catch (error) {
          setResetError(
            extractApiErrorMessage(
              error,
              "Unable to reset your password right now.",
            ),
          );
        }
      },
    });

  useEffect(() => {
    if (initialEmail) {
      setValues((previousValues) =>
        previousValues.email === initialEmail
          ? previousValues
          : {
              ...previousValues,
              email: initialEmail,
            },
      );
      return;
    }

    const pendingReset = readPendingPasswordReset();
    if (!pendingReset?.email) return;

    setValues((previousValues) =>
      previousValues.email === pendingReset.email
        ? previousValues
        : {
            ...previousValues,
            email: pendingReset.email,
          },
    );
  }, [initialEmail, setValues]);

  const hasVerificationContext = Object.keys(resolvedVerificationParams).length > 0;
  const hasResolvedEmail = Boolean(values.email.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {hasResolvedEmail ? (
        <div className="rounded-lg border border-[#E7DED8] bg-white/70 p-4 text-sm text-[#736B66]">
          Resetting password for <span className="font-bold text-[#4F3422]">{values.email}</span>
        </div>
      ) : null}

      <Input
        label="New Password"
        type="password"
        placeholder="Enter your new password"
        icon={<LockIcon className="text-[#4F3422]" />}
        value={values.password}
        onChange={(event) => handleChange("password", event.target.value)}
        error={errors.password}
      />

      <Input
        label="Confirm Password"
        type="password"
        placeholder="Confirm your new password"
        icon={<LockIcon className="text-[#4F3422]" />}
        value={values.confirmPassword}
        onChange={(event) => handleChange("confirmPassword", event.target.value)}
        error={errors.confirmPassword}
      />

      {!hasVerificationContext ? (
        <div className="rounded-lg border border-[#e67e22] bg-[#fef3e2] p-3 text-sm text-[#e67e22]">
          Open this page from the password reset link in your email so we can complete the reset securely.
        </div>
      ) : null}

      {resetError ? (
        <div className="rounded-lg border border-[#e67e22] bg-[#fef3e2] p-3 text-sm text-[#e67e22]">
          {resetError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-[#9BB168] bg-[#edf7e6] p-3 text-sm text-[#4F6A2B]">
          {successMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        isLoading={isSubmitting}
        rightIcon={<ArrowRightIcon className="text-white" />}
        size="md"
      >
        Reset Password
      </Button>

      <div className="text-center">
        <Link
          href="/signin"
          className="text-sm font-bold text-[#ED7E1C] hover:underline"
        >
          Back to Sign In
        </Link>
      </div>
    </form>
  );
}

function isPasswordResetEmailResponse(message: string | null | undefined) {
  const normalizedMessage = message?.trim().toLowerCase();

  return normalizedMessage === "password reset email sent";
}
