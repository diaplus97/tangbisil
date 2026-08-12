-- 온라인 탕비실 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 이 파일 전체를 실행하세요.

-- 컵 테이블: 접속자 한 명 = 컵 하나
create table if not exists cups (
  id          text primary key,
  nickname    text not null,
  color       text not null default '#888',
  coffee_type text,
  message     text,
  message_at  timestamptz,
  created_at  timestamptz default now()
);

alter table cups enable row level security;

-- 익명 공개 공간이므로 전체 공개 정책 (v0.1 기준)
drop policy if exists "public_all" on cups;
create policy "public_all" on cups for all using (true) with check (true);

-- 실시간 동기화 활성화
-- (이미 추가돼 있으면 오류가 나므로 무시해도 됩니다.
--  대시보드에서는 Database → Replication → supabase_realtime 에서 cups 체크)
alter publication supabase_realtime add table cups;
