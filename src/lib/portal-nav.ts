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
  { href: "/student/status", label: "进度查询", match: "/student/status", shortLabel: "查" },
];

export const teacherNavItems: PortalNavItem[] = [
  { href: "/teacher/queue", label: "复核队列", match: "/teacher/queue", shortLabel: "队" },
  { href: "/teacher/rules", label: "规则配置", match: "/teacher/rules", shortLabel: "规" },
];

export type PortalRole = "entry" | "student" | "teacher" | "legacy";

export function resolvePortalRole(pathname: string | null): PortalRole {
  if (!pathname) return "legacy";
  if (pathname === "/") return "entry";
  if (pathname.startsWith("/teacher")) return "teacher";
  if (pathname.startsWith("/student")) return "student";
  return "legacy";
}

export function navItemsForRole(role: PortalRole): PortalNavItem[] {
  if (role === "student") return studentNavItems;
  if (role === "teacher") return teacherNavItems;
  if (role === "entry") return [];
  return legacyNavItems;
}

/** 原全站导航（/home、/preaudit 等旧路径保留） */
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

export function brandHrefForRole(role: PortalRole): string {
  if (role === "student") return "/student";
  if (role === "teacher") return "/teacher/queue";
  if (role === "entry") return "/";
  return "/home";
}

export function switchPortalLink(role: PortalRole): { href: string; label: string } | null {
  if (role === "student") return { href: "/teacher/queue", label: "教师端" };
  if (role === "teacher") return { href: "/student", label: "学生端" };
  return null;
}
