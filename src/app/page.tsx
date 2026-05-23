"use client";

import Link from "next/link";

export default function StartPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-8">
        <div className="sysu-card bg-white/90 p-8 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">SYSU • 创新项目</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            大创报销流程，从这里开始更清晰
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            以学院风控标准为基线，整合材料提交、AI 预审与规则校验，形成简洁可靠的报销入口。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link
              href="/home"
              className="border border-slate-900 bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
            >
              进入系统
            </Link>
            <span className="h-2 w-2 border border-slate-300 bg-white" aria-hidden />
            <Link
              href="/submit"
              className="border border-slate-200 bg-white px-4 py-2 text-slate-900 transition hover:bg-slate-50"
            >
              直接提交
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
