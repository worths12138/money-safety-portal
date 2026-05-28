import { NextResponse, type NextRequest } from "next/server";
import { isLegacyPortalEnabled, isLegacyPortalPath } from "@/lib/legacy-portal";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLegacyPortalPath(pathname) && !isLegacyPortalEnabled()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/student/:path*",
    "/teacher/:path*",
    "/home",
    "/preaudit",
    "/submit",
    "/audit",
    "/admin",
    "/admin/:path*",
    "/report/:path*",
  ],
};
