# 审盾 RAG 报销规则库

## 数据文件

| 路径 | 说明 |
|------|------|
| `data/reimbursement-rag-rules.json` | 结构化规则库（14 条，R001–R014） |
| `data/extracted_rules_raw.txt` | 可选：原始制度摘录，供人工扩库参考（不参与运行时检索） |

更新规则时：编辑 JSON 后重启 Next.js 进程（开发环境热重载可能缓存，生产需 `pm2 restart`）。

## 召回方式

轻量 **关键词匹配**（见 `src/lib/rag/retrieve.ts`），与《RAG库发送教程与注意事项》一致。  
每次最多注入 **8 条**命中规则到教师 Agent Prompt，避免撑爆上下文。

## 功能入口

| 场景 | 路径 / 模块 |
|------|-------------|
| 学生合规答疑 | `/student/qa` → `POST /api/student/qa` |
| 教师 AI 初审 | `/api/agent/review` → `buildRagAuditContext` + 多模态审核 |

## 环境变量

```env
ZHIPU_API_KEY=...          # 必填
ZHIPU_QA_MODEL=glm-4-flash # 可选，学生答疑用文本模型，默认 glm-4-flash
```

## 验证

1. 学生登录 → `/student/qa` → 提问「发票抬头」应命中 R001。  
2. 教师端对含「API」「发票」等关键词的申报点 **AI 初审**，报告风险段应能体现 rule_id。

## 扩库

在 `rules` 数组追加对象，保持字段：`rule_id`, `category`, `keywords`, `rule_content`, `source`, `risk_level`, `risk_tags`, `suggestion`。
