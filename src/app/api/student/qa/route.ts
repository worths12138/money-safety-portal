import { NextResponse } from "next/server";
import { authErrorResponse, requireSessionProfile } from "@/lib/auth/session";
import { getReimbursementRagMeta } from "@/lib/rag/rules-store";
import { runStudentComplianceQa } from "@/lib/rag/student-qa";

export async function POST(request: Request) {
  try {
    await requireSessionProfile("student");
  } catch (error) {
    const authRes = authErrorResponse(error);
    if (authRes) return authRes;
    return NextResponse.json({ ok: false, message: "需要学生账号登录。" }, { status: 401 });
  }

  let body: { question?: string };
  try {
    body = (await request.json()) as { question?: string };
  } catch {
    return NextResponse.json({ ok: false, message: "请求体无效。" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ ok: false, message: "请输入问题。" }, { status: 400 });
  }

  try {
    const { answer, matchedRules } = await runStudentComplianceQa(question);
    const meta = getReimbursementRagMeta();
    return NextResponse.json({
      ok: true,
      answer,
      matchedRules: matchedRules.map((r) => ({
        rule_id: r.rule_id,
        category: r.category,
        risk_level: r.risk_level,
        risk_tags: r.risk_tags,
        source: r.source,
      })),
      library: { name: meta.name, version: meta.version },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "答疑失败。";
    const status = message.includes("ZHIPU") ? 503 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
