import Link from "next/link";

const FLOW_STEPS = [
  { label: "上传凭证", icon: UploadIcon },
  { label: "规则召回", icon: RulesIcon },
  { label: "票据识别", icon: OcrIcon },
  { label: "风险评分", icon: ShieldIcon },
  { label: "报告生成", icon: ReportIcon },
  { label: "教师复核", icon: ReviewIcon },
] as const;

const FEATURES = [
  {
    title: "多模态凭证分析",
    desc: "支持 PDF、发票截图、支付记录等，自动 OCR 提取关键字段。",
  },
  {
    title: "规则增强风控",
    desc: "融合学院可配置规则与 RAG 制度库，命中条款可解释、可追溯。",
  },
  {
    title: "教师复核闭环",
    desc: "风险分、问题明细、整改建议与通过/驳回，形成完整审核链路。",
  },
] as const;

export function PortalEntryHero() {
  return (
    <div className="portal-entry mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="portal-entry-hero sysu-card overflow-hidden border-white/60 bg-white/92 p-6 shadow-lg backdrop-blur-md sm:p-10">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/photos/brand"
            alt="审盾"
            className="h-14 w-14 rounded-2xl object-cover shadow-sm sm:h-16 sm:w-16"
          />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            SYSU · 金融合规 · 风控
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            审盾 · 大创报销经费合规风控平台
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            基于多模态凭证分析、规则 RAG 与 AI Agent 的智能风控预审工具。学生提交申报与凭证，教师发起 AI
            初审并完成风险复核。
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link href="/student/login" className="portal-entry-role portal-entry-role--student group">
            <span className="portal-entry-role-icon" aria-hidden>
              <GraduationIcon />
            </span>
            <span className="portal-entry-role-title">我是学生</span>
            <span className="portal-entry-role-desc">提交报销申报 · 上传凭证 · 查看整改建议</span>
            <span className="portal-entry-role-cta">进入学生端 →</span>
          </Link>

          <Link href="/teacher/login" className="portal-entry-role portal-entry-role--teacher group">
            <span className="portal-entry-role-icon portal-entry-role-icon--teacher" aria-hidden>
              <TeacherIcon />
            </span>
            <span className="portal-entry-role-title text-slate-900">我是指导老师</span>
            <span className="portal-entry-role-desc text-slate-600">AI 风控预审 · 风险报告 · 复核处理</span>
            <span className="portal-entry-role-cta portal-entry-role-cta--teacher">进入教师端 →</span>
          </Link>
        </div>

        <ol className="portal-entry-flow mt-10">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.label} className="portal-entry-flow-item">
              <span className="portal-entry-flow-icon" aria-hidden>
                <step.icon />
              </span>
              <span className="portal-entry-flow-label">{step.label}</span>
              {index < FLOW_STEPS.length - 1 ? (
                <span className="portal-entry-flow-arrow hidden sm:inline" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="sysu-card bg-white/90 p-5 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-xs leading-6 text-slate-600 sm:text-sm">{f.desc}</p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        <Link href="/home" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700">
          进入原完整导航（演示/开发）
        </Link>
      </p>
    </div>
  );
}

function GraduationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 2 8l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" strokeLinecap="round" />
      <path d="M22 8v6" strokeLinecap="round" />
    </svg>
  );
}

function TeacherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="12" height="9" rx="1" />
      <path d="M7 13v3M11 13v3" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 11v5M14.5 16h5" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 16V6m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function RulesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 4h9l3 3v13H6V4Z" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function OcrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 4h7l4 4v12H7V4Z" strokeLinejoin="round" />
      <path d="M14 4v4h4M10 12h4M10 16h4" strokeLinecap="round" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
      <path d="M17 10l2 2 3-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
