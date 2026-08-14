-- 온라인 탕비실 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 실행하세요.
-- (이미 테이블이 있는 경우에도 안전하게 재실행 가능)

-- 컵 테이블: 접속자 한 명 = 컵 하나
-- left_at 이 찍힌 컵은 "식은 컵" — 다녀간 흔적으로 잠시 남는다 (v0.2)
create table if not exists cups (
  id          text primary key,
  nickname    text not null,
  color       text not null default '#888',
  coffee_type text,
  message     text,
  message_at  timestamptz,
  left_at     timestamptz,
  created_at  timestamptz default now()
);

-- 구버전 테이블 마이그레이션 (없으면 무시됨)
alter table cups add column if not exists left_at timestamptz;

alter table cups enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 정책
--
-- anon key 는 브라우저 번들에 그대로 들어간다 (원래 공개용 키다).
-- 그래서 "누구나 뭐든 할 수 있다" 로 두면 개발자도구를 열 줄 아는
-- 사람이 DELETE 한 방으로 방 전체를 비울 수 있다.
--
-- 익명 서비스라 "이 컵이 네 것인지" 를 서버가 검증할 방법이 없으므로
-- 읽기/쓰기는 열어두되, 삭제만 막아서 피해 범위를 줄인다.
-- 오래된 컵 정리는 아래 prune_old_cups() 함수로만 할 수 있다.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "public_all" on cups;   -- 구버전 (삭제까지 허용) 제거
drop policy if exists "cups_select" on cups;
drop policy if exists "cups_insert" on cups;
drop policy if exists "cups_update" on cups;

create policy "cups_select" on cups for select using (true);
create policy "cups_insert" on cups for insert with check (true);
create policy "cups_update" on cups for update using (true) with check (true);
-- delete 정책 없음 → 클라이언트는 어떤 행도 지울 수 없다

-- 오래된 컵 정리 — 8시간 지난 것만, 이 함수를 통해서만
create or replace function prune_old_cups()
returns void
language sql
security definer
set search_path = public
as $$
  delete from cups where created_at < now() - interval '8 hours';
$$;

revoke all on function prune_old_cups() from public;
grant execute on function prune_old_cups() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 냉장고: 다음 사람에게 남기고 가는 것
--
-- 동접이 0~1명인 시간이 대부분이라 혼자 들어오면 빈 방이다.
-- 먹을 걸 하나 넣어두고 가면 다음 사람이 꺼내 먹는다 — 같은 시간에
-- 없어도 서로를 느낀다.
--
-- 꺼내기를 delete 로 하면 anon 키로 냉장고를 통째로 비울 수 있다.
-- cups 와 같은 원칙: taken_by 에 표시만 하고 실제 삭제는 함수로만.
-- ─────────────────────────────────────────────────────────────
create table if not exists fridge (
  id         uuid primary key default gen_random_uuid(),
  item_id    text not null,
  emoji      text not null,
  label      text not null,
  note       text,                      -- 정해진 문구 중 하나 (자유 입력 아님)
  from_nick  text not null,
  from_color text not null default '#888',
  from_sid   text not null,             -- 도배 방지용 (한 사람당 넣어둘 수 있는 개수 제한)
  taken_by   text,                      -- 꺼내 간 사람 (null = 아직 들어 있음)
  taken_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fridge_open_idx on fridge (created_at desc) where taken_by is null;

alter table fridge enable row level security;

drop policy if exists "fridge_select" on fridge;
drop policy if exists "fridge_insert" on fridge;
drop policy if exists "fridge_update" on fridge;

create policy "fridge_select" on fridge for select using (true);
create policy "fridge_insert" on fridge for insert with check (true);
create policy "fridge_update" on fridge for update using (true) with check (true);
-- delete 정책 없음 → 클라이언트는 냉장고를 비울 수 없다

-- 정리 — 꺼내 간 건 6시간, 아무도 안 꺼낸 건 3일 뒤에 치운다.
-- 오래된 걸 바로 안 지우는 이유: 냉장고가 비면 "남기고 간다" 의 절반이
-- 안 돌아간다. 오래된 건 클라이언트에서 '상한 것' 으로 보여준다.
create or replace function prune_fridge()
returns void
language sql
security definer
set search_path = public
as $$
  delete from fridge
   where (taken_by is not null and taken_at < now() - interval '6 hours')
      or created_at < now() - interval '3 days';
$$;

revoke all on function prune_fridge() from public;
grant execute on function prune_fridge() to anon, authenticated;

-- 실시간 동기화 활성화
-- (이미 추가돼 있으면 "already member" 오류가 나며, 무시해도 됩니다.
--  대시보드에서는 Database → Replication → supabase_realtime 에서 cups 체크)
alter publication supabase_realtime add table cups;
alter publication supabase_realtime add table fridge;
