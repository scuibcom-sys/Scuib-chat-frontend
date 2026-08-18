import { redirect } from "next/navigation";

export default async function AccountConfirmEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { key } = await params;
  const rawSearchParams = await searchParams;
  const nextSearchParams = new URLSearchParams();

  nextSearchParams.set("key", key);

  for (const [paramKey, paramValue] of Object.entries(rawSearchParams)) {
    if (paramKey === "key") {
      continue;
    }

    const normalizedValue = Array.isArray(paramValue) ? paramValue[0] : paramValue;
    if (typeof normalizedValue === "string" && normalizedValue.trim()) {
      nextSearchParams.set(paramKey, normalizedValue);
    }
  }

  redirect(`/verify-email?${nextSearchParams.toString()}`);
}
