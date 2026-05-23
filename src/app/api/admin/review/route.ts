import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { getClientTimeoutHeader, rateLimit, timeoutResponse, withTimeout } from "@/lib/server-guards";
import { parseReviewResult, reviewSubmission } from "@/lib/submissions-db";

type ReviewBody = {
  id: string;
  status: "通过" | "驳回";
  actorName?: string;
};

export async function POST(request: Request) {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  const limited = rateLimit(request, "admin-review", 20, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { ok: false, message: "审核操作过于频繁。" },
      { status: 429, headers: getClientTimeoutHeader(limited.resetAt) },
    );
  }

  try {
    const body = (await withTimeout(request.json(), 8_000)) as ReviewBody;

    if (!body.id || (body.status !== "通过" && body.status !== "驳回")) {
      return NextResponse.json({ ok: false, message: "参数无效。" }, { status: 400 });
    }

    const result = parseReviewResult(body.status);
    const outcome = await withTimeout(reviewSubmission(body.id, result, body.actorName), 8_000);

    return NextResponse.json({
      ok: true,
      message: body.status === "通过" ? "已通过审核。" : "已驳回。",
      queueItem: outcome.queueItem,
      log: outcome.log,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("超时")) {
      return timeoutResponse();
    }

    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "审核失败。" },
      { status: 400 },
    );
  }
}
