import Link from "next/link";

export const metadata = {
  title: "学生端 | 大创报销合规风控",
  description: "学生提交报销申报、查询复核进度。",
};

export default function StudentHomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="sysu-card bg-white/95 p-8 backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">学生端 · 金融合规</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">报销申报与进度查询</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          上传凭证并提交申报入库；正式 AI 风控报告由指导教师在教师端发起初审后生成。本端不提供终审结论，以教师复核结果为准。
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/student/preaudit"
            className="block border border-slate-900 bg-slate-900 px-5 py-4 text-white transition hover:bg-slate-800"
          >
            <p className="text-lg font-semibold">提交申报</p>
            <p className="mt-2 text-sm text-slate-200">填写项目信息并上传 PDF / 图片凭证</p>
          </Link>
          <Link
            href="/student/qa"
            className="block border border-blue-200 bg-blue-50 px-5 py-4 transition hover:bg-blue-100/80"
          >
            <p className="text-lg font-semibold text-slate-900">合规答疑</p>
            <p className="mt-2 text-sm text-slate-600">RAG 规则库检索 + AI 简要解答（发票、API、类目等）</p>
          </Link>
          <Link
            href="/student/status"
            className="block border border-slate-200 bg-white px-5 py-4 transition hover:bg-slate-50 sm:col-span-2"
          >
            <p className="text-lg font-semibold text-slate-900">进度查询</p>
            <p className="mt-2 text-sm text-slate-500">输入报告编号查看 AI 初审与教师批复状态</p>
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          指导教师请使用{" "}
          <Link href="/teacher/queue" className="font-semibold text-slate-700 underline">
            教师端复核台
          </Link>
          。
        </p>
      </div>
    </div>
  );
}
