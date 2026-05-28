import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProfileRow, SessionProfile, UserRole } from "@/lib/auth/types";
import { emailToLoginName } from "@/lib/auth/config";

function rowToProfile(row: ProfileRow): SessionProfile {
  return {
    id: row.id,
    role: row.role,
    loginName: row.login_name,
    displayName: row.display_name || row.login_name,
  };
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (!isAuthEnabled()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const { data, error: profileError } = await admin
    .from("profiles")
    .select("id, role, login_name, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !data) {
    return {
      id: user.id,
      role: "student",
      loginName: emailToLoginName(user.email ?? ""),
      displayName: emailToLoginName(user.email ?? ""),
    };
  }

  return rowToProfile(data as ProfileRow);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireSessionProfile(role?: UserRole): Promise<SessionProfile> {
  if (!isAuthEnabled()) {
    throw new AuthError("未启用登录：请配置 NEXT_PUBLIC_SUPABASE_ANON_KEY。", 503);
  }

  const profile = await getSessionProfile();
  if (!profile) {
    throw new AuthError("未登录或会话已过期，请重新登录。", 401);
  }
  if (role && profile.role !== role) {
    throw new AuthError("无权访问该资源。", 403);
  }
  return profile;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
  }
  return null;
}
