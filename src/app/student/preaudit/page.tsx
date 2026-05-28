import { AiPreauditForm } from "@/components/AiPreauditForm";

export const metadata = {
  title: "提交申报 | 学生端",
  description: "学生提交大创报销合规申报与凭证。",
};

export default function StudentPreauditPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6 sm:py-4">
      <section className="sysu-card bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <AiPreauditForm portal="student" />
      </section>
    </div>
  );
}
