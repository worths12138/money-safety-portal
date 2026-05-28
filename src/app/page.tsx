"use client";

import Link from "next/link";

export default function StartPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-8">
        <div className="sysu-card bg-white/90 p-8 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">SYSU • 金融合规 · 风控</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            大创报销经费合规风控平台
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            学生提交申报与凭证；指导教师发起 AI 初审并完成复核。请选择您的身份进入对应工作台。
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link
              href="/student/login"
              className="block border border-slate-900 bg-slate-900 px-6 py-5 text-white transition hover:bg-slate-800"
            >
              <p className="text-lg font-semibold">我是学生</p>
              <p className="mt-2 text-sm text-slate-200">登录后提交申报、上传凭证、查询复核进度</p>
            </Link>
            <Link
              href="/teacher/login"
              className="block border border-slate-200 bg-white px-6 py-5 transition hover:bg-slate-50"
            >
              <p className="text-lg font-semibold text-slate-950">我是指导老师</p>
              <p className="mt-2 text-sm text-slate-600">登录后复核队列、AI 初审、通过或驳回</p>
            </Link>
          </div>
          <p className="mt-8 text-center text-xs text-slate-500">
            <Link href="/home" className="underline hover:text-slate-700">
              进入原完整导航（演示/开发）
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
