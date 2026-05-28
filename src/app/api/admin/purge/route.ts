import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { authErrorResponse } from "@/lib/auth/session";
import { getTeacherIfAuth } from "@/lib/auth/api-guard";
import { purgeAllAdminData } from "@/lib/submission-retention";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "admin-purge", 4, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "清空操作过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    await getTeacherIfAuth();
    const result = await withTimeout(purgeAllAdminData(), 15_000);
    return NextResponse.json({
      ok: true,
      message: `已清空 ${result.deletedSubmissions} 条申报、${result.deletedLogs} 条审核记录。`,
      ...result,
    });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;

    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "清空失败。" },
      { status: 400 },
    );
  }
}
