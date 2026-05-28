"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { UserRole } from "@/lib/auth/types";

type PortalLoginFormProps = {
  role: UserRole;
  title: string;
  subtitle: string;
  defaultNext: string;
  otherPortal: { href: string; label: string };
};

export function PortalLoginForm({ role, title, subtitle, defaultNext, otherPortal }: PortalLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get("next") || defaultNext;
  const roleError = searchParams.get("error") === "role";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginName, password, role }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "登录失败");
      }

      // 整页跳转，确保登录 Cookie 生效（避免 router 客户端导航时中间件仍读旧会话）
      window.location.assign(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:px-6">
      <div className="sysu-card bg-white/95 p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {role === "student" ? "学生端登录" : "教师端登录"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

        {roleError ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            当前账号与入口不匹配：请用右上角「教师端 / 学生端」进入对应登录页，或先退出已登录账号后再试。
            {role === "teacher" ? " 教师账号请使用 teacher1。" : " 学生账号请使用 student1。"}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">账号</span>
            <input
              className="mt-1 w-full border border-slate-200 px-3 py-2 text-sm"
              placeholder={role === "student" ? "student1" : "teacher1"}
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">密码</span>
            <input
              type="password"
              className="mt-1 w-full border border-slate-200 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full border border-slate-900 bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href={otherPortal.href} className="font-semibold underline">
            {otherPortal.label}
          </Link>
          {" · "}
          <Link href="/" className="underline">
            返回身份选择
          </Link>
        </p>
      </div>
    </div>
  );
}
