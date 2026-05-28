import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import type { UserRole } from "@/lib/auth/types";

function isPublicStudentPath(pathname: string) {
  return pathname === "/student/login";
}

function isPublicTeacherPath(pathname: string) {
  return pathname === "/teacher/login";
}

/** 用 service_role 读 profiles（RLS 未放行 authenticated 时，anon 会话读不到角色） */
async function loadRole(userId: string): Promise<UserRole | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) return null;
  const role = data?.role;
  if (role === "student" || role === "teacher") return role;
  return null;
}

/** 将遗留 /report/:id 重定向到当前登录角色的门户报告页 */
export async function redirectLegacyReportIfNeeded(
  request: NextRequest,
): Promise<NextResponse | null> {
  const match = request.nextUrl.pathname.match(/^\/report\/([^/]+)$/);
  if (!match) return null;

  if (!isAuthEnabled()) return null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only for role probe */
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = await loadRole(user.id);
  if (role !== "student" && role !== "teacher") return null;

  const url = request.nextUrl.clone();
  url.pathname = role === "teacher" ? `/teacher/report/${match[1]}` : `/student/report/${match[1]}`;
  return NextResponse.redirect(url);
}

/** 教师已登录时勿停留在遗留 /admin */
export async function redirectLegacyAdminForTeacherIfNeeded(
  request: NextRequest,
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return null;
  if (!isAuthEnabled()) return null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only */
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const role = await loadRole(user.id);
  if (role !== "teacher") return null;

  const url = request.nextUrl.clone();
  if (pathname === "/admin" || pathname === "/admin/") {
    url.pathname = "/teacher/queue";
  } else if (pathname === "/admin/rules") {
    url.pathname = "/teacher/rules";
  } else {
    url.pathname = "/teacher/queue";
  }
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isAuthEnabled()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/student") && !isPublicStudentPath(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const role = await loadRole(user.id);
    if (role !== "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/teacher/login";
      url.searchParams.set("error", "role");
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/teacher") && !isPublicTeacherPath(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/teacher/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const role = await loadRole(user.id);
    if (role !== "teacher") {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      url.searchParams.set("error", "role");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
