import { isAuthEnabled } from "@/lib/auth/config";
import { requireSessionProfile } from "@/lib/auth/session";
import type { SessionProfile } from "@/lib/auth/types";

export async function getTeacherIfAuth(): Promise<SessionProfile | null> {
  if (!isAuthEnabled()) return null;
  return requireSessionProfile("teacher");
}

export async function getStudentIfAuth(): Promise<SessionProfile | null> {
  if (!isAuthEnabled()) return null;
  return requireSessionProfile("student");
}
