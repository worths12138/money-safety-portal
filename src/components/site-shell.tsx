"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { AuthHeaderBar } from "@/components/AuthHeaderBar";
import {
  brandHrefForRole,
  entryPortalHeaderLinks,
  navItemsForRole,
  resolveActiveNavMatch,
  resolvePortalRole,
  switchPortalLink,
} from "@/lib/portal-nav";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portalRole = useMemo(() => resolvePortalRole(pathname), [pathname]);
  const navItems = useMemo(() => navItemsForRole(portalRole), [portalRole]);
  const activeNavMatch = useMemo(
    () => (pathname ? resolveActiveNavMatch(pathname, navItems) : null),
    [pathname, navItems],
  );
  const brandHref = brandHrefForRole(portalRole);
  const switchLink = switchPortalLink(portalRole);
  const isStart = pathname === "/";
  const backgroundImage = useMemo(() => {
    if (isStart) return "/api/photos/start";
    if (!pathname) return "/api/photos/home";
    if (pathname.startsWith("/teacher")) return "/api/photos/admin";
    if (pathname.startsWith("/student")) return "/api/photos/submit";
    if (pathname.startsWith("/admin/rules")) return "/api/photos/last";
    if (pathname.startsWith("/admin")) return "/api/photos/admin";
    if (pathname.startsWith("/report")) return "/api/photos/report";
    if (pathname.startsWith("/preaudit") || pathname.startsWith("/submit") || pathname.startsWith("/audit")) {
      return "/api/photos/submit";
    }
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

  const footerText =
    portalRole === "student"
      ? {
          a: "学生端：提交申报与进度查询；正式风控报告由教师端 AI 初审后生成。",
          b: "图片自动压缩上传，减轻服务器压力。",
        }
      : portalRole === "teacher"
        ? {
            a: "教师端：复核队列、AI 初审、通过/驳回与规则配置。",
            b: "金融合规风控：规则引擎 + 多模态 Agent + 人工终审闭环。",
          }
        : {
            a: "AI 风控预审：申报总金额、凭据识图、金额一致性校验与风控报告一体化。",
            b: "支持 PDF/图片解析、运营台复核与规则配置；合规风控风险分越高表示风险越大。",
          };

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
            <div className="site-header-brand relative z-[3] flex min-w-0 items-center gap-2 sm:gap-3">
              <Link
                href={brandHref}
                className="site-header-logo relative z-[4] shrink-0"
                title={portalRole === "entry" ? "返回身份选择（登录入口在右上角）" : "返回工作台首页"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sysu-logo-nav.png?v=2"
                  alt="中山大学 SUN YAT-SEN UNIVERSITY"
                  className="site-header-logo-img h-10 w-auto max-w-[min(18rem,46vw)] object-contain object-left"
                />
              </Link>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/photos/brand" alt="审盾" className="site-header-brand-icon" />
              <div className="min-w-0 border-l border-white/25 pl-2 sm:pl-3">
                <p className="site-header-brand-sub text-xs font-semibold uppercase tracking-[0.24em]">
                  软件工程学院
                </p>
                <p className="site-header-brand-title text-sm font-semibold">
                  {portalRole === "student"
                    ? "学生端 · 报销合规申报"
                    : portalRole === "teacher"
                      ? "教师端 · 合规风控复核"
                      : "大创报销经费合规风控平台"}
                </p>
              </div>
            </div>

            <nav className="site-header-nav flex items-center gap-0">
              <div className="hidden items-center gap-0 md:flex">
                {navItems.map((item) => {
                  const active = item.match === activeNavMatch;
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
                {switchLink ? (
                  <Link
                    href={switchLink.href}
                    className="site-header-nav-link ml-2 rounded-sm border border-white/30"
                  >
                    {switchLink.label}
                  </Link>
                ) : null}
              </div>
              {portalRole === "entry"
                ? entryPortalHeaderLinks.map((item) => (
                    <Link key={item.href} href={item.href} className="site-header-nav-link rounded-sm">
                      {item.label}
                    </Link>
                  ))
                : null}
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
          <main className="relative flex-1 pb-10">
            <AuthHeaderBar />
            {children}
          </main>
          <footer className="no-print relative mb-2 flex flex-col gap-2 border-t border-slate-200 py-5 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>{footerText.a}</p>
            <p>{footerText.b}</p>
          </footer>
        </section>
      </div>
    </div>
  );
}
