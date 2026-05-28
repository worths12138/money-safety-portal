import Link from "next/link";
import { getHomeDashboardMetrics, getHomeRecentReports, quickEntrySteps } from "@/lib/home-data";
import { isLegacyPortalEnabled } from "@/lib/legacy-portal";
import { reportPathForRole } from "@/lib/portal-nav";
import { quickHighlights } from "@/lib/site-data";

export type HomeDashboardVariant = "legacy" | "teacher";

type HomeDashboardProps = {
  variant?: HomeDashboardVariant;
};

export async function HomeDashboard({ variant = "legacy" }: HomeDashboardProps) {
  const isTeacher = variant === "teacher";
  const [metrics, recentReports] = await Promise.all([getHomeDashboardMetrics(), getHomeRecentReports(2)]);
  const latestReport = recentReports[0];

  const queueHref = isTeacher ? "/teacher/queue" : "/admin";
  const queueLabel = isTeacher ? "进入复核队列" : "去后台处理";
  const primaryHref = isTeacher ? "/teacher/queue" : "/preaudit";
  const primaryLabel = isTeacher ? "复核队列" : "AI 风控预审";
  const breadcrumb = isTeacher ? "/teacher/dashboard" : "/home";
  const reportRole = isTeacher ? "teacher" : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-6">
        <div className="sysu-card overflow-hidden p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">{breadcrumb}</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 flex-1">
              <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {isTeacher
                  ? "大创报销合规数据看板"
                  : "中山大学软件工程学院大创报销经费合规风控，让核验更可信。"}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {isTeacher
                  ? "汇总待审申报、风险分布与最近风控报告，便于指导教师把握整体复核进度。"
                  : "面向大创报销场景：凭证多模态识图、申报总金额与凭据自动比对、可解释风控报告与运营复核闭环。"}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {primaryLabel}
                </Link>
                {latestReport ? (
                  <Link
                    href={reportPathForRole(reportRole, latestReport.id)}
                    className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    查看最新风控报告
                  </Link>
                ) : !isTeacher ? (
                  <Link
                    href="/report/2026-041"
                    className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    查看示例风控报告
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="home-hero-brand mx-auto shrink-0 lg:mx-0 lg:pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/photos/brand" alt="审盾" className="home-hero-brand-icon" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="sysu-card p-6">
            <div className="mb-4 h-1 w-16 rounded-md border border-slate-200 bg-white" />
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-500">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="sysu-card relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-[#f6f6f6]" aria-hidden />
          <div className="relative">
            <div className="h-1.5 w-14 rounded-md border border-slate-200 bg-white" />
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 4v10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m8 8 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-medium">{isTeacher ? "复核流程" : "快速入口"}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {isTeacher ? "学生提交 → AI 初审 → 教师批复" : "上传凭证后自动生成风控报告草稿"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isTeacher
                ? "学生在学生端提交申报与凭证；教师在本平台发起 AI 初审后，结合报告与凭证预览完成通过或驳回。"
                : "提交后自动完成 PDF/图片金额识别与 Agent 风控，生成含风险分与金额占比的报告草稿，并进入运营审核队列。"}
            </p>

            <ol className="mt-5 space-y-3">
              {quickEntrySteps.map((item) => (
                <li key={item.step} className="flex gap-3 rounded-md border border-slate-200 bg-white/90 px-4 py-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 leading-6 text-slate-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {isTeacher ? "去复核队列" : "立即上传并生成草稿"}
              </Link>
              {latestReport ? (
                <Link
                  href={reportPathForRole(reportRole, latestReport.id)}
                  className="border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  打开最近报告
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sysu-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">最近申报</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">最近风控报告</h3>
            </div>
            <Link href={queueHref} className="text-sm font-medium text-slate-900 transition hover:text-slate-700">
              {queueLabel}
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {recentReports.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                暂无申报记录。
                {isTeacher ? (
                  <span className="mt-2 block text-slate-600">请提醒学生在学生端提交申报。</span>
                ) : (
                  <Link href="/preaudit" className="mt-2 block font-medium text-[var(--accent-green)] hover:underline">
                    去提交第一份合规申报 →
                  </Link>
                )}
              </div>
            ) : (
              recentReports.map((report) => (
                <article key={report.id} className="rounded-md border border-slate-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{report.projectPeriod}</p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-950">{report.projectName}</h4>
                      <p className="mt-1 text-xs text-slate-400">编号 {report.id}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      风险 {report.riskScore}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{report.conclusion || report.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={reportPathForRole(reportRole, report.id)}
                      className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                    >
                      打开风控报告
                    </Link>
                    {!isTeacher ? (
                      <Link
                        href="/preaudit"
                        className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        再提交一份
                      </Link>
                    ) : (
                      <Link
                        href={queueHref}
                        className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        去队列处理
                      </Link>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="sysu-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-2 rounded-sm border border-slate-200 bg-white" />
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">功能概览</p>
          </div>
          <div className="mt-5 space-y-3">
            {quickHighlights.map((item) => (
              <div
                key={item}
                className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
          {isTeacher && isLegacyPortalEnabled() ? (
            <p className="mt-4 text-xs text-slate-500">
              开发模式可访问遗留演示首页：
              <Link href="/home" className="ml-1 font-medium underline">
                /home
              </Link>
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
