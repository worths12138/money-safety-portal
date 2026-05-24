-- =============================================================================
-- 大创报销经费合规风控平台 — Supabase 建表脚本
-- 用法：Supabase Dashboard → SQL Editor → New query → 全选粘贴 → Run
--
-- 说明：
--   • 2 张表：submissions（申报/队列）、audit_records（审核记录）
--   • 不存登录、不存上传文件
--   • 已开启 RLS；请仅在 Next.js 服务端用 SUPABASE_SERVICE_ROLE_KEY 访问
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. submissions — 申报与运营台队列
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id text primary key,
  project_name text not null,
  project_period text not null default '',
  amount text not null default '',
  notes text,
  owner text not null default '软件工程学院 申报人',
  category text not null default '',
  risk_score integer not null default 0
    check (risk_score >= 0 and risk_score <= 100),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  summary text,
  conclusion text,
  risk_rows jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  ai_notes jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.submissions is '合规申报与运营台队列（不含凭证文件）';
comment on column public.submissions.status is 'pending=待审核, approved=通过, rejected=驳回';

create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_submitted_at_idx on public.submissions (submitted_at desc);
create index if not exists submissions_risk_score_idx on public.submissions (risk_score desc);

-- ---------------------------------------------------------------------------
-- 2. audit_records — 审核记录（每次通过/驳回插入一条，只增不改）
-- ---------------------------------------------------------------------------
create table if not exists public.audit_records (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references public.submissions (id) on delete restrict,
  project_name text not null,
  amount text,
  risk_score integer
    check (risk_score is null or (risk_score >= 0 and risk_score <= 100)),
  result text not null
    check (result in ('approved', 'rejected')),
  action text not null,
  actor_name text not null default '运营人员',
  comment text,
  created_at timestamptz not null default now()
);

comment on table public.audit_records is '运营台审核处置日志（含项目名、结果等快照）';
comment on column public.audit_records.result is 'approved=通过, rejected=驳回';

create index if not exists audit_records_submission_id_idx on public.audit_records (submission_id);
create index if not exists audit_records_created_at_idx on public.audit_records (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. updated_at 自动更新
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3b. compliance_rules — 学院可配置合规规则（规则页，驱动 Agent 与 /audit）
-- ---------------------------------------------------------------------------
create table if not exists public.compliance_rules (
  id text primary key default 'default',
  allowed_categories jsonb not null default '[]'::jsonb,
  amount_limit text not null default '',
  deadline text not null default '',
  special_materials jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

comment on table public.compliance_rules is '合规规则配置单例（id=default），供 /api/rules 与 Agent 审核读取';

drop trigger if exists compliance_rules_set_updated_at on public.compliance_rules;
create trigger compliance_rules_set_updated_at
  before update on public.compliance_rules
  for each row
  execute function public.set_updated_at();

insert into public.compliance_rules (
  id,
  allowed_categories,
  amount_limit,
  deadline,
  special_materials,
  updated_by
) values (
  'default',
  '["软件订阅", "设备采购", "差旅交通"]'::jsonb,
  '¥10,000',
  '2026-06-10 18:00',
  '["比价单", "签章清单", "会议纪要"]'::jsonb,
  '系统初始化'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security（仅服务端 service_role 可读写；anon 默认拒绝）
-- ---------------------------------------------------------------------------
alter table public.submissions enable row level security;
alter table public.audit_records enable row level security;
alter table public.compliance_rules enable row level security;

-- 不创建面向 anon / authenticated 的策略 → 浏览器直连无法读写
-- Next.js Route Handler 使用 service_role key 时会绕过 RLS

-- ---------------------------------------------------------------------------
-- 5. 可选：演示数据（与当前运营台示例一致，不需要可删本节）
-- ---------------------------------------------------------------------------
insert into public.submissions (
  id,
  project_name,
  project_period,
  amount,
  owner,
  category,
  risk_score,
  status,
  summary,
  conclusion,
  submitted_at
) values
  (
    '2026-041',
    '校园协同开发平台',
    '2026-03 - 2026-05',
    '¥4,860',
    '软件工程学院 张同学',
    '软件订阅',
    22,
    'pending',
    'Agent 预审为低风险，申报金额与支出用途匹配。',
    '建议通过，票据结构完整，仅有一项支付记录缺失，需补充后归档。',
    now() - interval '2 hours'
  ),
  (
    '2026-042',
    '智能代码评测系统',
    '2026-02 - 2026-04',
    '¥12,800',
    '软件工程学院 李同学',
    '设备采购',
    81,
    'pending',
    '涉及高金额设备采购，需补交比价单和审批说明。',
    '建议驳回，超过单项采购上限且缺少比价材料。',
    now() - interval '1 hour'
  ),
  (
    '2026-039',
    '移动端课题管理工具',
    '2026-01 - 2026-03',
    '¥3,200',
    '软件工程学院 王同学',
    '差旅交通',
    44,
    'approved',
    '中风险，材料基本齐全。',
    '建议通过，可归档。',
    now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into public.audit_records (
  id,
  submission_id,
  project_name,
  amount,
  risk_score,
  result,
  action,
  actor_name,
  created_at
) values
  (
    'a0000000-0000-4000-8000-000000000001',
    '2026-039',
    '移动端课题管理工具',
    '¥3,200',
    44,
    'approved',
    '一键通过',
    '财务老师',
    now() - interval '20 hours'
  )
on conflict (id) do nothing;
