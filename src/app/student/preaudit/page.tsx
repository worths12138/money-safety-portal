import { AiPreauditForm } from "@/components/AiPreauditForm";
import { StudentPageShell } from "@/components/student/StudentPageShell";

export const metadata = {
  title: "提交申报 | 学生端",
  description: "学生提交大创报销合规申报与凭证。",
};

export default function StudentPreauditPage() {
  return (
    <StudentPageShell breadcrumb="提交申报" wide hideTitle>
      <AiPreauditForm portal="student" />
    </StudentPageShell>
  );
}
