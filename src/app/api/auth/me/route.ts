import { NextResponse } from "next/server";
import { isAuthEnabled } from "@/lib/auth/config";
import { getSessionProfile } from "@/lib/auth/session";

export async function GET() {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, authEnabled: false, profile: null });
  }

  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ ok: true, authEnabled: true, profile: null });
  }

  return NextResponse.json({ ok: true, authEnabled: true, profile });
}
