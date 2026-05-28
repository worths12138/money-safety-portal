import { TeacherDashboardPanel } from "@/components/TeacherDashboardPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "数据看板 | 教师端",
  description: "待复核统计、风险队列预览与最近审核记录。",
};

export default function TeacherDashboardPage() {
  return <TeacherDashboardPanel />;
}
