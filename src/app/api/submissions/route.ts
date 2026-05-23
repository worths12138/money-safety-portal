import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { rateLimit, getClientTimeoutHeader, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { createSubmission, type SubmissionPayload } from "@/lib/submissions-db";

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "submissions", 10, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "访问过快，请稍后再试。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const payload = (await withTimeout(request.json(), 8_000)) as SubmissionPayload;
    const report = await withTimeout(createSubmission(payload), 8_000);

    return NextResponse.json({
      ok: true,
      id: report.id,
      message: "申报成功，已生成风控报告草稿。",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "提交失败，请检查字段后重试。" },
      { status: 400 },
    );
  }
}
