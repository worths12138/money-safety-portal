# Vercel 部署清单

将 [money-safety-portal](https://github.com/worths12138/money-safety-portal) 部署到 [Vercel Hobby（免费）](https://vercel.com/pricing) 的步骤与注意事项。

---

## 部署前准备

| 项 | 要求 |
|----|------|
| GitHub 仓库 | 代码已 push 到 GitHub |
| Supabase 项目 | 已执行 SQL 建表（见下文） |
| 智谱 API Key | [开放平台](https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys) 创建 |
| Vercel 账号 | 用 GitHub 登录 [vercel.com](https://vercel.com) |

---

## 一、Supabase（先做完再部署）

在 Supabase → **SQL Editor** 依次执行：

1. `supabase/schema.sql` — `submissions`、`audit_records`
2. `supabase/compliance_rules_migration.sql` — 规则表（教师端 `/teacher/rules`）

记下 **Project URL** 与 **service_role key**（Settings → API）。

---

## 二、导入 Vercel 项目

1. 打开 [Vercel Dashboard](https://vercel.com/dashboard) → **Add New… → Project**
2. 选择 GitHub 仓库 `money-safety-portal`
3. **Framework Preset**：Next.js（一般自动识别）
4. **Build Command**：`npm run build`（默认）
5. **Output Directory**：留空（Next.js 默认）
6. 先不要点 Deploy，先配环境变量（下一步）

---

## 三、环境变量（Settings → Environment Variables）

在 Vercel 项目里添加，**Production / Preview / Development 都勾选**：

| 变量名 | 必填 | 说明 | 暴露给浏览器？ |
|--------|------|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase Project URL | 是（`NEXT_PUBLIC_` 前缀） |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | Supabase **service_role** | **否**，仅服务端 |
| `ZHIPU_API_KEY` | 是 | 智谱 API Key | **否** |
| `ZHIPU_AUTH` | 否 | 默认 `bearer` | 否 |
| `ZHIPU_MODEL` | 否 | 默认 `glm-5v-turbo` | 否 |
| `PDF_EXTRACT_DISABLE_PYTHON` | **Vercel 建议 `1`** | 禁用 PyMuPDF，仅用 Node `unpdf` + 智谱 OCR | 否 |

> **不要**在 Vercel 里配置 `PDF_PYTHON`。Vercel Serverless **没有 Python 运行时**，`scripts/extract_pdf.py` 无法执行。

配置完成后点击 **Deploy**，等待构建完成。

---

## 四、部署后自检

访问 `https://你的项目.vercel.app`，按顺序检查：

| # | 检查项 | 预期 |
|---|--------|------|
| 1 | `/` | 身份选择页正常 |
| 2 | `/student/login` → `/student/preaudit` | 学生可提交（可无凭证，仅填字段） |
| 3 | `/student/status` | 可见刚提交的申报 |
| 4 | `/teacher/login` → `/teacher/queue` | 队列出现记录，可点 **AI 初审** |
| 5 | `/teacher/report/xxxxxx` | 报告可打开 |
| 6 | `/teacher/rules` | 规则可保存 |

若学生/教师端报 **503**，多半是 Supabase 环境变量未配或拼写错误。生产环境勿设置 `NEXT_PUBLIC_ENABLE_LEGACY_PORTAL`。

---

## 五、Vercel 免费档限制（重要）

### 1. Serverless 超时

代码里部分接口设置了较长 `maxDuration`（如 `/api/submissions` 为 300 秒），但 **Hobby 免费档函数执行时间上限约 10 秒**（以 [Vercel 文档](https://vercel.com/docs/functions/runtimes#max-duration) 为准）。

| 影响 | 说明 |
|------|------|
| 纯字段提交（无凭证） | 通常正常 |
| 多 PDF / 多图片 + 智谱多模态 | **容易超时**，表现为 504 或「请求超时」 |
| 缓解 | 升级 **Pro**、减少单次上传文件数、或把 AI 审核拆到独立长任务服务 |

### 2. 无 Python

| 本地 | Vercel |
|------|--------|
| PyMuPDF + `extract_pdf.py` | **不可用** |
| 建议 | 设 `PDF_EXTRACT_DISABLE_PYTHON=1`，走 `unpdf` + 智谱识图 |

### 3. 请求体大小

上传多份 base64 凭证时，可能触及 Serverless **请求体上限**（约 4.5MB）。凭证过多时可先减文件数量或体积。

### 4. 商用与额度

- **Hobby**：适合个人演示、课程、比赛答辩
- 正式商用、团队账号 → 考虑 **Pro**
- 带宽、构建次数、函数调用有月度额度，一般演示够用

---

## 六、自定义域名（可选）

Vercel 项目 → **Settings → Domains** → 添加域名并按提示配置 DNS。

---

## 七、后续更新

推送到 GitHub `main` 分支后，Vercel 会自动重新部署（默认开启）。

```bash
git push origin main
```

---

## 八、常见问题

**Q：部署成功但 AI 预审一直超时？**  
A：免费档 10s 限制 + 智谱多图串行调用。先试无凭证提交；要完整演示可升级 Pro 或本地 `npm run dev`。

**Q：PDF 在本地能解析，线上不行？**  
A：线上无 Python，设 `PDF_EXTRACT_DISABLE_PYTHON=1`；扫描版 PDF 依赖智谱 OCR，更慢。

**Q：`service_role` 要填 `NEXT_PUBLIC_` 吗？**  
A：**不要**。只填 `SUPABASE_SERVICE_ROLE_KEY`，且不要提交到 Git。

**Q：Supabase 要改 RLS 吗？**  
A：当前由 Next.js 服务端用 `service_role` 访问，浏览器不直连 Supabase，保持 schema 默认 RLS 即可。

---

## 相关链接

- [Vercel Pricing](https://vercel.com/pricing)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase Dashboard](https://supabase.com/dashboard)
- 本仓库 `.env.local.example` — 变量说明模板
