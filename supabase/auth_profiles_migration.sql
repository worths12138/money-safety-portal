-- =============================================================================
-- 登录与角色：profiles + submissions.submitter_id
-- 在 Supabase SQL Editor 执行（需已执行 schema.sql）
-- =============================================================================

-- 1. 用户档案（与 auth.users 1:1）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  login_name text not null unique,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.profiles is '平台登录角色：student 学生 / teacher 教师';
comment on column public.profiles.login_name is '登录名，如 teacher1、student3';

create index if not exists profiles_role_idx on public.profiles (role);

-- 2. 申报归属学生
alter table public.submissions
  add column if not exists submitter_id uuid references public.profiles (id) on delete set null;

create index if not exists submissions_submitter_id_idx on public.submissions (submitter_id);

comment on column public.submissions.submitter_id is '提交学生 profiles.id；为空表示历史数据或匿名提交';

-- 3. RLS（可选：服务端仍用 service_role；此处防止误开 anon 直连）
alter table public.profiles enable row level security;

-- 不创建 anon/authenticated 策略 = 默认拒绝；Next.js 使用 service_role 读写
