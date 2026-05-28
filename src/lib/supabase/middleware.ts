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

async function loadRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<UserRole | null> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
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
    const role = await loadRole(supabase, user.id);
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
    const role = await loadRole(supabase, user.id);
    if (role !== "teacher") {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      url.searchParams.set("error", "role");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
