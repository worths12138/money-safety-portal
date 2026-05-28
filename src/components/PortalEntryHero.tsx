import Link from "next/link";
import { isLegacyPortalEnabled } from "@/lib/legacy-portal";

const FLOW_STEPS = [
  { label: "上传凭证", icon: UploadIcon },
  { label: "规则召回", icon: RulesIcon },
  { label: "凭证识别", icon: OcrIcon },
  { label: "风险评分", icon: ShieldIcon },
  { label: "报告生成", icon: ReportIcon },
  { label: "教师复核", icon: ReviewIcon },
] as const;

const FEATURES = [
  {
    title: "多模态凭证解析",
    desc: "支持票据、截图与 PDF 材料识别。",
    icon: OcrFeatureIcon,
  },
  {
    title: "规则增强风控",
    desc: "结合报销规则与 AI 判断，提升合规性。",
    icon: ShieldFeatureIcon,
  },
  {
    title: "教师复核闭环",
    desc: "风险报告清晰可读，复核处理更高效。",
    icon: TeamFeatureIcon,
  },
] as const;

export function PortalEntryHero() {
  return (
    <div className="portal-entry portal-entry--home mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-8">
      <section className="portal-entry-hero overflow-hidden p-6 sm:p-10">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/photos/brand"
            alt="审盾"
            className="mx-auto h-14 w-14 rounded-2xl object-cover shadow-sm sm:h-16 sm:w-16"
          />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            SYSU · 金融合规 · 风控
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            审盾 · 大创报销经费合规风控平台
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            基于多模态凭证解析、规则引擎与 AI Agent 的智能风控辅助平台
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Link href="/student/login" className="portal-entry-role portal-entry-role--student group">
            <span className="portal-entry-role-icon" aria-hidden>
              <GraduationIcon />
            </span>
            <span className="portal-entry-role-copy">
              <span className="portal-entry-role-title">我是学生</span>
              <span className="portal-entry-role-desc">提交材料 | 合规答疑 | 查看整改建议</span>
              <span className="portal-entry-role-cta">进入学生端 →</span>
            </span>
          </Link>

          <Link href="/teacher/login" className="portal-entry-role portal-entry-role--teacher group">
            <span className="portal-entry-role-icon portal-entry-role-icon--teacher" aria-hidden>
              <TeacherIcon />
            </span>
            <span className="portal-entry-role-copy">
              <span className="portal-entry-role-title text-slate-900">我是指导老师</span>
              <span className="portal-entry-role-desc text-slate-600">AI 预审 | 风险报告 | 复核处理</span>
              <span className="portal-entry-role-cta portal-entry-role-cta--teacher">进入教师端 →</span>
            </span>
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="portal-feature-card">
            <span className="portal-feature-icon" aria-hidden>
              <f.icon />
            </span>
            <div className="portal-feature-copy">
              <h2>{f.title}</h2>
              <span className="portal-feature-rule" aria-hidden />
              <p>{f.desc}</p>
            </div>
          </article>
        ))}
      </div>

      {isLegacyPortalEnabled() ? (
        <p className="portal-entry-dev-link mt-6 text-center text-xs text-slate-500">
          <Link href="/home" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700">
            进入原完整导航（仅开发，需 ENABLE_LEGACY_PORTAL）
          </Link>
        </p>
      ) : null}
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

function OcrFeatureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function ShieldFeatureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" strokeLinejoin="round" />
      <path d="M9.5 12 11.5 14l4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TeamFeatureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="2.5" />
      <circle cx="16" cy="10" r="2" />
      <path d="M4 18c0-2.2 2.2-4 5-4M14 18c0-1.8 1.5-3.2 3.5-3.5" strokeLinecap="round" />
      <path d="M12 14v4M10 16h4" strokeLinecap="round" />
    </svg>
  );
}
