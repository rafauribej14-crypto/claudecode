-- ============================================================================
-- freshapp — Cloud accounts (username + password login from any device)
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query → Run).
--
-- Security: passwords are hashed with bcrypt (pgcrypto) INSIDE the database and
-- never leave it. The public/anon key can only EXECUTE the functions below — it
-- has no direct read/write access to the accounts table, so hashes are never
-- exposed to the browser.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.accounts (
  username   text primary key,          -- stored lowercase
  password   text not null,             -- bcrypt hash (crypt/gen_salt('bf'))
  sync_key   text not null,             -- key into user_kv (data sync)
  name       text not null default '',  -- display name
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lock the table down: RLS on, and NO anon policies => anon cannot touch rows
-- directly. All access is through the SECURITY DEFINER functions below.
alter table public.accounts enable row level security;

-- ── Sign up ────────────────────────────────────────────────────────────────
-- Returns the new (sync_key, name) on success, or NO rows if the username is
-- already taken.
create or replace function public.app_signup(p_username text, p_password text, p_name text default '')
returns table(sync_key text, name text)
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_sync_key text := 'u_' || v_username;
begin
  if exists (select 1 from accounts a where a.username = v_username) then
    return;                         -- empty result => taken
  end if;
  insert into accounts(username, password, sync_key, name)
  values (v_username, crypt(p_password, gen_salt('bf')), v_sync_key, coalesce(p_name, ''));
  return query select v_sync_key, coalesce(p_name, '');
end; $$;

-- ── Log in ─────────────────────────────────────────────────────────────────
-- Returns (sync_key, name) when the password matches, or NO rows otherwise.
create or replace function public.app_login(p_username text, p_password text)
returns table(sync_key text, name text)
language plpgsql security definer set search_path = public as $$
declare v_username text := lower(trim(p_username));
begin
  return query
    select a.sync_key, a.name
    from accounts a
    where a.username = v_username
      and a.password = crypt(p_password, a.password);
end; $$;

-- ── Change password ──────────────────────────────────────────────────────────
-- Verifies the current password first. Returns true on success, false if the
-- current password is wrong.
create or replace function public.app_change_password(p_username text, p_current text, p_new text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_username text := lower(trim(p_username));
  v_ok boolean;
begin
  select true into v_ok from accounts a
    where a.username = v_username and a.password = crypt(p_current, a.password);
  if not coalesce(v_ok, false) then
    return false;
  end if;
  update accounts
    set password = crypt(p_new, gen_salt('bf')), updated_at = now()
    where username = v_username;
  return true;
end; $$;

-- ── Update display name (low sensitivity, best-effort) ───────────────────────
create or replace function public.app_set_name(p_username text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update accounts set name = coalesce(p_name, ''), updated_at = now()
    where username = lower(trim(p_username));
end; $$;

-- Only the functions are callable by the anon (browser) key.
grant execute on function public.app_signup(text, text, text)      to anon;
grant execute on function public.app_login(text, text)             to anon;
grant execute on function public.app_change_password(text, text, text) to anon;
grant execute on function public.app_set_name(text, text)          to anon;

-- To see registered accounts later, query from the SQL editor (service role):
--   select username, name, created_at, updated_at from public.accounts order by created_at;
