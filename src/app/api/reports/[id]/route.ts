import { NextResponse } from "next/server";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { getStoredReport } from "@/lib/report-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(request, "reports", 20, 30_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "报告访问过快，请稍后重试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const { id } = await params;
    const report = await withTimeout(Promise.resolve(getStoredReport(id)), 5_000);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json({ ok: false, message: "报告加载失败。" }, { status: 500 });
  }
}
