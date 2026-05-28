# 登录与演示账号

## 1. Supabase 配置

1. Dashboard → **Project Settings → API** 复制 **anon public** key 到 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_key
```

2. SQL Editor 依次执行：

- `supabase/schema.sql`
- `supabase/compliance_rules_migration.sql`
- `supabase/auth_profiles_migration.sql`

3. Authentication → Providers → **Email** 保持开启（无需真实邮箱验证，种子脚本会 `email_confirm: true`）。

## 2. 创建演示账号

在项目根目录（已配置 `.env.local`）：

```bash
npm run seed:users
```

默认密码：`MspDemo2026!`（可用 `DEMO_AUTH_PASSWORD` 覆盖）

| 账号 | 角色 | 登录入口 |
|------|------|----------|
| teacher1 | 教师 | `/teacher/login` |
| student1～student5 | 学生 | `/student/login` |

邮箱格式（内部）：`login_name@msp.demo`，登录页只需填 **student1** / **teacher1**。

## 3. 规则说明

- 配置 **anon key** 后，`/student/*`、`/teacher/*` 需登录（`/login` 除外）。
- 学生仅可提交申报、查看**本人**报告；每账号最多 **10** 条申报，超出自动删最早记录。
- 教师可查看全部队列、**AI 初审**、通过/驳回；AI 初审默认每日 **30** 次（`TEACHER_AGENT_DAILY_LIMIT`）。
- 未配置 anon key 时保持旧行为（开放访问），便于本地调试。

## 4. 部署后

服务器 `.env.local` 增加 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，执行一次 `npm run seed:users`，重启 PM2。
