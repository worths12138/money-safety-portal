import Link from "next/link";
import type { ReactNode } from "react";

type StudentPageShellProps = {
  /** 面包屑末级，如「进度查询」 */
  breadcrumb: string;
  title?: string;
  description?: string;
  children: ReactNode;
  /** 更宽容器（工作台、提交页） */
  wide?: boolean;
  /** 标题区居中（答疑页） */
  centeredHeader?: boolean;
  /** 不渲染页内大标题（表单页自带标题时） */
  hideTitle?: boolean;
};

export function StudentPageShell({
  breadcrumb,
  title,
  description,
  children,
  wide = false,
  centeredHeader = false,
  hideTitle = false,
}: StudentPageShellProps) {
  return (
    <div className={`student-page mx-auto px-4 py-4 sm:px-6 sm:py-6 ${wide ? "max-w-5xl" : "max-w-4xl"}`}>
      <div className="student-page-card sysu-card">
        <nav className="student-breadcrumb" aria-label="面包屑">
          <Link href="/student" className="student-breadcrumb-home" aria-label="学生首页">
            <HomeIcon />
          </Link>
          <span className="student-breadcrumb-sep">/</span>
          <span>学生端</span>
          <span className="student-breadcrumb-sep">/</span>
          <span className="student-breadcrumb-current">{breadcrumb}</span>
        </nav>

        {!hideTitle && title ? (
          <header className={`student-page-header ${centeredHeader ? "is-centered" : ""}`}>
            {centeredHeader ? (
              <div className="student-qa-hero-icon" aria-hidden>
                <ShieldAiIcon />
              </div>
            ) : null}
            <h1 className="student-page-title">{title}</h1>
            <span className="student-page-title-accent" aria-hidden />
            {description ? <p className="student-page-desc">{description}</p> : null}
          </header>
        ) : null}

        <div className="student-page-body">{children}</div>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 10.5 10 4l7 6.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1v-5.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldAiIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        d="M24 4 8 10v10c0 9 6.5 15.5 16 18 9.5-2.5 16-9 16-18V10L24 4Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="rgba(0,94,39,0.08)"
      />
      <text x="24" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">
        AI
      </text>
    </svg>
  );
}
