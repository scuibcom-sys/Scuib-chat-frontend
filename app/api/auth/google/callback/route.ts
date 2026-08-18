import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.toString();
  const destination = search ? `/google/callback?${search}` : "/google/callback";

  return NextResponse.redirect(new URL(destination, request.url));
}
