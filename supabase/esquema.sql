-- =====================================================================
-- Emprende con Gold Mills · Base de datos (Supabase / PostgreSQL)
-- Se ejecuta una sola vez en: Supabase → SQL Editor → New query → Run
-- Es seguro volver a ejecutarlo: no borra datos existentes.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- 1. CLIENTES · un registro por celular
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) between 2 and 80),
  negocio        text check (negocio is null or length(negocio) <= 80),
  celular        text not null unique check (celular ~ '^6[0-9]{7}$'),
  token          uuid not null unique default gen_random_uuid(),  -- llave que guarda el celular del cliente para reconocerlo
  zona           text,          -- la asigna la operación (backstage)
  dia_entrega    text,          -- la asigna la operación (backstage)
  creado_en      timestamptz not null default now(),
  ultimo_acceso  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. PEDIDOS · cada vez que el cliente toca "Enviar pedido por WhatsApp"
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id                      bigint generated always as identity primary key,
  cliente_id              uuid references public.clientes(id) on delete set null,
  nombre                  text not null,          -- copia de cómo firmó el pedido
  celular                 text,
  items                   jsonb not null,         -- [{codigo, nombre, presentacion, cantidad, precio}]
  total                   numeric(10,2) not null check (total >= 0),
  productos_por_consultar int not null default 0,
  estado                  text not null default 'enviado_whatsapp'
                          check (estado in ('enviado_whatsapp','confirmado','entregado','cancelado')),
  creado_en               timestamptz not null default now()
);
create index if not exists pedidos_cliente_fecha on public.pedidos (cliente_id, creado_en desc);
create index if not exists pedidos_fecha on public.pedidos (creado_en desc);

-- ---------------------------------------------------------------------
-- 3. SEGURIDAD · la página pública NO puede leer ni escribir las tablas.
--    Solo puede llamar a las 3 funciones de abajo, que validan todo.
-- ---------------------------------------------------------------------
alter table public.clientes enable row level security;
alter table public.pedidos  enable row level security;
revoke all on public.clientes from anon, authenticated;
revoke all on public.pedidos  from anon, authenticated;

-- Compara el primer nombre sin tildes ni mayúsculas ("Rosa" = "rosa méndez")
create or replace function public.mismo_nombre(a text, b text)
returns boolean language sql immutable set search_path = public, extensions as $$
  select lower(unaccent(split_part(trim(a), ' ', 1))) = lower(unaccent(split_part(trim(b), ' ', 1)))
$$;

-- Resumen del último pedido de un cliente
create or replace function public._ultimo_pedido_de(p_cliente uuid)
returns json language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('id', id, 'items', items, 'total', total, 'creado_en', creado_en)
  from pedidos where cliente_id = p_cliente
  order by creado_en desc limit 1
$$;

-- ---------------------------------------------------------------------
-- 4. FUNCIONES QUE USA LA PÁGINA
-- ---------------------------------------------------------------------

-- 4.1 Registrar o reconocer a un cliente por nombre + celular
create or replace function public.ingresar_cliente(p_nombre text, p_negocio text, p_celular text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g'); v_nuevo boolean := false;
begin
  if v_cel !~ '^6[0-9]{7}$' then raise exception 'celular_invalido'; end if;
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_invalido'; end if;

  select * into c from clientes where celular = v_cel;
  if found then
    if not mismo_nombre(c.nombre, p_nombre) then raise exception 'celular_registrado'; end if;
    update clientes
       set ultimo_acceso = now(),
           negocio = coalesce(nullif(trim(p_negocio), ''), negocio)
     where id = c.id returning * into c;
  else
    insert into clientes (nombre, negocio, celular)
    values (trim(p_nombre), nullif(trim(p_negocio), ''), v_cel) returning * into c;
    v_nuevo := true;
  end if;

  return json_build_object(
    'id', c.id, 'token', c.token, 'nombre', c.nombre, 'negocio', c.negocio,
    'celular', c.celular, 'nuevo', v_nuevo, 'ultimo_pedido', _ultimo_pedido_de(c.id));
end $$;

-- 4.2 Guardar el pedido al tocar "Enviar pedido por WhatsApp"
create or replace function public.enviar_pedido(
  p_token uuid, p_nombre text, p_celular text, p_items jsonb, p_total numeric, p_consultar int)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
        v_id bigint; v_token uuid := null;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 120 then
    raise exception 'pedido_invalido';
  end if;
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_invalido'; end if;

  if p_token is not null then select * into c from clientes where token = p_token; end if;

  if c.id is null and v_cel ~ '^6[0-9]{7}$' then
    select * into c from clientes where celular = v_cel;
    if c.id is null then
      insert into clientes (nombre, celular) values (trim(p_nombre), v_cel) returning * into c;
      v_token := c.token;
    elsif mismo_nombre(c.nombre, p_nombre) then
      v_token := c.token;
    else
      c := null;   -- celular de otra persona: se guarda el pedido sin vincularlo
    end if;
  end if;

  insert into pedidos (cliente_id, nombre, celular, items, total, productos_por_consultar)
  values (c.id, trim(p_nombre), nullif(v_cel, ''), p_items, round(coalesce(p_total, 0), 2), coalesce(p_consultar, 0))
  returning id into v_id;

  if c.id is not null then update clientes set ultimo_acceso = now() where id = c.id; end if;

  return json_build_object('pedido_id', v_id, 'vinculado', c.id is not null,
    'token', v_token, 'nombre', c.nombre, 'negocio', c.negocio, 'celular', c.celular);
end $$;

-- 4.3 Traer el último pedido para "Repetir mi último pedido"
create or replace function public.ultimo_pedido(p_token uuid)
returns json language sql stable security definer set search_path = public, extensions as $$
  select _ultimo_pedido_de(id) from clientes where token = p_token
$$;

-- Permisos: la página (rol anon) solo ejecuta estas tres funciones
revoke all on function public._ultimo_pedido_de(uuid) from public, anon, authenticated;
revoke all on function public.mismo_nombre(text, text) from public, anon, authenticated;
grant execute on function public.ingresar_cliente(text, text, text) to anon, authenticated;
grant execute on function public.enviar_pedido(uuid, text, text, jsonb, numeric, int) to anon, authenticated;
grant execute on function public.ultimo_pedido(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. VISTAS PARA TI (solo desde el panel de Supabase, no desde la página)
-- ---------------------------------------------------------------------
create or replace view public.v_pedidos with (security_invoker = true) as
  select p.id, p.creado_en at time zone 'America/Panama' as fecha_panama,
         p.nombre, c.negocio, p.celular, c.zona, c.dia_entrega,
         jsonb_array_length(p.items) as referencias, p.total, p.productos_por_consultar, p.estado
  from pedidos p left join clientes c on c.id = p.cliente_id
  order by p.creado_en desc;

create or replace view public.v_productos_pedidos with (security_invoker = true) as
  select (i->>'codigo')::int as codigo, i->>'nombre' as producto, i->>'presentacion' as presentacion,
         sum((i->>'cantidad')::int) as unidades, count(distinct p.id) as pedidos,
         count(distinct p.cliente_id) as clientes
  from pedidos p, jsonb_array_elements(p.items) i
  where p.estado <> 'cancelado'
  group by 1, 2, 3 order by unidades desc;

revoke all on public.v_pedidos, public.v_productos_pedidos from anon, authenticated;
