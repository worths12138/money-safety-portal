import { NextResponse } from "next/server";
import { ensureSupabaseConfigured } from "@/lib/api-config";
import { authErrorResponse, getSessionProfile } from "@/lib/auth/session";
import { getTeacherIfAuth } from "@/lib/auth/api-guard";
import { buildTeacherDashboardStats, formatSubmittedDisplay } from "@/lib/teacher-dashboard-metrics";
import { riskTierFromScore, riskTierLabel } from "@/lib/risk-level";
import type { TeacherDashboardQueueItem } from "@/lib/teacher-dashboard-types";
import { listAllSubmissionRows, listAuditLogs, rowToQueueItem } from "@/lib/submissions-db";
import { withTimeout } from "@/lib/server-guards";

const RISK_TIPS = [
  "加强数据真实性核验，关注申报金额与凭据一致性。",
  "警惕超额支出与不可报销类目，结合 RAG 规则库核对。",
  "注意临近 DDL 的申报，优先处理高风险队列。",
  "凭证暂存有时效，请在有效期内完成 AI 初审。",
] as const;

export async function GET() {
  const configError = ensureSupabaseConfigured();
  if (configError) {
    return configError;
  }

  try {
    await getTeacherIfAuth();
    const profile = await getSessionProfile();

    const rows = await withTimeout(listAllSubmissionRows(), 8_000);
    const stats = buildTeacherDashboardStats(rows);

    const queue: TeacherDashboardQueueItem[] = rows.map((row) => {
      const base = rowToQueueItem(row);
      const tier = riskTierFromScore(row.risk_score);
      const summaryRaw = (row.summary || row.conclusion || row.notes || "待 AI 初审或补充说明。").trim();
      const summary = summaryRaw.length > 120 ? `${summaryRaw.slice(0, 120)}…` : summaryRaw;

      return {
        ...base,
        submittedAt: formatSubmittedDisplay(row.submitted_at),
        submittedAtIso: row.submitted_at,
        summary,
        riskTier: tier,
        riskTierLabel: riskTierLabel(tier),
      };
    });

    const logs = await listAuditLogs(8);

    return NextResponse.json({
      ok: true,
      profile,
      stats,
      queue,
      tips: RISK_TIPS,
      logs,
    });
  } catch (err) {
    const authRes = authErrorResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "看板加载失败。" },
      { status: 500 },
    );
  }
}
