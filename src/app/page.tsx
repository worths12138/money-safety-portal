"use client";

import Link from "next/link";

export default function StartPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-8">
        <div className="sysu-card bg-white/90 p-8 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">SYSU • 金融合规 · 风控</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            大创报销经费合规风控，从这里开始更可追溯
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            凭证识图、申报总金额校验、Agent 风控报告与运营复核一体，形成可追溯的大创报销风控入口。
          </p>
          <div className="mt-8">
            <Link
              href="/home"
              className="inline-block border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              进入系统
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
