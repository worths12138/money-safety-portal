import { fetchDashboardMetricsFromDb } from "@/lib/dashboard-metrics";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { listRecentReports } from "@/lib/submissions-db";
import { dashboardMetrics, featuredReports, type Metric, type ReportData } from "@/lib/site-data";

export const quickEntrySteps = [
  { step: "1", title: "填写申报并上传凭证", detail: "在合规申报页提交项目信息与 PDF / Word / 图片凭证。" },
  { step: "2", title: "自动生成风控报告草稿", detail: "提交后写入数据库并跳转报告页，含风险分与可解释风险表。" },
  { step: "3", title: "核对后进入人工审核", detail: "运营台可查看队列、打开风险评估书并通过或驳回。" },
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
