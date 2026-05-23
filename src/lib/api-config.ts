import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export function ensureSupabaseConfigured() {
  if (isSupabaseConfigured()) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      message: "后端未配置：请复制 .env.local.example 为 .env.local，填入 Supabase URL 与 Service Role Key 后重启开发服务。",
    },
    { status: 503 },
  );
}
