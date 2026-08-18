export function normalizeAbsoluteUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return null;

  try {
    return new URL(trimmedValue).toString().replace(/\/+$/, "");
  } catch {
    try {
      return new URL(`https://${trimmedValue}`).toString().replace(/\/+$/, "");
    } catch {
      return null;
    }
  }
}


