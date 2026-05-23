"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/home", label: "首页", match: "/home", shortLabel: "首" },
  { href: "/submit", label: "合规申报", match: "/submit", shortLabel: "申" },
  { href: "/report/2026-041", label: "风控报告", match: "/report", shortLabel: "报" },
  { href: "/admin", label: "管理后台", match: "/admin", shortLabel: "管" },
  { href: "/admin/rules", label: "规则配置", match: "/admin/rules", shortLabel: "规" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStart = pathname === "/";
  const backgroundImage = useMemo(() => {
    if (isStart) return "/api/photos/start";
    if (!pathname) return "/api/photos/home";
    if (pathname.startsWith("/admin/rules")) return "/api/photos/rules";
    if (pathname.startsWith("/admin")) return "/api/photos/admin";
    if (pathname.startsWith("/report")) return "/api/photos/report";
    if (pathname.startsWith("/submit")) return "/api/photos/submit";
    return "/api/photos/home";
  }, [isStart, pathname]);
  const decorations = useMemo(
    () =>
      [
        { size: 55, top: "19%", right: "74px", opacity: 0.16 },
        { size: 68, top: "65%", right: "70px", opacity: 0.2 },
        { size: 81, top: "53%", right: "84px", opacity: 0.24 },
      ],
    [],
  );
  return (
    <div className="site-shell-root relative h-screen overflow-hidden text-slate-900">
      <div className="site-shell-bg pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center blur-sm brightness-90"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className={`absolute inset-0 ${isStart ? "bg-slate-900/25" : "bg-slate-900/10"}`} />
      </div>

      <div className="site-shell-scroll relative z-10 h-screen overflow-y-auto scroll-smooth">
        <header className="site-header no-print sticky top-0 z-[100] backdrop-blur">
          <div className="relative z-[2] flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="site-header-brand relative z-[3] flex min-w-0 items-center gap-4">
              <Link href="/home" className="site-header-logo relative z-[4] shrink-0" title="中山大学">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sysu-logo-nav.png?v=2"
                  alt="中山大学 SUN YAT-SEN UNIVERSITY"
                  className="site-header-logo-img h-10 w-auto max-w-[min(18rem,46vw)] object-contain object-left"
                />
              </Link>
              <div className="min-w-0 border-l border-white/25 pl-3 sm:pl-4">
                <p className="site-header-brand-sub text-xs font-semibold uppercase tracking-[0.24em]">
                  软件工程学院
                </p>
                <p className="site-header-brand-title text-sm font-semibold">经费合规风控平台</p>
              </div>
            </div>

            <nav className="site-header-nav hidden items-center gap-0 md:flex">
              {navItems.map((item) => {
                const active = pathname === item.match || (item.match !== "/" && pathname.startsWith(item.match));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`site-header-nav-link rounded-sm ${active ? "is-active" : ""}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <section className="site-shell-main-wrap relative mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 print:max-w-none print:px-0 print:pb-0 print:pt-0">
          <div className="site-shell-decor pointer-events-none absolute inset-0">
            {!isStart &&
              decorations.map((item, index) => (
              <span
                key={`dot-${index}`}
                className="absolute rounded-[24px] bg-white/70"
                style={{
                  top: item.top,
                  right: item.right,
                  width: `${item.size}px`,
                  height: `${item.size}px`,
                  opacity: item.opacity,
                }}
              />
              ))}
          </div>
          <main className="relative flex-1 pb-10">{children}</main>
          <footer className="no-print relative mb-2 flex flex-col gap-2 border-t border-slate-200 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>保留 /api/submit、/api/reports、/api/agent/review、/api/rules 接口占位，方便后端对接。</p>
            <p>面向科研经费支出的合规与风控场景，支持 Agent 预审、可解释风险项与人工复核闭环。</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
