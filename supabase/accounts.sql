-- ============================================================================
-- freshapp — Cloud accounts + session-token security  (STEP 1 of 2)
-- Run this ONCE in the Supabase SQL editor. It is ADDITIVE and safe:
-- it does NOT touch or open your existing user_kv / user_state / price_intel.
-- The final lock-down (closing user_kv/user_state to the anon key) is a
-- SEPARATE script — supabase/lockdown.sql — you run only AFTER verifying the
-- new app build works (so nothing breaks mid-deploy).
--
-- Model: every login (username/password OR Google) yields a random SESSION
-- TOKEN. Data sync goes through SECURITY DEFINER functions that resolve the
-- token to a sync_key server-side, so knowing someone's sync_key is useless
-- without their token — and a token is only issued after a verified login
-- (bcrypt password check here, Google JWT check in the Edge Function).
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Accounts (username/password) ─────────────────────────────────────────────
create table if not exists public.accounts (
  username   text primary key,          -- stored lowercase
  password   text not null,             -- bcrypt hash
  sync_key   text not null,             -- key into user_kv
  name       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.accounts enable row level security;   -- no anon policies => sealed

-- ── Sessions (capability tokens for BOTH account types) ──────────────────────
create table if not exists public.sessions (
  token_hash text primary key,          -- sha256(token), hex
  sync_key   text not null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
alter table public.sessions enable row level security;   -- no anon policies => sealed
create index if not exists sessions_sync_key on public.sessions (sync_key);

-- ── Drop older versions first ────────────────────────────────────────────────
-- create-or-replace can't change a function's return type, so if a previous
-- version exists (e.g. one without the token column) we drop it. Safe to run
-- this whole script repeatedly.
drop function if exists public.app_signup(text, text, text);
drop function if exists public.app_login(text, text);
drop function if exists public.app_change_password(text, text, text);
drop function if exists public.app_set_name(text, text);
drop function if exists public.kv_pull(text);
drop function if exists public.kv_push(text, jsonb);
drop function if exists public._new_session(text);
drop function if exists public._sync_key_for(text);

-- ── Internal helpers ─────────────────────────────────────────────────────────
-- Issue a new session for a sync_key and return the RAW token (stored hashed).
create or replace function public._new_session(p_sync_key text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into sessions(token_hash, sync_key)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_sync_key);
  return v_token;
end; $$;

-- Resolve a raw token to its sync_key (and bump last_seen). NULL if invalid.
create or replace function public._sync_key_for(p_token text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  update sessions set last_seen = now()
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    returning sync_key into v_key;
  return v_key;
end; $$;

-- ── Auth: sign up / log in / change password / set name ──────────────────────
-- Each returns (sync_key, name, token); empty result => taken / bad credentials.
create or replace function public.app_signup(p_username text, p_password text, p_name text default '')
returns table(sync_key text, name text, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_sync_key text := 'u_' || v_username;
begin
  if exists (select 1 from accounts a where a.username = v_username) then
    return;                                   -- empty => username taken
  end if;
  insert into accounts(username, password, sync_key, name)
  values (v_username, crypt(p_password, gen_salt('bf')), v_sync_key, coalesce(p_name, ''));
  return query select v_sync_key, coalesce(p_name, ''), public._new_session(v_sync_key);
end; $$;

create or replace function public.app_login(p_username text, p_password text)
returns table(sync_key text, name text, token text)
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_row accounts%rowtype;
begin
  select * into v_row from accounts a
    where a.username = v_username and a.password = crypt(p_password, a.password);
  if not found then return; end if;           -- empty => bad credentials
  return query select v_row.sync_key, v_row.name, public._new_session(v_row.sync_key);
end; $$;

create or replace function public.app_change_password(p_username text, p_current text, p_new text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_ok boolean;
begin
  select true into v_ok from accounts a
    where a.username = v_username and a.password = crypt(p_current, a.password);
  if not coalesce(v_ok, false) then return false; end if;
  update accounts set password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where username = v_username;
  return true;
end; $$;

create or replace function public.app_set_name(p_username text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update accounts set name = coalesce(p_name, ''), updated_at = now()
    where username = lower(trim(p_username));
end; $$;

-- ── Data sync via token (replaces direct REST access to user_kv) ──────────────
-- Read every synced section for the token's account. Falls back to the legacy
-- user_state blob when user_kv is still empty (one-way migration read).
create or replace function public.kv_pull(p_token text)
returns table(key text, value text, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public._sync_key_for(p_token);
  v_has boolean;
begin
  if v_key is null then return; end if;
  select exists(select 1 from user_kv k where k.user_id = v_key) into v_has;
  if v_has then
    return query select k.key, k.value, k.updated_at from user_kv k where k.user_id = v_key;
  else
    return query
      select e.key, e.value, now()
      from user_state s, jsonb_each_text(s.data) e
      where s.user_id = v_key;
  end if;
end; $$;

-- Upsert an array of {key,value,updated_at} rows for the token's account.
create or replace function public.kv_push(p_token text, p_rows jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_key text := public._sync_key_for(p_token);
  r jsonb;
begin
  if v_key is null then return false; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into user_kv(user_id, key, value, updated_at)
    values (v_key, r->>'key', r->>'value', coalesce((r->>'updated_at')::timestamptz, now()))
    on conflict (user_id, key) do update
      set value = excluded.value, updated_at = excluded.updated_at;
  end loop;
  return true;
end; $$;

-- The browser (anon) may ONLY call these functions — never the tables directly.
grant execute on function public.app_signup(text, text, text)          to anon;
grant execute on function public.app_login(text, text)                  to anon;
grant execute on function public.app_change_password(text, text, text)  to anon;
grant execute on function public.app_set_name(text, text)               to anon;
grant execute on function public.kv_pull(text)                          to anon;
grant execute on function public.kv_push(text, jsonb)                   to anon;

-- View registered accounts later (run from the SQL editor / service role):
--   select username, name, created_at from public.accounts order by created_at;
