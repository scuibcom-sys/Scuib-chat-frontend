import GoogleCallbackClient from "./google-callback-client";

type GoogleCallbackSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type GoogleCallbackQueryParams = Record<string, string | string[]>;

function normalizeSearchParams(
  searchParams: Awaited<GoogleCallbackSearchParams>,
): GoogleCallbackQueryParams {
  const result: GoogleCallbackQueryParams = {};

  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();

      if (trimmed) {
        result[key] = trimmed;
      }

      continue;
    }

    if (!Array.isArray(rawValue)) {
      continue;
    }

    const trimmedValues = rawValue
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (trimmedValues.length === 1) {
      result[key] = trimmedValues[0];
      continue;
    }

    if (trimmedValues.length > 1) {
      result[key] = trimmedValues;
    }
  }

  return result;
}

export default async function GoogleCallbackPage({
  searchParams,
}: {
  searchParams: GoogleCallbackSearchParams;
}) {
  const queryParams = normalizeSearchParams(await searchParams);

  return <GoogleCallbackClient queryParams={queryParams} />;
}
