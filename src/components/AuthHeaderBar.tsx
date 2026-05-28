"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionProfile } from "@/lib/auth/types";

export function AuthHeaderBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [authEnabled, setAuthEnabled] = useState(false);

  const isPortal =
    pathname?.startsWith("/student") || pathname?.startsWith("/teacher");
  const isLoginPage = pathname === "/student/login" || pathname === "/teacher/login";

  useEffect(() => {
    if (!isPortal || isLoginPage) return;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { authEnabled?: boolean; profile?: SessionProfile | null }) => {
        setAuthEnabled(Boolean(data.authEnabled));
        setProfile(data.profile ?? null);
      })
      .catch(() => {
        setAuthEnabled(false);
        setProfile(null);
      });
  }, [isPortal, isLoginPage, pathname]);

  if (!isPortal || isLoginPage || !authEnabled) {
    return null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    const loginPath = pathname?.startsWith("/teacher") ? "/teacher/login" : "/student/login";
    router.push(loginPath);
    router.refresh();
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white/90 px-4 py-2 text-sm">
      <span className="text-slate-600">
        {profile ? (
          <>
            已登录：<span className="font-semibold text-slate-900">{profile.displayName}</span>
            <span className="ml-2 text-slate-400">({profile.loginName})</span>
          </>
        ) : (
          <span className="text-amber-800">未登录</span>
        )}
      </span>
      <div className="flex gap-2">
        {!profile ? (
          <Link
            href={pathname?.startsWith("/teacher") ? "/teacher/login" : "/student/login"}
            className="rounded border border-slate-900 px-3 py-1 text-xs font-semibold text-slate-900"
          >
            登录
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            退出
          </button>
        )}
      </div>
    </div>
  );
}
