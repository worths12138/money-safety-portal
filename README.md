# 审盾 · 大创报销经费合规风控平台

中山大学软件工程学院大创项目报销场景的 **合规申报、RAG 规则答疑、AI 风控预审、可解释报告与教师复核** 一体化门户。

技术栈：**Next.js 16**（App Router）+ **Supabase**（PostgreSQL + Auth）+ **智谱 GLM**（多模态审核 / 文本答疑）。

---

## 功能概览

### 门户与角色

| 入口 | 路径 | 说明 |
|------|------|------|
| 身份选择 | `/` | 学生 / 教师分流（审盾品牌首页） |
| 学生登录 | `/student/login` | Supabase 演示账号 `student1`～`student5` |
| 教师登录 | `/teacher/login` | 演示账号 `teacher1` |

**学生端**（顶栏：学生首页 · 提交申报 · 合规答疑 · 进度查询）

| 页面 | 路径 | 说明 |
|------|------|------|
| 工作台 | `/student` | 提交 / 答疑 / 进度快捷入口，报销流程与提交前检查 |
| 提交申报 | `/student/preaudit` | 填写项目信息、上传 PDF/图片（自动压缩，最多 10 份） |
| AI 合规问答 | `/student/qa` | 基于 **RAG 规则库 v1.3** 的关键词召回 + 智谱文本回答 |
| 进度查询 | `/student/status` | 按编号查报告、查看本人最近申报列表 |
| 学生报告 | `/student/report/[id]` | 查看 AI 初审与教师批复（需教师端先发起初审） |

**教师端**（顶栏：数据看板 · 复核队列 · 规则配置）

| 页面 | 路径 | 说明 |
|------|------|------|
| 数据看板 | `/teacher/dashboard` | 指标统计、队列预览、风控提示、最近审核 |
| 复核队列 | `/teacher/queue` | 筛选 / 通过 / 驳回，发起 **AI 初审** |
| 规则配置 | `/teacher/rules` | 白名单、上限、DDL 等（写入 Supabase，注入 Agent） |
| 风控报告 | `/report/[id]` | 与学生端共用：风险分、饼图、风险表、凭证查看 |

> **遗留演示路径**（完整旧导航）：`/home`、`/preaudit`、`/admin` 等仍可用，日常推荐走学生端 / 教师端。

### 核心能力

| 能力 | 说明 |
|------|------|
| **RAG 规则库** | `data/reimbursement-rag-rules.json`（v1.3，14 条制度规则 + 冲突处理指引），轻量关键词召回，注入 Agent 与学生答疑 |
| **多模态审核** | 智谱 GLM 多模态：≤3 张主审附图 + 溢出凭据并行 OCR；教师端发起初审 |
| **金额一致性** | 申报总金额 vs 凭据识图合计比对，异常抬高风险分 |
| **凭证暂存** | 内存暂存供教师查看与复审（`MATERIAL_CACHE_TTL_SEC` 可配，演示建议 24h） |
| **合规风控分** | 0–100，**越高风险越大**（&lt;40 低 / 40–69 中 / ≥70 高） |
| **人工复核** | 通过 / 驳回写入 `audit_records`，队列状态同步 |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量

