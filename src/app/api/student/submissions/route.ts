import { NextResponse } from "next/server";
import { authErrorResponse, requireSessionProfile } from "@/lib/auth/session";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { listStudentSubmissions } from "@/lib/submissions-db";

export async function GET() {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  try {
    const profile = await requireSessionProfile("student");
    const items = await listStudentSubmissions(profile.id);
    return NextResponse.json({ ok: true, items, loginName: profile.loginName });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "加载失败。" },
      { status: 500 },
    );
  }
}
