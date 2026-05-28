import { StudentQaPanel } from "@/components/StudentQaPanel";
import { StudentPageShell } from "@/components/student/StudentPageShell";

export const metadata = {
  title: "AI 合规问答 | 学生端",
  description: "基于审盾 RAG 报销规则库的智能答疑。",
};

export default function StudentQaPage() {
  return (
    <StudentPageShell
      breadcrumb="AI问答"
      title="AI 合规问答"
      description="基于学校财务制度与相关规定，为你解答报销与合规方面的问题。"
      centeredHeader
    >
      <StudentQaPanel />
    </StudentPageShell>
  );
}
