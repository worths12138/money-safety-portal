import { Suspense } from "react";
import { PortalLoginForm } from "@/components/PortalLoginForm";

export const metadata = {
  title: "学生登录 | 大创报销合规风控",
};

function StudentLoginInner() {
  return (
    <PortalLoginForm
      role="student"
      title="学生登录"
      subtitle="演示账号 student1～student5；每账号最多保留 10 条申报。"
      defaultNext="/student"
      otherPortal={{ href: "/teacher/login", label: "前往教师端登录" }}
    />
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">加载中…</p>}>
      <StudentLoginInner />
    </Suspense>
  );
}
