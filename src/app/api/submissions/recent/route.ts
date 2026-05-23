import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getHomeRecentReports } from "@/lib/home-data";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function GET(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "submissions-recent", 30, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "请求过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "2"), 1), 10);

  try {
    const reports = await withTimeout(getHomeRecentReports(limit), 8_000);
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "最近报告加载失败。" },
      { status: 500 },
    );
  }
}
