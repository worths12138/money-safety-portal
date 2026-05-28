import { NextResponse, type NextRequest } from "next/server";
import { isLegacyPortalEnabled, isLegacyPortalPath } from "@/lib/legacy-portal";
import {
  redirectLegacyAdminForTeacherIfNeeded,
  redirectLegacyReportIfNeeded,
  updateSession,
} from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const reportRedirect = await redirectLegacyReportIfNeeded(request);
  if (reportRedirect) return reportRedirect;

  const adminRedirect = await redirectLegacyAdminForTeacherIfNeeded(request);
  if (adminRedirect) return adminRedirect;

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
