"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { UserRole } from "@/lib/auth/types";

type PortalLoginFormProps = {
  role: UserRole;
  title: string;
  subtitle: string;
  defaultNext: string;
  otherPortal: { href: string; label: string };
  defaultLoginName?: string;
};

export function PortalLoginForm({
  role,
  title,
  subtitle,
  defaultNext,
  otherPortal,
  defaultLoginName = "",
}: PortalLoginFormProps) {
  const searchParams = useSearchParams();
  const [loginName, setLoginName] = useState(defaultLoginName);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      window.location.assign(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal-login-shell">
      <div className="portal-login-card">
        <p className="portal-login-kicker">{role === "student" ? "学生端登录" : "教师端登录"}</p>
        <h1>{title}</h1>
        <p className="portal-login-subtitle">{subtitle}</p>

        {roleError ? (
          <div className="portal-login-warning" role="alert">
            <WarnIcon />
            <span>
              当前账号与入口不匹配：请用顶栏「教师端 / 学生端」进入对应登录页，或先退出已登录账号后再试。
              {role === "teacher" ? " 教师账号请使用 teacher1。" : " 学生账号请使用 student1。"}
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="portal-login-form">
          <label>
            <span>账号</span>
            <input
              placeholder={role === "student" ? "student1" : "teacher1"}
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>
          <label>
            <span>密码</span>
            <div className="portal-password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="border-0 bg-transparent p-0"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
              >
                <EyeIcon />
              </button>
            </div>
          </label>
          {error ? <p className="portal-login-error">{error}</p> : null}
          <button type="submit" disabled={loading} className="portal-login-button">
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <p className="portal-login-links">
          <Link href={otherPortal.href}>{otherPortal.label}</Link>
          <span>|</span>
          <Link href="/">返回身份选择</Link>
        </p>
      </div>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
      <path d="M10.3 4.3h3.4L21 19H3L10.3 4.3Z" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
