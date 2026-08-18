import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  const destination = search ? `/verify-email?${search}` : "/verify-email";

  return NextResponse.redirect(new URL(destination, request.url));
}
