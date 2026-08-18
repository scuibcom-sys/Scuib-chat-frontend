import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  const destination = search
    ? `/reset-password?${search}`
    : "/reset-password";

  return NextResponse.redirect(new URL(destination, request.url));
}
