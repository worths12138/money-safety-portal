/** 是否开放遗留演示路径（/home、/preaudit、/admin 等）。生产默认关闭。 */
export function isLegacyPortalEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_LEGACY_PORTAL === "true";
}

/** 旧版全站导航路径（不含 /student/*、/teacher/* 门户） */
export function isLegacyPortalPath(pathname: string): boolean {
  if (pathname.startsWith("/student/") || pathname.startsWith("/teacher/")) return false;
  if (pathname === "/home") return true;
  if (pathname === "/preaudit" || pathname === "/submit" || pathname === "/audit") return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/report/")) return true;
  return false;
}
