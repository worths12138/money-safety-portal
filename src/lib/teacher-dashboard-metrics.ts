import type { SubmissionRow } from "@/lib/supabase/types";

const HIGH_RISK = 70;
const LOW_RISK = 40;

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function countDeltaHint(today: number, yesterday: number, unit = "条") {
  const delta = today - yesterday;
  if (delta === 0) return `较昨日 持平`;
  const sign = delta > 0 ? "+" : "";
  return `较昨日 ${sign}${delta} ${unit}`;
}

export type TeacherStatCard = {
  key: string;
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "red" | "green" | "purple";
};

export function buildTeacherDashboardStats(rows: SubmissionRow[]): TeacherStatCard[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(new Date(now.getTime() - 86_400_000));

  const pending = rows.filter((r) => r.status === "pending");
  const pendingToday = pending.filter((r) => new Date(r.submitted_at) >= todayStart).length;
  const pendingYesterday = pending.filter((r) => {
    const t = new Date(r.submitted_at);
    return t >= yesterdayStart && t < todayStart;
  }).length;

  const highRisk = rows.filter((r) => r.risk_score >= HIGH_RISK);
  const highRiskToday = highRisk.filter((r) => new Date(r.submitted_at) >= todayStart).length;
  const highRiskYesterday = highRisk.filter((r) => {
    const t = new Date(r.submitted_at);
    return t >= yesterdayStart && t < todayStart;
  }).length;

  const processedToday = rows.filter((r) => {
    if (!r.reviewed_at) return false;
    return new Date(r.reviewed_at) >= todayStart;
  }).length;
  const processedYesterday = rows.filter((r) => {
    if (!r.reviewed_at) return false;
    const t = new Date(r.reviewed_at);
    return t >= yesterdayStart && t < todayStart;
  }).length;

  const avgScore =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.risk_score, 0) / rows.length) * 10) / 10
      : 0;

  const todayRows = rows.filter((r) => new Date(r.submitted_at) >= todayStart);
  const yesterdayRows = rows.filter((r) => {
    const t = new Date(r.submitted_at);
    return t >= yesterdayStart && t < todayStart;
  });
  const avgToday =
    todayRows.length > 0
      ? todayRows.reduce((s, r) => s + r.risk_score, 0) / todayRows.length
      : avgScore;
  const avgYesterday =
    yesterdayRows.length > 0
      ? yesterdayRows.reduce((s, r) => s + r.risk_score, 0) / yesterdayRows.length
      : avgToday;
  const avgDelta = Math.round((avgToday - avgYesterday) * 10) / 10;
  const avgHint =
    rows.length === 0
      ? "暂无申报数据"
      : avgDelta === 0
        ? "较昨日 持平"
        : `较昨日 ${avgDelta > 0 ? "+" : ""}${avgDelta} 分`;

  return [
    {
      key: "pending",
      label: "待复核",
      value: String(pending.length),
      hint: countDeltaHint(pendingToday, pendingYesterday),
      tone: "blue",
    },
    {
      key: "high",
      label: "高风险",
      value: String(highRisk.length),
      hint: countDeltaHint(highRiskToday, highRiskYesterday),
      tone: "red",
    },
    {
      key: "done",
      label: "今日已处理",
      value: String(processedToday),
      hint: countDeltaHint(processedToday, processedYesterday),
      tone: "green",
    },
    {
      key: "avg",
      label: "平均风险分",
      value: rows.length > 0 ? String(avgScore) : "—",
      hint: avgHint,
      tone: "purple",
    },
  ];
}

export function filterQueueByRiskTier<T extends { risk: number }>(
  items: T[],
  filter: "全部" | "低" | "中" | "高",
): T[] {
  if (filter === "全部") return items;
  if (filter === "低") return items.filter((i) => i.risk < LOW_RISK);
  if (filter === "中") return items.filter((i) => i.risk >= LOW_RISK && i.risk < HIGH_RISK);
  return items.filter((i) => i.risk >= HIGH_RISK);
}

export function formatSubmittedDisplay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) {
    return `今天 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) {
    return `昨天 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
