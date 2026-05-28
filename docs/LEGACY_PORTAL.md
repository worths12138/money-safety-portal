# 遗留演示路径说明

正式环境只使用 **身份选择**（`/`）与 **学生端**（`/student/*`）、**教师端**（`/teacher/*`）。早期单页导航（`/home`、`/preaudit`、`/admin` 等）已与现网门户隔离。

## 默认行为

- 未设置 `NEXT_PUBLIC_ENABLE_LEGACY_PORTAL` 时，访问下列路径会 **重定向到 `/`**：
  - `/home`、`/preaudit`、`/submit`、`/audit`
  - `/admin`、`/admin/rules`
  - `/report/:id`（请改用 `/student/report/:id` 或 `/teacher/report/:id`）
- 身份选择页 **不显示**「进入原完整导航」链接。

## 本地调试旧版

在 `.env.local` 中：

```env
NEXT_PUBLIC_ENABLE_LEGACY_PORTAL=true
```

重启 `npm run dev` 后：

- 可直接打开 `/home`、`/preaudit`、`/admin` 等
- 身份选择页底部会出现开发入口

**生产 / 腾讯云 / Vercel 部署不要设置该变量。**

## 推荐路径对照

| 旧路径 | 现用路径 |
|--------|----------|
| `/home` | `/teacher/dashboard`（教师）或 `/student`（学生） |
| `/preaudit` | `/student/preaudit` |
| `/admin` | `/teacher/queue` |
| `/admin/rules` | `/teacher/rules` |
| `/report/:id` | `/student/report/:id` 或 `/teacher/report/:id` |

实现见 `src/lib/legacy-portal.ts` 与根目录 `middleware.ts`。
