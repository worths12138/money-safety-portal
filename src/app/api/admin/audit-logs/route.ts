import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { authErrorResponse } from "@/lib/auth/session";
import { getTeacherIfAuth } from "@/lib/auth/api-guard";
import { listAuditLogs } from "@/lib/submissions-db";

export async function GET(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "admin-logs", 30, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "请求过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    await getTeacherIfAuth();
    const logs = await withTimeout(listAuditLogs(), 8_000);
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;

    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "审核记录加载失败。" },
      { status: 500 },
    );
  }
}
