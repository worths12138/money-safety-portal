-- 若项目已按旧版 schema 建库，在 Supabase SQL Editor 中单独执行本文件即可启用规则页持久化。

create table if not exists public.compliance_rules (
  id text primary key default 'default',
  allowed_categories jsonb not null default '[]'::jsonb,
  amount_limit text not null default '',
  deadline text not null default '',
  special_materials jsonb not null default '[]'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.compliance_rules enable row level security;

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
