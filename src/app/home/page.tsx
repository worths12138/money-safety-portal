import Link from "next/link";
import { dashboardMetrics, featuredReports, quickHighlights } from "@/lib/site-data";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="grid gap-6">
        <div className="sysu-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-700">/ 首页</p>
          <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            中山大学软件工程学院大创报销经费合规风控，让核验更可信。
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            面向大创报销场景，覆盖合规申报、风控报告与规则配置，支持 Agent 预审与风险分级。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/submit" className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              发起合规申报
            </Link>
            <Link href="/report/2026-041" className="border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              查看风控报告
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {dashboardMetrics.map((metric) => (
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
              <span className="font-medium">快速入口</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">上传凭证后自动生成风控报告草稿</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">支持多格式凭证采集、Agent 预审接口预留与缺失项留白展示。</p>
          </div>
        </div>

        <div className="sysu-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">示例报告</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">最近的两份合规风控样例</h3>
            </div>
            <Link href="/admin" className="text-sm font-medium text-slate-900 transition hover:text-slate-700">
              去后台处理
            </Link>
          </div>

          <div className="mt-5 space-y-4">
            {featuredReports.map((report) => (
              <article key={report.id} className="rounded-md border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{report.projectPeriod}</p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950">{report.projectName}</h4>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    风险 {report.riskScore}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{report.conclusion}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/report/${report.id}`} className="border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
                    打开风控报告
                  </Link>
                </div>
              </article>
            ))}
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
              <div key={item} className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
