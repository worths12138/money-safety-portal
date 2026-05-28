"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionProfile } from "@/lib/auth/types";

type TeacherWelcomeBarProps = {
  /** 简短说明，显示在欢迎语下方 */
  hint?: string;
};

export function TeacherWelcomeBar({
  hint = "欢迎使用中山大学合规风控平台，今日也要认真复核哦。",
}: TeacherWelcomeBarProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { profile?: SessionProfile | null }) => setProfile(data.profile ?? null))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/teacher/login");
    router.refresh();
  }

  const initial = profile?.displayName?.slice(0, 1) ?? "财";

  return (
    <section className="teacher-welcome-bar">
      <div className="teacher-welcome-inner">
        <span className="teacher-welcome-avatar" aria-hidden>
          {initial}
        </span>
        <div className="teacher-welcome-copy">
          <p className="teacher-welcome-title">
            {profile ? (
              <>
                已登录：{profile.displayName}
                <span className="teacher-welcome-login">（{profile.loginName}）</span>
              </>
            ) : (
              "已登录：财务指导老师"
            )}
            <span className="teacher-welcome-badge">教师</span>
          </p>
          <p className="teacher-welcome-hint">{hint}</p>
        </div>
        <div className="teacher-welcome-actions">
          <p className="teacher-welcome-clock" suppressHydrationWarning>
            {clock || "—"}
          </p>
          <button type="button" onClick={() => void logout()} className="teacher-welcome-logout">
            退出登录
          </button>
        </div>
      </div>
    </section>
  );
}
