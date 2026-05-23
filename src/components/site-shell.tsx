"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/home", label: "首页", match: "/home", shortLabel: "首" },
  { href: "/submit", label: "提交报销", match: "/submit", shortLabel: "提" },
  { href: "/report/2026-041", label: "审核报告", match: "/report", shortLabel: "审" },
  { href: "/admin", label: "管理后台", match: "/admin", shortLabel: "管" },
  { href: "/admin/rules", label: "规则配置", match: "/admin/rules", shortLabel: "规" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStart = pathname === "/";
  const backgroundImage = useMemo(() => {
    if (isStart) return "";
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
          className={`absolute inset-0 ${
            isStart ? "bg-[#e6edf6]" : "scale-105 bg-cover bg-center blur-sm brightness-90"
          }`}
          style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
        />
        <div className={`absolute inset-0 ${isStart ? "bg-white/20" : "bg-slate-900/10"}`} />
      </div>

      <div className="site-shell-scroll relative z-10 h-screen overflow-y-auto scroll-smooth">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex w-full flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white text-[#1f2a44] shadow-sm">
                <span className="text-sm font-bold">SE</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  中山大学 软件工程学院
                </p>
                <p className="text-sm font-semibold text-slate-900">大创报销平台</p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 md:flex">
              {navItems.map((item) => {
                const active = pathname === item.match || (item.match !== "/" && pathname.startsWith(item.match));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 transition ${
                      active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/submit"
                className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                立即提交
              </Link>
            </div>
          </div>
        </header>

        <section className="site-shell-main-wrap relative mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-6 print:max-w-none print:px-0 print:pb-0 print:pt-0">
          <div className="site-shell-decor pointer-events-none absolute inset-0">
            {decorations.map((item, index) => (
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
            <p>当前界面围绕中山大学软件工程学院大创报销流程设计，保留原有交互逻辑。</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
