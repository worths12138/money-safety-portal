# 审盾 RAG 报销规则库

## 数据文件

| 路径 | 说明 |
|------|------|
| `data/reimbursement-rag-rules.json` | 结构化规则库 **v1.3**（14 条：R001–R005、R007–R012、R014–R016） |
| `docs/rag/CHANGELOG_v1.3.md` | v1.3 变更说明 |
| `data/extracted_rules_raw.txt` | 可选：原始制度摘录，供人工扩库参考（不参与运行时检索） |

更新规则时：编辑 JSON 后重启 Next.js 进程（开发环境热重载可能缓存，生产需 `pm2 restart`）。

## 召回方式

轻量 **关键词匹配**（见 `src/lib/rag/retrieve.ts`），与《RAG库发送教程与注意事项》一致。  
每次最多注入 **8 条**命中规则到教师 Agent Prompt，避免撑爆上下文。  
若同时命中 R005（按量 API）与 R014（包月会员），Prompt 会附带 `meta.conflict_handling` 指引。

## 功能入口

| 场景 | 路径 / 模块 |
|------|-------------|
| 学生合规答疑 | `/student/qa` → `POST /api/student/qa` |
| 教师 AI 初审 | `/api/agent/review` → `buildRagAuditContext` + 多模态审核 |

## 环境变量

```env
ZHIPU_API_KEY=...          # 必填
ZHIPU_QA_MODEL=glm-4-flash # 可选，学生答疑用文本模型，默认 glm-4-flash

# 凭证与初审（可选）
MAX_MATERIAL_FILES=10              # 单次最多凭证数，默认 10
MAX_MULTIMODAL_IMAGES_PER_CALL=3   # 主审附图张数，默认 3（智能挑选）
IMAGE_EXTRACT_CONCURRENCY=3        # 其余凭据并行 OCR 并发
AGENT_REVIEW_TIMEOUT_MS=300000     # 初审总超时，默认 5 分钟
ZHIPU_EXTRACT_MODEL=glm-4-flash    # 可选，仅用于「溢出」凭据金额识图
MATERIAL_CACHE_TTL_SEC=86400       # 凭证内存暂存，演示建议 24h
```

## 验证

1. 学生登录 → `/student/qa` → 提问「发票抬头」应命中 R001。  
2. 教师端对含「API」「发票」等关键词的申报点 **AI 初审**，报告风险段应能体现 rule_id。

## 扩库

在 `rules` 数组追加对象，保持字段：`rule_id`, `category`, `keywords`, `rule_content`, `source`, `risk_level`, `risk_tags`, `suggestion`。
