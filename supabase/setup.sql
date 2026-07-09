-- ============================================================================
-- freshapp — CONFIGURACIÓN ÚNICA DE SUPABASE
--
-- Corre TODO este archivo UNA vez en: Supabase → SQL Editor → New query → Run.
-- Es 100% idempotente y seguro de re-ejecutar: usa "if not exists" en tablas,
-- "drop policy/function if exists" antes de crear, así que NUNCA aborta a medias
-- ni pierde datos existentes. Reemplaza a accounts.sql y lockdown.sql.
--
-- Qué hace:
--   • Crea las tablas: accounts, sessions, user_kv, user_state, price_intel.
--   • Toda cuenta creada se GUARDA EN LA NUBE (accounts) con contraseña bcrypt.
--   • Cada login (usuario/contraseña o Google) emite un TOKEN de sesión.
--   • Los datos del usuario (perfil, inventario, recetas, etc.) se guardan por
--     token vía kv_push y se recuperan vía kv_pull → así puede iniciar sesión
--     en cualquier dispositivo y ya tiene toda su info personalizada.
--   • Las tablas de datos quedan SELLADAS (solo accesibles por las funciones);
--     price_intel queda abierta a propósito (datos comunitarios anónimos).
--
-- Después, para el login con Google, despliega la Edge Function google-auth
-- (ver supabase/README.md). Las cuentas usuario/contraseña YA funcionan con
-- solo este script.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Tablas de datos (heredadas; se conservan tal cual) ───────────────────────
create table if not exists public.user_state (
  user_id    text primary key,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_kv (
  user_id    text not null,
  key        text not null,
  value      text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.price_intel (
  id           uuid primary key default gen_random_uuid(),
  country      text not null,
  store        text not null,
  product_name text not null,
  unit         text not null,
  unit_price   numeric not null,
  observed_at  timestamptz not null default now()
);
create index if not exists price_intel_lookup on public.price_intel (country, product_name);

-- ── Cuentas (usuario/contraseña) ─────────────────────────────────────────────
create table if not exists public.accounts (
  username   text primary key,          -- se guarda en minúsculas
  password   text not null,             -- hash bcrypt (nunca sale de la BD)
  sync_key   text not null,             -- clave de datos en user_kv
  name       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Sesiones (tokens de capacidad para ambos tipos de login) ─────────────────
create table if not exists public.sessions (
  token_hash text primary key,          -- sha256(token) en hex
  sync_key   text not null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists sessions_sync_key on public.sessions (sync_key);

-- ── RLS: todo con RLS activado ───────────────────────────────────────────────
alter table public.user_state  enable row level security;
alter table public.user_kv     enable row level security;
alter table public.price_intel enable row level security;
alter table public.accounts    enable row level security;
alter table public.sessions    enable row level security;

-- price_intel: abierta (comunidad anónima). Recreamos políticas de forma segura.
drop policy if exists "anon can read community prices" on public.price_intel;
drop policy if exists "anon can contribute prices"     on public.price_intel;
create policy "anon can read community prices" on public.price_intel for select to anon using (true);
create policy "anon can contribute prices"     on public.price_intel for insert to anon with check (true);

-- accounts / sessions / user_kv / user_state: SELLADAS.
-- Sin políticas para anon => el navegador NO puede tocarlas directamente.
-- Todo acceso pasa por las funciones SECURITY DEFINER de abajo (corren como
-- dueño de las tablas y por eso sí pueden leer/escribir).
drop policy if exists "anon rw user_kv"                on public.user_kv;
drop policy if exists "anon can read/write by user_id" on public.user_state;

-- ── Se eliminan versiones previas de las funciones (por si cambió el tipo de
--    retorno; sin esto "create or replace" fallaría). Seguro re-ejecutar. ─────
drop function if exists public.app_signup(text, text, text);
drop function if exists public.app_login(text, text);
drop function if exists public.app_change_password(text, text, text);
drop function if exists public.app_set_name(text, text);
drop function if exists public.kv_pull(text);
drop function if exists public.kv_push(text, jsonb);
drop function if exists public._new_session(text);
drop function if exists public._sync_key_for(text);

-- ── Helpers internos ─────────────────────────────────────────────────────────
create or replace function public._new_session(p_sync_key text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text := encode(gen_random_bytes(32), 'hex');
begin
  insert into sessions(token_hash, sync_key)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_sync_key);
  return v_token;
end; $$;

create or replace function public._sync_key_for(p_token text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_key text;
begin
  update sessions set last_seen = now()
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    returning sync_key into v_key;
  return v_key;
end; $$;

-- ── Registro / login / cambio de contraseña / nombre ─────────────────────────
-- Cada uno retorna (sync_key, name, token); resultado vacío => usuario ya existe
-- o credenciales incorrectas.
create or replace function public.app_signup(p_username text, p_password text, p_name text default '')
returns table(sync_key text, name text, token text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text := lower(trim(p_username));
  v_sync_key text := 'u_' || v_username;
begin
  if exists (select 1 from accounts a where a.username = v_username) then
    return;                                   -- vacío => usuario ocupado
  end if;
  insert into accounts(username, password, sync_key, name)
  values (v_username, crypt(p_password, gen_salt('bf')), v_sync_key, coalesce(p_name, ''));
  return query select v_sync_key, coalesce(p_name, ''), public._new_session(v_sync_key);
end; $$;

create or replace function public.app_login(p_username text, p_password text)
returns table(sync_key text, name text, token text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text := lower(trim(p_username));
  v_row accounts%rowtype;
begin
  select * into v_row from accounts a
    where a.username = v_username and a.password = crypt(p_password, a.password);
  if not found then return; end if;           -- vacío => credenciales malas
  return query select v_row.sync_key, v_row.name, public._new_session(v_row.sync_key);
end; $$;

create or replace function public.app_change_password(p_username text, p_current text, p_new text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
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
language plpgsql security definer set search_path = public, extensions as $$
begin
  update accounts set name = coalesce(p_name, ''), updated_at = now()
    where username = lower(trim(p_username));
end; $$;

-- ── Sincronización de datos por token ────────────────────────────────────────
-- Lee todas las secciones del usuario del token. Si user_kv está vacío, migra
-- una vez desde el blob heredado user_state.
create or replace function public.kv_pull(p_token text)
returns table(key text, value text, updated_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text := public._sync_key_for(p_token);
  v_has boolean;
begin
  if v_key is null then return; end if;
  select exists(select 1 from user_kv k where k.user_id = v_key) into v_has;
  if v_has then
    return query select k.key, k.value, k.updated_at from user_kv k where k.user_id = v_key;
  else
    -- Legacy seed: stamp with epoch (oldest possible) so it only fills gaps on a
    -- fresh device and NEVER overrides a fresher local edit made on this device.
    return query
      select e.key, e.value, '1970-01-01 00:00:00+00'::timestamptz
      from user_state s, jsonb_each_text(s.data) e
      where s.user_id = v_key;
  end if;
end; $$;

-- Guarda un arreglo de {key,value,updated_at} para el usuario del token.
create or replace function public.kv_push(p_token text, p_rows jsonb)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
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

-- ── El navegador (anon) SOLO puede ejecutar estas funciones ──────────────────
grant execute on function public.app_signup(text, text, text)          to anon;
grant execute on function public.app_login(text, text)                  to anon;
grant execute on function public.app_change_password(text, text, text)  to anon;
grant execute on function public.app_set_name(text, text)               to anon;
grant execute on function public.kv_pull(text)                          to anon;
grant execute on function public.kv_push(text, jsonb)                   to anon;

-- ── Verificación rápida (corre estas líneas aparte para comprobar) ───────────
-- Debe crear una cuenta de prueba y devolver sync_key + token:
--   select * from public.app_signup('prueba_qa', 'clave1234', 'Prueba');
-- Debe listar la cuenta:
--   select username, name, created_at from public.accounts order by created_at;
-- Debe loguear y devolver un token nuevo:
--   select * from public.app_login('prueba_qa', 'clave1234');
-- Limpieza opcional del usuario de prueba:
--   delete from public.accounts where username = 'prueba_qa';
