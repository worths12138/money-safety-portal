import { AiPreauditForm } from "@/components/AiPreauditForm";

export const metadata = {
  title: "AI 风控预审 | 大创报销经费合规风控平台",
  description: "合规申报、凭证多模态识图与风控报告生成一体化入口。",
};

export default function PreauditPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-2 sm:px-6 sm:py-4">
      <section className="sysu-card bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <AiPreauditForm />
      </section>
    </div>
  );
}
