-- =====================================================================
-- Dr.Coach! v3.0.0 · Supabase Schema
-- ---------------------------------------------------------------------
-- Run this in your Supabase project's SQL editor (Dashboard → SQL → New).
-- It creates: profiles, attempts, sessions, canvas_objects, sync_state,
-- a storage bucket 'study-evidence', and Row-Level Security policies so
-- every user can ONLY read/write their own data.
--
-- Public registration is DISABLED: only users you create manually in
-- Dashboard → Authentication → Users can log in.
-- =====================================================================

-- Needed extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) PROFILES
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  preferences  jsonb not null default '{}'::jsonb
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_self_upsert" on public.profiles;
create policy "profiles_self_upsert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row when a new auth.users row appears.
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferences)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- ---------------------------------------------------------------------
-- 2) ATTEMPTS  (question attempts + reviews)
-- ---------------------------------------------------------------------
create table if not exists public.attempts (
  id              uuid primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  session_id      uuid,
  question_id     text default '',
  subject         text default '',
  system          text default '',
  topic           text default '',
  focus           text default '',
  result          text default '',          -- 'correct' | 'incorrect' | 'omitted' | ''
  confidence      text default '',
  stem            text default '',
  key_concept     text default '',
  memory_rule     text default '',
  notes           text default '',
  error_reasons   jsonb not null default '[]'::jsonb,
  attachment_ids  text[] not null default '{}',
  board_attachment_id text,
  study_board_id  text,
  study_board     jsonb,                    -- serialized study board (objects + strokes)
  is_review       boolean not null default false,
  mastered        boolean not null default false,
  review_events   jsonb not null default '[]'::jsonb,
  ordinal         int default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

alter table public.attempts enable row level security;

drop policy if exists "attempts_self_read" on public.attempts;
create policy "attempts_self_read" on public.attempts
  for select using (auth.uid() = user_id);

drop policy if exists "attempts_self_write" on public.attempts;
create policy "attempts_self_write" on public.attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists "attempts_self_update" on public.attempts;
create policy "attempts_self_update" on public.attempts
  for update using (auth.uid() = user_id);

drop policy if exists "attempts_self_delete" on public.attempts;
create policy "attempts_self_delete" on public.attempts
  for delete using (auth.uid() = user_id);

create index if not exists attempts_user_created_idx on public.attempts (user_id, created_at desc);
create index if not exists attempts_user_session_idx on public.attempts (user_id, session_id);
create index if not exists attempts_user_question_idx on public.attempts (user_id, question_id);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_attempts_touch on public.attempts;
create trigger trg_attempts_touch before update on public.attempts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3) SESSIONS
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id              uuid primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject         text default '',
  planned_count   int default 0,
  completed_count  int default 0,
  elapsed_sec     int default 0,
  paused          boolean not null default false,
  running_since   timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text default 'active', -- 'active' | 'completed' | 'incomplete'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.sessions enable row level security;

drop policy if exists "sessions_self_read" on public.sessions;
create policy "sessions_self_read" on public.sessions
  for select using (auth.uid() = user_id);

drop policy if exists "sessions_self_write" on public.sessions;
create policy "sessions_self_write" on public.sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sessions_self_update" on public.sessions;
create policy "sessions_self_update" on public.sessions
  for update using (auth.uid() = user_id);

drop policy if exists "sessions_self_delete" on public.sessions;
create policy "sessions_self_delete" on public.sessions
  for delete using (auth.uid() = user_id);

create index if not exists sessions_user_started_idx on public.sessions (user_id, started_at desc);

drop trigger if exists trg_sessions_touch on public.sessions;
create trigger trg_sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4) CANVAS OBJECTS (Study Board per question)
-- ---------------------------------------------------------------------
create table if not exists public.canvas_objects (
  id           uuid primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  board_id     text not null,                 -- maps to attempt.study_board_id
  attempt_id   uuid,
  type         text not null,                  -- 'stroke' | 'image' | 'text' | 'arrow' | 'shape' | 'crop'
  data         jsonb not null default '{}'::jsonb,
  z_index      int default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.canvas_objects enable row level security;

drop policy if exists "canvas_self_read" on public.canvas_objects;
create policy "canvas_self_read" on public.canvas_objects
  for select using (auth.uid() = user_id);

drop policy if exists "canvas_self_write" on public.canvas_objects;
create policy "canvas_self_write" on public.canvas_objects
  for insert with check (auth.uid() = user_id);

drop policy if exists "canvas_self_update" on public.canvas_objects;
create policy "canvas_self_update" on public.canvas_objects
  for update using (auth.uid() = user_id);

drop policy if exists "canvas_self_delete" on public.canvas_objects;
create policy "canvas_self_delete" on public.canvas_objects
  for delete using (auth.uid() = user_id);

create index if not exists canvas_user_board_idx on public.canvas_objects (user_id, board_id);

drop trigger if exists trg_canvas_touch on public.canvas_objects;
create trigger trg_canvas_touch before update on public.canvas_objects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5) SYNC STATE  (high-water mark per user per table)
-- ---------------------------------------------------------------------
create table if not exists public.sync_state (
  user_id      uuid not null references auth.users(id) on delete cascade,
  table_name  text not null,
  last_pull   timestamptz,
  last_push   timestamptz,
  primary key (user_id, table_name)
);

alter table public.sync_state enable row level security;

drop policy if exists "sync_state_self_rw" on public.sync_state;
create policy "sync_state_self_rw" on public.sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 6) STORAGE BUCKET — study-evidence
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('study-evidence', 'study-evidence', false)
on conflict (id) do nothing;

-- RLS on storage.objects so user can only touch their own folder
--   study-evidence/{user_id}/{question_id}/{image_id}.webp
drop policy if exists "study_evidence_user_rw" on storage.objects;
create policy "study_evidence_user_rw" on storage.objects
  for all
  using (
    bucket_id = 'study-evidence'
    and (auth.uid()::text = (storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'study-evidence'
    and (auth.uid()::text = (storage.foldername(name))[1])
  );

-- =====================================================================
-- DONE. Now create the 2 allowed users in:
--   Dashboard → Authentication → Users → Add user
-- (use email + password; the user_id will be generated automatically).
-- =====================================================================
