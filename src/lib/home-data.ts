import { fetchDashboardMetricsFromDb } from "@/lib/dashboard-metrics";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { listRecentReports } from "@/lib/submissions-db";
import { dashboardMetrics, featuredReports, type Metric, type ReportData } from "@/lib/site-data";

export const quickEntrySteps = [
  {
    step: "1",
    title: "AI 风控预审",
    detail: "填写申报总金额与项目信息，上传 PDF / 图片；本地解析 + 图片识图汇总凭据金额。",
  },
  {
    step: "2",
    title: "自动生成风控报告",
    detail: "GLM-5V-Turbo 审核并回写风险分、结论、风险表；报告页展示金额饼图与申报/凭据一致性提示。",
  },
  {
    step: "3",
    title: "运营复核",
    detail: "管理后台按风险筛选、通过或驳回；规则配置页维护学院合规条款（上限 50 条自动归档）。",
  },
] as const;

export async function getHomeDashboardMetrics(): Promise<Metric[]> {
  if (!isSupabaseConfigured()) {
    return dashboardMetrics;
  }

  try {
    return await fetchDashboardMetricsFromDb();
  } catch {
    return dashboardMetrics;
  }
}

export async function getHomeRecentReports(limit = 2): Promise<ReportData[]> {
  if (!isSupabaseConfigured()) {
    return featuredReports.slice(0, limit);
  }

  try {
    const reports = await listRecentReports(limit);
    return reports.length > 0 ? reports : featuredReports.slice(0, limit);
  } catch {
    return featuredReports.slice(0, limit);
  }
}
