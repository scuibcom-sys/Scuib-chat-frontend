import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  const nextSearchParams = new URLSearchParams(request.nextUrl.searchParams);

  nextSearchParams.set("key", key);

  return NextResponse.redirect(
    new URL(`/verify-email?${nextSearchParams.toString()}`, request.url),
  );
}
