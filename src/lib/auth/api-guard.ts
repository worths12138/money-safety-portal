import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionProfile } from "@/lib/auth/session";
import type { SessionProfile } from "@/lib/auth/types";

export async function getTeacherIfAuth(): Promise<SessionProfile | null> {
  if (!isAuthEnabled()) return null;
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "teacher") return null;
  return profile;
}

export async function getStudentIfAuth(): Promise<SessionProfile | null> {
  if (!isAuthEnabled()) return null;
  const profile = await getSessionProfile();
  if (!profile || profile.role !== "student") return null;
  return profile;
}
