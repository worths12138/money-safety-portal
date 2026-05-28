export type PortalNavItem = {
  href: string;
  label: string;
  match: string;
  shortLabel: string;
  /** 为 true 时仅 pathname 完全等于 match 才高亮 */
  exactOnly?: boolean;
};

export const studentNavItems: PortalNavItem[] = [
  { href: "/student", label: "学生首页", match: "/student", shortLabel: "首", exactOnly: true },
  { href: "/student/preaudit", label: "提交申报", match: "/student/preaudit", shortLabel: "报" },
  { href: "/student/qa", label: "合规答疑", match: "/student/qa", shortLabel: "答" },
  { href: "/student/status", label: "进度查询", match: "/student/status", shortLabel: "查" },
];

export const teacherNavItems: PortalNavItem[] = [
  { href: "/teacher/dashboard", label: "数据看板", match: "/teacher/dashboard", shortLabel: "板" },
  { href: "/teacher/queue", label: "复核队列", match: "/teacher/queue", shortLabel: "队" },
  { href: "/teacher/rules", label: "规则配置", match: "/teacher/rules", shortLabel: "规" },
];

export type PortalRole = "entry" | "student" | "teacher" | "legacy";

export type SessionPortalRole = "student" | "teacher" | null;

export function isReportPath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith("/report") || pathname?.includes("/report/"));
}

export function isPortalLoginPath(pathname: string | null): boolean {
  return pathname === "/student/login" || pathname === "/teacher/login";
}

/** 登录页与首页统一为 entry，避免登录页顶栏出现「复核队列」且校徽误进工作台 */
export function resolvePortalRole(pathname: string | null): PortalRole {
  if (!pathname) return "legacy";
  if (pathname === "/" || isPortalLoginPath(pathname)) return "entry";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student")) return "student";
  return "legacy";
}

/** 旧路径 /report/:id 按登录身份回落到学生/教师顶栏 */
export function resolveEffectivePortalRole(
  pathname: string | null,
  sessionRole?: SessionPortalRole,
): PortalRole {
  const base = resolvePortalRole(pathname);
  if (base !== "legacy") return base;
  if (!pathname?.startsWith("/report")) return base;
  if (sessionRole === "student") return "student";
  if (sessionRole === "teacher") return "teacher";
  return "legacy";
}

export function navItemsForRole(role: PortalRole): PortalNavItem[] {
  if (role === "student") return studentNavItems;
  if (role === "teacher") return teacherNavItems;
  if (role === "entry") return [];
  return legacyNavItems;
}

/** 遗留全站导航（仅 NEXT_PUBLIC_ENABLE_LEGACY_PORTAL=true 时可访问） */
export const legacyNavItems: PortalNavItem[] = [
  { href: "/home", label: "首页", match: "/home", shortLabel: "首" },
  { href: "/preaudit", label: "AI 风控预审", match: "/preaudit", shortLabel: "审" },
  { href: "/report/2026-041", label: "风控报告", match: "/report", shortLabel: "报" },
  { href: "/admin", label: "管理后台", match: "/admin", shortLabel: "管" },
  { href: "/admin/rules", label: "规则配置", match: "/admin/rules", shortLabel: "规" },
];

export function resolveActiveNavMatch(pathname: string, items: PortalNavItem[]): string | null {
  const matches = items
    .filter((item) => {
      if (item.exactOnly) return pathname === item.match;
      return (
        pathname === item.match ||
        (item.match !== "/" && pathname.startsWith(`${item.match}/`))
      );
    })
    .sort((a, b) => b.match.length - a.match.length);
  return matches[0]?.match ?? null;
}

export function brandHrefForRole(role: PortalRole, pathname?: string | null): string {
  /** 风控报告页校徽统一回到身份选择 */
  if (isReportPath(pathname ?? null)) return "/";
  if (role === "student") return "/student";
  if (role === "teacher") return "/teacher/queue";
  /** 首页校徽：身份选择；未登录用户再点右上角进入各端登录 */
  if (role === "entry") return "/";
  return "/home";
}

/** 首页 / 顶栏：直达各端登录（教师左、学生右，与身份选择页一致） */
export const entryPortalHeaderLinks = [
  { href: "/teacher/login", label: "教师端" },
  { href: "/student/login", label: "学生端" },
] as const;

export function switchPortalLink(role: PortalRole): { href: string; label: string } | null {
  if (role === "student") return { href: "/teacher/login", label: "教师端" };
  if (role === "teacher") return { href: "/student/login", label: "学生端" };
  return null;
}
