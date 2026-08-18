import { AuthCard } from "@/components/auths/AuthCard";
import { SignUpForm } from "@/components/auths/forms/SignUpForm";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawGroup = Array.isArray(params.group) ? params.group[0] : params.group;
  const sharedGroupSlug = rawGroup?.trim() || null;

  return (
    <AuthCard title="Sign Up For Free">
      <SignUpForm sharedGroupSlug={sharedGroupSlug} />
    </AuthCard>
  );
}
