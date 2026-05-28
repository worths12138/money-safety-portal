import { Suspense } from "react";
import { PortalLoginForm } from "@/components/PortalLoginForm";

export const metadata = {
  title: "教师登录 | 大创报销合规风控",
};

function TeacherLoginInner() {
  return (
    <PortalLoginForm
      role="teacher"
      title="教师登录"
      subtitle="演示账号 teacher1；负责 AI 初审与通过/驳回，每日 AI 初审次数受配额限制。"
      defaultLoginName="teacher1"
      defaultNext="/teacher/dashboard"
      otherPortal={{ href: "/student/login", label: "前往学生端登录" }}
    />
  );
}

export default function TeacherLoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">加载中…</p>}>
      <TeacherLoginInner />
    </Suspense>
  );
}
