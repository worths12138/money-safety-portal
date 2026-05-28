/**
 * 创建演示账号：teacher1 + student1～student5
 * 用法：在项目根目录执行（需 .env.local 含 SUPABASE URL 与 service_role）
 *   npm run seed:users
 * 默认密码：环境变量 DEMO_AUTH_PASSWORD，未设置则为 MspDemo2026!
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_AUTH_PASSWORD || "MspDemo2026!";
const domain = "msp.demo";

if (!url || !serviceKey) {
  console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY（.env.local）");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const users = [
  { login_name: "teacher1", role: "teacher", display_name: "财务指导老师" },
  { login_name: "student1", role: "student", display_name: "学生甲" },
  { login_name: "student2", role: "student", display_name: "学生乙" },
  { login_name: "student3", role: "student", display_name: "学生丙" },
  { login_name: "student4", role: "student", display_name: "学生丁" },
  { login_name: "student5", role: "student", display_name: "学生戊" },
];

async function ensureUser({ login_name, role, display_name }) {
  const email = `${login_name}@${domain}`;

  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  let userId = listed.users.find((u) => u.email?.toLowerCase() === email)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`创建 Auth 用户: ${login_name} <${email}>`);
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) throw updateError;
    console.log(`已存在，更新密码: ${login_name}`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      role,
      login_name,
      display_name,
    },
    { onConflict: "id" },
  );

  if (profileError) throw profileError;
  console.log(`  → profiles: ${role} / ${display_name}`);
}

async function main() {
  console.log("种子账号写入中…");
  console.log(`统一演示密码: ${password}`);
  console.log("请先已在 Supabase SQL Editor 执行 supabase/auth_profiles_migration.sql\n");

  for (const u of users) {
    await ensureUser(u);
  }

  console.log("\n完成。学生: student1～student5 | 教师: teacher1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
