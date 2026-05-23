import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { SubmissionRow } from "@/lib/supabase/types";
import type { Metric } from "@/lib/site-data";

const HIGH_RISK_THRESHOLD = 70;
const LOW_RISK_THRESHOLD = 40;

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDeltaHint(todayCount: number, yesterdayCount: number) {
  if (yesterdayCount === 0) {
    return todayCount > 0 ? `今日新增 ${todayCount} 条` : "暂无新增申报";
  }
  const delta = ((todayCount - yesterdayCount) / yesterdayCount) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `较昨日 ${sign}${Math.round(delta)}%`;
}

function formatMinutes(minutes: number | null) {
  if (minutes === null) {
    return "—";
  }
  if (minutes < 1) {
    return "< 1 分钟";
  }
  return `${minutes.toFixed(1)} 分钟`;
}

export function buildMetricsFromRows(rows: Pick<SubmissionRow, "risk_score" | "status" | "submitted_at" | "reviewed_at">[]): Metric[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(new Date(now.getTime() - 86_400_000));

  const total = rows.length;
  const todayCount = rows.filter((row) => new Date(row.submitted_at) >= todayStart).length;
  const yesterdayCount = rows.filter((row) => {
    const submitted = new Date(row.submitted_at);
    return submitted >= yesterdayStart && submitted < todayStart;
  }).length;

  const highRiskPending = rows.filter((row) => row.status === "pending" && row.risk_score >= HIGH_RISK_THRESHOLD).length;

  const reviewed = rows.filter((row) => row.reviewed_at);
  let avgReviewMinutes: number | null = null;
  if (reviewed.length > 0) {
    const totalMs = reviewed.reduce((sum, row) => {
      return sum + (new Date(row.reviewed_at!).getTime() - new Date(row.submitted_at).getTime());
    }, 0);
    avgReviewMinutes = totalMs / reviewed.length / 60_000;
  }

  const lowRiskCount = rows.filter((row) => row.risk_score < LOW_RISK_THRESHOLD).length;
  const completeRate = total > 0 ? Math.round((lowRiskCount / total) * 100) : 0;

  return [
    {
      label: "合规申报",
      value: String(total),
      hint: formatDeltaHint(todayCount, yesterdayCount),
    },
    {
      label: "高风险待复核",
      value: String(highRiskPending),
      hint: highRiskPending > 0 ? "优先处理高额支出" : "当前无高风险待审",
    },
    {
      label: "平均风控时长",
      value: formatMinutes(avgReviewMinutes),
      hint: reviewed.length > 0 ? `已复核 ${reviewed.length} 条` : "尚无完成复核记录",
    },
    {
      label: "凭证完整率",
      value: `${completeRate}%`,
      hint: "按低风险初评占比统计（平台不存凭证文件）",
    },
  ];
}

export async function fetchDashboardMetricsFromDb(): Promise<Metric[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("submissions").select("risk_score, status, submitted_at, reviewed_at");

  if (error) {
    throw new Error(error.message);
  }

  return buildMetricsFromRows((data ?? []) as Pick<SubmissionRow, "risk_score" | "status" | "submitted_at" | "reviewed_at">[]);
}
