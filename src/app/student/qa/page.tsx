import { StudentQaPanel } from "@/components/StudentQaPanel";

export const metadata = {
  title: "合规答疑 | 学生端",
  description: "基于审盾 RAG 报销规则库的智能答疑。",
};

export default function StudentQaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="sysu-card bg-white/95 p-8 backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">学生端 · RAG</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">报销合规答疑</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          根据学院真实制度整理的规则库自动召回相关条款，由 AI 生成简要说明。不替代教师终审，也不生成正式风控报告。
        </p>
        <div className="mt-8">
          <StudentQaPanel />
        </div>
      </div>
    </div>
  );
}
