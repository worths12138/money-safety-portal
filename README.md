# 大创报销经费合规风控平台

中山大学软件工程学院大创项目报销场景的 **合规申报、AI 风控预审、可解释报告与运营复核** 一体化门户（Next.js 16 + Supabase + 智谱 GLM-5V-Turbo）。

## 功能概览

### 页面与模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 启动页 | `/` | 平台入口 |
| 首页 | `/home` | 数据看板、快速入口、最近报告、功能概览 |
| AI 风控预审 | `/preaudit` | 填写申报信息（含**申报总金额**）、上传 PDF/图片凭证，提交后自动识图并生成报告 |
| 风控报告 | `/report/[id]` | 总体结论、合规风控风险分、金额风险立体饼图、风险表、导出 PDF、重新 Agent 评估 |
| 运营台 | `/admin` | 按低/中/高风险筛选队列，一键通过或驳回，查看审核记录 |
| 规则配置 | `/admin/rules` | 维护支出白名单、单笔上限、DDL、特殊凭证要求（写入 Supabase，并注入 Agent 审核） |

> `/submit`、`/audit` 已重定向到 `/preaudit`，日常以 **AI 风控预审** 为主入口。

### 凭证与金额

| 能力 | 说明 |
|------|------|
| PDF 本地解析 | PyMuPDF（优先）+ `unpdf` 提取文字；扫描页由 PyMuPDF 出图 + 智谱 OCR |
| 图片金额识图 | 发票/支付截图等逐张识别金额，汇总为凭据合计 |
| 申报 vs 凭据 | 自动比对**申报总金额**与凭据识别合计；不一致时告警、写入发现项并抬高风险分 |
| 异常金额校正 | 远超常规大创额度（如百万级、多输零）时自动提高风险分，报告页红条提示 |

### 风控报告

| 能力 | 说明 |
|------|------|
| 合规风控风险分 | 0–100，**分数越高风险越大**（&lt;40 低 / 40–69 中 / ≥70 高）；结合规则对 Agent 分数校正 |
| 金额风险饼图 | 合规 / 低 / 中 / 高风险金额占比（立体饼图 + 图例百分比） |
| 可解释风险表 | 支出项、金额、问题标签、风险说明与处理建议；支持按标签筛选 |
| Agent 报告 | 智谱 GLM-5V-Turbo 多模态审核，Markdown 解析入库；支持无凭证时的字段+规则文字审核 |

### 运营与数据

| 能力 | 说明 |
|------|------|
| 人工复核 | 通过/驳回写入 `audit_records`，队列状态同步更新 |
| 数据保留 | 申报队列与审核记录各最多 **50 条**，超出自动删除最早历史记录 |
| 凭证存储 | **不持久化**上传文件，仅处理 base64 并保存风控结论与文本摘要 |

## 技术栈

- [Next.js 16](https://nextjs.org)（App Router）
- [Supabase](https://supabase.com)（PostgreSQL + 服务端 `service_role`）
- 智谱 [GLM-5V-Turbo](https://docs.bigmodel.cn)（多模态审核）
- Python [PyMuPDF](https://pymupdf.readthedocs.io)（可选，PDF 文本提取）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量

复制示例并填写真实值：

```bash
cp .env.local.example .env.local
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 仅服务端使用，勿暴露到浏览器 |
| `ZHIPU_API_KEY` | 是 | 智谱 API Key |
| `ZHIPU_AUTH` | 否 | 默认 `bearer`；JWT 模式填 `jwt` |
| `ZHIPU_MODEL` | 否 | 默认 `glm-5v-turbo` |
| `PDF_PYTHON` | 否 | Python 可执行路径（Windows 常为 `python`） |
| `PDF_EXTRACT_DISABLE_PYTHON` | 否 | 设为 `1` 则禁用 PyMuPDF，仅用 unpdf |

### 3. 初始化数据库

在 Supabase SQL Editor 中依次执行：

1. `supabase/schema.sql` — 申报表、审核记录表
2. `supabase/compliance_rules_migration.sql` — 规则配置表（若使用规则页）

### 4.（推荐）安装 PyMuPDF

用于 PDF 文本层提取与扫描页渲染：

```bash
pip install -r requirements-pdf.txt
```

### 5. 启动开发服务

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

### 6. 生产构建

```bash
npm run build
npm start
```

## 主要 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/submissions` | POST | 提交预审（含凭证 base64） |
| `/api/agent/review` | POST | 重新 Agent 评估 |
| `/api/reports/[id]` | GET | 获取风控报告 |
| `/api/pdf/extract` | POST | 单份 PDF 文字/金额提取 |
| `/api/admin/queue` | GET | 运营队列 |
| `/api/admin/review` | POST | 通过/驳回 |
| `/api/rules` | GET/PUT | 合规规则 |

## 风控分说明

**合规风控风险分** 为 0–100：**分数越高，风险越大**，越需优先复核。

- &lt; 40：低风险  
- 40–69：中风险  
- ≥ 70：高风险  

系统会根据 **申报总金额异常**、**与凭据金额不一致** 等情况自动上调分数（不完全依赖模型输出）。

## 项目结构（节选）

```
src/
  app/
    preaudit/          # AI 风控预审
    report/[id]/       # 风控报告
    admin/             # 运营台、规则页
    api/               # 后端接口
  components/
    AiPreauditForm.tsx
    RiskAmountPieChart.tsx
  lib/
    agent-review.ts        # Agent 评估与回写
    material-audit.ts      # 凭证识图审核
    pdf-extract.ts         # PDF 解析
    voucher-image-amount.ts # 图片金额识别
    amount-reconciliation.ts # 申报 vs 凭据比对
    submission-retention.ts  # 运营台 50 条保留
supabase/
  schema.sql
scripts/
  extract_pdf.py       # PyMuPDF 脚本
```

## 注意事项

- 平台 **不存储** 上传的凭证文件，仅处理 base64 并写入风控结论。
- 智谱 API 有速率限制；多份 PDF/图片会串行调用，凭证较多时请耐心等待。
- 部署到 Vercel 等平台时，需配置环境变量；PyMuPDF 需在支持 Python 的运行环境或本地部署。
- 运营台删除最早记录后，对应 `/report/[id]` 链接将失效。

## 相关文档

- `AGENTS.md` — 本仓库 Next.js 开发约定（给 AI 助手）
- `.env.local.example` — 环境变量模板

## License

Private / 课程与比赛用途，按学院要求使用。
