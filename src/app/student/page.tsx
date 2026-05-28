import Link from "next/link";

export const metadata = {
  title: "学生首页 | 大创报销合规风控",
  description: "学生报销工作台：提交申报、合规答疑、进度查询。",
};

const CHECKLIST = ["发票清晰", "付款记录完整", "金额一致", "用途相关", "特殊材料齐全"] as const;

const FLOW = [
  { label: "填写申报", icon: "form" },
  { label: "上传凭证", icon: "upload" },
  { label: "AI问答", icon: "qa" },
  { label: "提交导师", icon: "submit" },
  { label: "查看反馈", icon: "feedback" },
] as const;

export default function StudentHomePage() {
  return (
    <div className="student-page mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="student-page-card sysu-card">
        <div className="student-workbench-hero">
          <div className="student-workbench-hero-icon" aria-hidden>
            <WorkbenchShieldIcon />
          </div>
          <h1 className="student-workbench-title">学生端报销工作台</h1>
          <p className="student-workbench-subtitle">上传材料、完成申报、智能答疑，让报销更规范。</p>
        </div>

        <div className="student-action-grid">
          <article className="student-action-card">
            <span className="student-action-card-icon" aria-hidden>
              <SubmitIcon />
            </span>
            <h2>提交申报</h2>
            <p>上传发票 / 付款截图 / PDF 材料</p>
            <Link href="/student/preaudit" className="student-btn-primary">
              开始提交
            </Link>
          </article>
          <article className="student-action-card">
            <span className="student-action-card-icon" aria-hidden>
              <QaIcon />
            </span>
            <h2>AI 问答</h2>
            <p>报销规则检索与智能合规答疑</p>
            <Link href="/student/qa" className="student-btn-primary">
              开始问答
            </Link>
          </article>
          <article className="student-action-card">
            <span className="student-action-card-icon" aria-hidden>
              <ProgressIcon />
            </span>
            <h2>查询进度</h2>
            <p>查看 AI 初审、教师复核与整改状态</p>
            <Link href="/student/status" className="student-btn-primary">
              查看进度
            </Link>
          </article>
        </div>

        <div className="student-bottom-grid">
          <section className="student-panel">
            <h2 className="student-panel-title">报销流程</h2>
            <ol className="student-flow-steps">
              {FLOW.map((step) => (
                <li key={step.label} className="student-flow-step">
                  <span className="student-flow-step-icon">
                    <FlowStepIcon kind={step.icon} />
                  </span>
                  {step.label}
                </li>
              ))}
            </ol>
            <p className="student-flow-banner">
              <span aria-hidden>💡</span>
              AI 初审 + 教师复核双重把关，确保合规高效
            </p>
          </section>
          <section className="student-panel">
            <h2 className="student-panel-title">提交前检查</h2>
            <ul className="student-checklist">
              {CHECKLIST.map((item) => (
                <li key={item}>
                  <span className="student-check-dot" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function WorkbenchShieldIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 3 6 7.5v8c0 6.5 4.5 11 10 12.5 5.5-1.5 10-6 10-12.5v-8L16 3Z" strokeLinejoin="round" />
      <circle cx="16" cy="14" r="3" />
      <path d="M13.5 17.5 16 20l4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SubmitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 4h11v11M7 17 19 5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="8" width="10" height="12" rx="1" />
    </svg>
  );
}

function QaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="7" width="14" height="11" rx="2" />
      <path d="M9 11h6M9 14h4" strokeLinecap="round" />
      <path d="M12 4v2" strokeLinecap="round" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16 20 20" strokeLinecap="round" />
      <path d="M8 11h6M11 8v6" strokeLinecap="round" />
    </svg>
  );
}

function FlowStepIcon({ kind }: { kind: (typeof FLOW)[number]["icon"] }) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "form":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M6 4h10v12H6V4Z" />
          <path d="M8 8h6M8 11h4" strokeLinecap="round" />
        </svg>
      );
    case "upload":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M10 13V5m0 0-3 3m3-3 3 3" strokeLinecap="round" />
          <path d="M4 15h12" strokeLinecap="round" />
        </svg>
      );
    case "qa":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3 3v-3H6a2 2 0 0 1-2-2V6Z" />
        </svg>
      );
    case "submit":
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <circle cx="10" cy="7" r="2.5" />
          <path d="M5 17c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" fill="none" className={cls} stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6h12v8H4V6Z" />
          <path d="M7 10h6" strokeLinecap="round" />
        </svg>
      );
  }
}
