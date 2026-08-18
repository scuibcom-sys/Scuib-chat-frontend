import { redirect } from "next/navigation";

export const metadata = {
  title: "Reset Password - Scuib Chat",
};

export default async function AuthResetPasswordAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const normalizedParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0]) {
        normalizedParams.set(key, value[0]);
      }
      continue;
    }

    if (value) {
      normalizedParams.set(key, value);
    }
  }

  const destination = normalizedParams.toString()
    ? `/reset-password?${normalizedParams.toString()}`
    : "/reset-password";

  redirect(destination);
}
