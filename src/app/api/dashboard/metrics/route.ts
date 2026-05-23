import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getHomeDashboardMetrics } from "@/lib/home-data";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function GET(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "dashboard-metrics", 30, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "请求过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const metrics = await withTimeout(getHomeDashboardMetrics(), 8_000);
    return NextResponse.json({ ok: true, metrics });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "指标加载失败。" },
      { status: 500 },
    );
  }
}
