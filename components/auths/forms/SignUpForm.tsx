"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialButton } from "@/components/ui/SocialButton";
import { useForm } from "@/hooks/useForm";
import { useAuthStore } from "@/store/authStore";
import { ArrowRightIcon, LockIcon, MailIcon } from "@/utils/icons";
import { useRouter } from "next/navigation";
import { extractApiErrorMessage, fetchGoogleAuthUrl } from "@/utils/scuibApi";

interface SignUpValues {
  email: string;
  password: string;
  confirmPassword: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignUpForm({
  sharedGroupSlug = null,
}: {
  sharedGroupSlug?: string | null;
}) {
  const router = useRouter();
  const { signup, isLoading, error, clearError } = useAuthStore();
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const validate = (values: SignUpValues) => {
    const errors: Record<string, string> = {};
    const normalizedEmail = values.email.trim();

    if (!normalizedEmail) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.email = "Invalid email address";
    }
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

  const { values, errors, handleChange, handleSubmit } = useForm<SignUpValues>({
    initialValues: { email: "", password: "", confirmPassword: "" },
    validate,
    onSubmit: async (values) => {
      const normalizedEmail = values.email.trim();

      clearError();
      try {
        await signup(normalizedEmail, values.password, values.confirmPassword);
      } catch {
        return;
      }
      router.push(
        `/verify-email-sent?email=${encodeURIComponent(normalizedEmail)}${
          sharedGroupSlug ? `&group=${encodeURIComponent(sharedGroupSlug)}` : ""
        }`,
      );
    },
  });

  const handleGoogleSignup = async () => {
    setGoogleError(null);
    setIsGoogleLoading(true);

    try {
      const authUrl = await fetchGoogleAuthUrl();
      window.location.assign(authUrl);
    } catch (error) {
      setGoogleError(
        extractApiErrorMessage(error, "Unable to start Google sign up right now."),
      );
      setIsGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Email Address"
        type="email"
        placeholder="Enter your email..."
        icon={<MailIcon className="text-[#4F3422]" />}
        value={values.email}
        onChange={(e) => handleChange("email", e.target.value)}
        error={errors.email}
      />

      <Input
        label="Password"
        type="password"
        placeholder="Enter your password..."
        icon={<LockIcon className="text-[#4F3422]" />}
        value={values.password}
        onChange={(e) => handleChange("password", e.target.value)}
        error={errors.password}
      />

      <Input
        label="Password Confirmation"
        type="password"
        placeholder="Confirm your password..."
        icon={<LockIcon className="text-[#4F3422]" />}
        value={values.confirmPassword}
        onChange={(e) => handleChange("confirmPassword", e.target.value)}
        error={errors.confirmPassword}
      />

      {error && (
        <div className="p-3 rounded-lg bg-[#fef3e2] border border-[#e67e22] text-[#e67e22] text-sm">
          {error}
        </div>
      )}

      {googleError ? (
        <div className="p-3 rounded-lg bg-[#fef3e2] border border-[#e67e22] text-[#e67e22] text-sm">
          {googleError}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        isLoading={isLoading}
        rightIcon={<ArrowRightIcon className="text-white" />}
        size="md"
      >
        Sign Up
      </Button>

      <div className="flex justify-center gap-4 py-2">
        <SocialButton
          provider="google"
          onClick={handleGoogleSignup}
          disabled={isGoogleLoading}
          aria-label="Continue with Google"
        />
      </div>

      <p className="text-sm text-[#736B66] font-bold leading-[100%] tracking-[-0.2%] text-center">
        Already have an account?
        <Link
          href={
            sharedGroupSlug
              ? `/signin?group=${encodeURIComponent(sharedGroupSlug)}`
              : "/signin"
          }
          className="text-[#ED7E1C] hover:underline"
        >
          {" "}
          Sign In
        </Link>
      </p>
    </form>
  );
}
