import { NextResponse } from "next/server";
import { isAuthEnabled, loginNameToEmail } from "@/lib/auth/config";
import type { UserRole } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type LoginBody = {
  loginName?: string;
  password?: string;
  role?: UserRole;
};

export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { ok: false, message: "未配置登录：请在 .env.local 设置 NEXT_PUBLIC_SUPABASE_ANON_KEY。" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as LoginBody;
    const loginName = body.loginName?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const expectedRole = body.role;

    if (!loginName || !password) {
      return NextResponse.json({ ok: false, message: "请输入账号与密码。" }, { status: 400 });
    }
    if (expectedRole !== "student" && expectedRole !== "teacher") {
      return NextResponse.json({ ok: false, message: "无效登录端。" }, { status: 400 });
    }

    const email = loginNameToEmail(loginName);
    const supabase = await createSupabaseServerClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      return NextResponse.json(
        { ok: false, message: "账号或密码错误，请重试。" },
        { status: 401 },
      );
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, login_name, display_name")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, message: "账号未初始化，请在 Supabase 执行种子脚本 npm run seed:users。" },
        { status: 403 },
      );
    }

    if (profile.role !== expectedRole) {
      await supabase.auth.signOut();
      const hint = expectedRole === "student" ? "学生端" : "教师端";
      return NextResponse.json(
        { ok: false, message: `该账号不能登录${hint}，请切换入口。` },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      profile: {
        id: profile.id,
        role: profile.role,
        loginName: profile.login_name,
        displayName: profile.display_name || profile.login_name,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: "登录失败，请稍后重试。" }, { status: 500 });
  }
}
