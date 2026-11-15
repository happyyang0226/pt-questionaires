-- 물리치료 설문도구 웹앱: 학생(가상 환자 사례 저장) / 교수(전체 조회)

-- 1) 교수 권한을 줄 이메일 목록
create table if not exists public.professor_emails (
  email text primary key
);
alter table public.professor_emails enable row level security;
-- 정책 없음 = 클라이언트에서 읽기·쓰기 불가(관리자 SQL로만 관리)

-- 2) 사용자 프로필
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default '',
  student_no text not null default '',
  role text not null default 'student' check (role in ('student','professor')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- 교수 여부(정책 안에서 재귀 없이 쓰기 위한 함수)
create or replace function public.is_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'professor');
$$;
revoke all on function public.is_professor() from public, anon;
grant execute on function public.is_professor() to authenticated;

create policy "profiles: 본인 또는 교수 조회" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_professor()));
create policy "profiles: 본인 이름·학번 수정" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = (select p.role from public.profiles p where p.id = (select auth.uid())));

-- 가입 시 프로필 자동 생성(교수 이메일이면 professor)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, student_no, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name',''),
    coalesce(new.raw_user_meta_data->>'student_no',''),
    case when exists (select 1 from public.professor_emails e where lower(e.email) = lower(new.email)) then 'professor' else 'student' end
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) 저장된 사례(가상 환자)
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null check (app in ('perinatal','spine','upper','lower')),
  case_label text not null default '',
  pt jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  clin jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cases_user_app_idx on public.cases (user_id, app, updated_at desc);
create index if not exists cases_app_idx on public.cases (app, updated_at desc);
alter table public.cases enable row level security;

create policy "cases: 본인 또는 교수 조회" on public.cases
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_professor()));
create policy "cases: 본인 저장" on public.cases
  for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "cases: 본인 수정" on public.cases
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "cases: 본인 삭제" on public.cases
  for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists cases_touch on public.cases;
create trigger cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();
