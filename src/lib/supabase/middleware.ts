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
