import { StudentQaPanel } from "@/components/StudentQaPanel";

export const metadata = {
  title: "合规答疑 | 学生端",
  description: "基于审盾 RAG 报销规则库的智能答疑。",
};

export default function StudentQaPage() {
  return (
    <div className="student-page-shell">
      <section className="student-glass-panel student-qa-panel">
        <div className="student-breadcrumb">
          <HomeMiniIcon />
          <span>学生端</span>
          <em>/</em>
          <span>AI问答</span>
        </div>
        <div className="student-page-heading">
          <span className="student-brand-shield student-brand-shield--small">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/photos/brand" alt="审盾 AI" />
          </span>
          <h1>AI 合规问答</h1>
          <strong>基于学校财务制度与相关规定，为你解答报销与合规方面的问题。</strong>
        </div>
        <StudentQaPanel />
      </section>
    </div>
  );
}

function HomeMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 11 8-7 8 7" />
      <path d="M6.5 10.5V20h4.2v-5h2.6v5h4.2v-9.5" />
    </svg>
  );
}
