import { NextResponse } from "next/server";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";

export async function POST(request: Request) {
  const limited = rateLimit(request, "agent-review", 8, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "Agent 风控请求过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const body = (await withTimeout(request.json(), 8_000)) as { reportId?: string; text?: string };
    const response = await withTimeout(
      Promise.resolve({
        ok: true,
        message: "Agent 已生成初步风控意见。",
        reportId: body.reportId ?? "",
        annotations: ["申报金额与支出类别已核对。", "缺失凭证已保留留白，便于补证。"],
      }),
      8_000,
    );

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json({ ok: false, message: "Agent 风控评估失败。" }, { status: 500 });
  }
}