```bash
cp .env.local.example .env.local
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 浏览器端登录 |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 仅服务端，勿暴露到浏览器 |
| `ZHIPU_API_KEY` | 是 | 智谱 API Key |
| `AUTO_AGENT_ON_SUBMIT` | 否 | 默认 `false`：学生提交仅入库，教师在教师端点「AI 初审」 |
| `MAX_MATERIAL_FILES` | 否 | 单次最多凭证数，默认 `10` |
| `MAX_MULTIMODAL_IMAGES_PER_CALL` | 否 | 主审附图张数，默认 `3` |
| `AGENT_REVIEW_TIMEOUT_MS` | 否 | 初审总超时，默认 `300000`（5 分钟） |
| `MATERIAL_CACHE_TTL_SEC` | 否 | 凭证内存暂存 TTL，演示可设 `86400` |
| `ZHIPU_QA_MODEL` | 否 | 学生答疑模型，默认 `glm-4-flash` |

完整说明见 [`.env.local.example`](.env.local.example)。

### 3. 初始化数据库

在 Supabase SQL Editor 中依次执行：

1. [`supabase/schema.sql`](supabase/schema.sql) — 申报表、审核记录
2. [`supabase/compliance_rules_migration.sql`](supabase/compliance_rules_migration.sql) — 可配置规则表
3. [`supabase/auth_profiles_migration.sql`](supabase/auth_profiles_migration.sql) — 用户角色（student / teacher）

创建演示账号：

```bash
npm run seed:users
```

（需已配置 `SUPABASE_SERVICE_ROLE_KEY`；密码见 `.env.local.example` 中 `DEMO_AUTH_PASSWORD`。）

### 4.（推荐）安装 PyMuPDF

用于 PDF 文本层提取与扫描页渲染：

```bash
pip install -r requirements-pdf.txt
```

### 5. 启动

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) → 选择身份 → 登录后使用对应端功能。

### 6. 生产构建

```bash
npm run build
npm start
```

腾讯云 + PM2 部署见 [`docs/DEPLOY_TENCENT_LIGHTHOUSE.md`](docs/DEPLOY_TENCENT_LIGHTHOUSE.md)。

---

## 主要 API（节选）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/submissions` | POST | 提交申报（默认 `runAgent: false`） |
| `/api/agent/review` | POST | 教师端 AI 初审 / 报告页重新评估 |
| `/api/student/qa` | POST | 学生 RAG 合规答疑 |
| `/api/student/submissions` | GET | 当前学生申报列表 |
| `/api/teacher/dashboard` | GET | 教师看板指标与队列预览 |
| `/api/reports/[id]` | GET | 风控报告 |
| `/api/reports/[id]/materials` | GET | 暂存凭证列表（教师 / 学生查看） |
| `/api/admin/review` | POST | 通过 / 驳回 |
| `/api/rules` | GET/PUT | 合规规则配置 |

---

## 项目结构（节选）

```
data/
  reimbursement-rag-rules.json   # RAG 规则库 v1.3
src/
  app/
    page.tsx                       # 身份选择首页
    student/                       # 学生端页面
    teacher/                       # 教师端页面
    report/[id]/                   # 风控报告（共用）
    api/                           # 后端接口
  components/
    PortalEntryHero.tsx            # 首页身份选择
    AiPreauditForm.tsx             # 提交申报表单
    StudentQaPanel.tsx             # 学生答疑
    student/StudentPageShell.tsx   # 学生页面包屑与标题区
  lib/
    rag/                           # 规则召回与 Prompt 注入
    agent-review.ts                # Agent 评估
    material-audit.ts              # 凭证识图审核
docs/
  RAG_SETUP.md                     # RAG 使用与扩库
  DEPLOY_TENCENT_LIGHTHOUSE.md     # 腾讯云部署
supabase/
  schema.sql
  auth_profiles_migration.sql
```

---

## 推荐演示流程

1. 打开 `/` → **我是学生** → `student1` 登录  
2. **提交申报**：上传发票 / 支付截图 → 提交入库  
3. **合规答疑**：提问「发票抬头」「API 材料」等，查看 RAG 命中规则  
4. 切换 **教师端** → `teacher1` 登录 → **复核队列** → 对申报点 **AI 初审**  
5. 学生端 **进度查询** → 打开报告，查看风险分与整改建议  
6. 教师 **通过 / 驳回**，学生端查看最终状态  

---

## 注意事项

- 生产环境建议 **`AUTO_AGENT_ON_SUBMIT=false`**，由教师在教师端触发 AI 初审，避免学生提交时长时间等待。  
- 上传凭证在服务端 **内存暂存**（非对象存储），重启进程或超时后需重新上传；正式环境可接 OSS。  
- 智谱 API 有速率与超时限制；凭证较多时请耐心等待或调大 `AGENT_REVIEW_TIMEOUT_MS`。  
- 国内服务器 `git pull` GitHub 可能失败，可参考部署文档使用镜像或本机 `git archive` 上传。  
- 运营数据默认各保留 **50 条** 历史（申报队列与审核记录），超出自动删除最早记录。  

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [`docs/RAG_SETUP.md`](docs/RAG_SETUP.md) | RAG 规则库、召回方式、环境变量 |
| [`docs/rag/CHANGELOG_v1.3.md`](docs/rag/CHANGELOG_v1.3.md) | 规则库 v1.3 变更说明 |
| [`docs/DEPLOY_TENCENT_LIGHTHOUSE.md`](docs/DEPLOY_TENCENT_LIGHTHOUSE.md) | 腾讯云轻量 + PM2 + Nginx |
| [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) | Vercel 部署清单 |
| [`AGENTS.md`](AGENTS.md) | Next.js 开发约定（给 AI 助手） |

---

## License

Private / 课程与比赛用途，按学院要求使用。
