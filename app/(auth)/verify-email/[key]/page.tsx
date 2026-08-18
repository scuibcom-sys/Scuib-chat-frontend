import { redirect } from "next/navigation";

export default async function VerifyEmailKeyRedirectPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  redirect(`/verify-email?key=${encodeURIComponent(key)}`);
}
