import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { getSessionProfile, authErrorResponse } from "@/lib/auth/session";
import { getReportByIdForViewer, ReportAccessError } from "@/lib/submissions-db";
import { getMaterialCacheStatus } from "@/lib/report-material-cache-server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "reports", 20, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "风控报告访问过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const { id } = await params;
    const viewer = await getSessionProfile();
    const report = await withTimeout(getReportByIdForViewer(id, viewer), 5_000);

    if (!report) {
      return NextResponse.json({ ok: false, message: "未找到该风控报告。" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, report, materialCache: getMaterialCacheStatus(id) });
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;

    if (error instanceof ReportAccessError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "风控报告加载失败。" },
      { status: 500 },
    );
  }
}
