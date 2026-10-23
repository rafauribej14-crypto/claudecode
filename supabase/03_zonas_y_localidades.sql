-- =====================================================================
-- Emprende con Gold Mills · Migración 3
-- Zonas de entrega y localidades: los 26 corregimientos del distrito de Panamá y los
-- distritos atendidos como una sola opción (La Chorrera, Arraiján, San Miguelito, Chepo).
-- El cliente elige su localidad; la zona y el día de entrega salen de aquí.
-- Para cambiar el día de una zona o la zona de un corregimiento: Table Editor → zonas / localidades.
-- =====================================================================

create table if not exists public.zonas (
  codigo  text primary key,
  nombre  text not null,
  dias    text not null,            -- lo que ve el cliente, ej. "Viernes"
  orden   int  not null default 0,
  activa  boolean not null default true
);

create table if not exists public.localidades (
  id            text primary key,   -- ej. 'panama-tocumen' o 'la-chorrera'
  provincia     text not null,
  distrito      text not null,
  nombre        text not null,      -- corregimiento, o el distrito completo (ej. 'La Chorrera')
  zona          text not null references public.zonas(codigo) on update cascade,
  pista         text,               -- barrio conocido para ubicarse, ej. 'Westland'
  orden         int  not null default 0,
  unique (distrito, nombre)
);

alter table public.clientes add column if not exists localidad_id text references public.localidades(id);
alter table public.clientes add column if not exists barrio text check (barrio is null or length(barrio) <= 120);
-- clientes.zona ya existe: si se llena a mano, manda sobre la zona del corregimiento.

alter table public.pedidos add column if not exists zona text;
alter table public.pedidos add column if not exists localidad text;
alter table public.pedidos add column if not exists dia_entrega text;
create index if not exists pedidos_zona_fecha on public.pedidos (zona, creado_en desc);

alter table public.zonas enable row level security;
alter table public.localidades enable row level security;
revoke all on public.zonas, public.localidades from anon, authenticated;

insert into public.zonas (codigo,nombre,dias,orden) values
  ('ESTE','Zona Este','Lunes y jueves',1),
  ('CENTRO','Zona Centro','Martes',2),
  ('NORTE','Zona Norte','Miércoles',3),
  ('OESTE','Zona Oeste','Viernes',4),
  ('SANMIGUELITO','Zona San Miguelito','Sábado',5),
  ('PORASIGNAR','Por asignar','Tu asesor te confirma el día',9)
on conflict (codigo) do nothing;

insert into public.localidades (id,provincia,distrito,nombre,zona,pista,orden) values
  ('panama-san-felipe','Panamá','Panamá','San Felipe','CENTRO',null,0),
  ('panama-el-chorrillo','Panamá','Panamá','El Chorrillo','CENTRO',null,1),
  ('panama-santa-ana','Panamá','Panamá','Santa Ana','CENTRO',null,2),
  ('panama-la-exposicion-o-calidonia','Panamá','Panamá','La Exposición o Calidonia','CENTRO',null,3),
  ('panama-curundu','Panamá','Panamá','Curundú','CENTRO',null,4),
  ('panama-betania','Panamá','Panamá','Betania','CENTRO','La Locería',5),
  ('panama-bella-vista','Panamá','Panamá','Bella Vista','CENTRO','Obarrio, Paitilla',6),
  ('panama-pueblo-nuevo','Panamá','Panamá','Pueblo Nuevo','CENTRO',null,7),
  ('panama-san-francisco','Panamá','Panamá','San Francisco','CENTRO',null,8),
  ('panama-parque-lefevre','Panamá','Panamá','Parque Lefevre','CENTRO','Chanis',9),
  ('panama-rio-abajo','Panamá','Panamá','Río Abajo','CENTRO',null,10),
  ('panama-juan-diaz','Panamá','Panamá','Juan Díaz','CENTRO','Costa del Este',11),
  ('panama-pedregal','Panamá','Panamá','Pedregal','ESTE',null,12),
  ('panama-ancon','Panamá','Panamá','Ancón','OESTE','Ciudad del Saber',13),
  ('panama-chilibre','Panamá','Panamá','Chilibre','NORTE',null,14),
  ('panama-las-cumbres','Panamá','Panamá','Las Cumbres','NORTE',null,15),
  ('panama-pacora','Panamá','Panamá','Pacora','ESTE','Río Chico',16),
  ('panama-san-martin','Panamá','Panamá','San Martín','ESTE',null,17),
  ('panama-tocumen','Panamá','Panamá','Tocumen','ESTE','La Siesta',18),
  ('panama-las-mananitas','Panamá','Panamá','Las Mañanitas','ESTE',null,19),
  ('panama-24-de-diciembre','Panamá','Panamá','24 de Diciembre','ESTE',null,20),
  ('panama-alcalde-diaz','Panamá','Panamá','Alcalde Díaz','NORTE',null,21),
  ('panama-ernesto-cordoba-campos','Panamá','Panamá','Ernesto Córdoba Campos','NORTE',null,22),
  ('panama-caimitillo','Panamá','Panamá','Caimitillo','NORTE',null,23),
  ('panama-don-bosco','Panamá','Panamá','Don Bosco','ESTE',null,24),
  ('panama-las-garzas','Panamá','Panamá','Las Garzas','ESTE',null,25),
  ('la-chorrera','Panamá Oeste','La Chorrera','La Chorrera','OESTE',null,26),
  ('arraijan','Panamá Oeste','Arraiján','Arraiján','OESTE','Westland',27),
  ('san-miguelito','Panamá','San Miguelito','San Miguelito','SANMIGUELITO','Torrijos Carter',28),
  ('chepo','Panamá','Chepo','Chepo','ESTE',null,29),
  ('otra','Panamá','Otra','Otra localidad','PORASIGNAR',null,30)
on conflict (id) do nothing;

-- Ficha completa del cliente con su zona efectiva
create or replace function public._cliente_json(p_id uuid)
returns json language sql stable security definer set search_path = public, extensions as $$
  select json_build_object(
    'id', c.id, 'token', c.token, 'nombre', c.nombre, 'negocio', c.negocio, 'celular', c.celular,
    'localidad_id', c.localidad_id, 'barrio', c.barrio,
    'localidad', l.nombre,
    'zona', z.codigo, 'zona_nombre', z.nombre, 'dias', z.dias,
    'ultimo_pedido', _ultimo_pedido_de(c.id))
  from clientes c
  left join localidades l on l.id = c.localidad_id
  left join zonas z on z.codigo = coalesce(c.zona, l.zona)
  where c.id = p_id
$$;
revoke all on function public._cliente_json(uuid) from public, anon, authenticated;

-- Lista para el selector de la página
create or replace function public.zonas_y_localidades()
returns json language sql stable security definer set search_path = public, extensions as $$
  select json_build_object(
    'zonas', (select coalesce(json_agg(json_build_object('codigo', codigo, 'nombre', nombre, 'dias', dias) order by orden), '[]') from zonas where activa),
    'localidades', (select coalesce(json_agg(json_build_object('id', l.id, 'distrito', l.distrito, 'nombre', l.nombre, 'zona', l.zona, 'pista', l.pista)
                     order by l.orden), '[]')
                    from localidades l join zonas z on z.codigo = l.zona where z.activa))
$$;

-- Crear cuenta con zona de entrega
create or replace function public.ingresar_cliente(p_nombre text, p_negocio text, p_celular text, p_localidad text, p_barrio text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g'); v_nuevo boolean := false;
        v_loc text := nullif(trim(coalesce(p_localidad,'')), ''); v_barrio text := nullif(left(trim(coalesce(p_barrio,'')), 120), '');
begin
  if v_cel !~ '^6[0-9]{7}$' then raise exception 'celular_invalido'; end if;
  if v_loc is not null and not exists (select 1 from localidades where id = v_loc) then raise exception 'localidad_invalida'; end if;
  select * into c from clientes where celular = v_cel;
  if found then
    update clientes
       set ultimo_acceso = now(),
           negocio = coalesce(negocio, nullif(trim(p_negocio), '')),
           localidad_id = coalesce(localidad_id, v_loc),
           barrio = coalesce(barrio, v_barrio)
     where id = c.id returning * into c;
  else
    if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_invalido'; end if;
    insert into clientes (nombre, negocio, celular, localidad_id, barrio)
    values (trim(p_nombre), nullif(trim(p_negocio), ''), v_cel, v_loc, v_barrio) returning * into c;
    v_nuevo := true;
  end if;
  return (_cliente_json(c.id)::jsonb || jsonb_build_object('nuevo', v_nuevo))::json;
end $$;

-- Entrar con el celular: ahora también devuelve la zona
create or replace function public.entrar_cliente(p_celular text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
begin
  if v_cel !~ '^6[0-9]{7}$' then raise exception 'celular_invalido'; end if;
  select * into c from clientes where celular = v_cel;
  if not found then raise exception 'no_registrado'; end if;
  update clientes set ultimo_acceso = now() where id = c.id;
  return (_cliente_json(c.id)::jsonb || jsonb_build_object('nuevo', false))::json;
end $$;

-- Cambiar la zona de entrega desde "Mis compras"
create or replace function public.actualizar_zona(p_token uuid, p_localidad text, p_barrio text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes;
begin
  if not exists (select 1 from localidades where id = p_localidad) then raise exception 'localidad_invalida'; end if;
  update clientes set localidad_id = p_localidad, barrio = nullif(left(trim(coalesce(p_barrio,'')), 120), ''), ultimo_acceso = now()
   where token = p_token returning * into c;
  if c.id is null then raise exception 'cuenta_no_encontrada'; end if;
  return (_cliente_json(c.id)::jsonb || jsonb_build_object('nuevo', false))::json;
end $$;

-- Guardar pedido con la zona del momento (para programar la ruta)
drop function if exists public.enviar_pedido(uuid, text, text, jsonb, numeric, int);
create or replace function public.enviar_pedido(
  p_token uuid, p_nombre text, p_celular text, p_items jsonb, p_total numeric, p_consultar int,
  p_localidad text default null, p_barrio text default null)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
        v_id bigint; v_token uuid := null; v_loc text := nullif(trim(coalesce(p_localidad,'')), '');
        v_barrio text := nullif(left(trim(coalesce(p_barrio,'')), 120), '');
        l localidades; z zonas;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 120 then
    raise exception 'pedido_invalido';
  end if;
  if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_invalido'; end if;
  if v_loc is not null and not exists (select 1 from localidades where id = v_loc) then v_loc := null; end if;

  if p_token is not null then select * into c from clientes where token = p_token; end if;
  if c.id is null and v_cel ~ '^6[0-9]{7}$' then
    select * into c from clientes where celular = v_cel;
    if c.id is null then
      insert into clientes (nombre, celular, localidad_id, barrio)
      values (split_part(trim(p_nombre), ' – ', 1), v_cel, v_loc, v_barrio) returning * into c;
    end if;
    v_token := c.token;
  end if;
  if c.id is not null and c.localidad_id is null and v_loc is not null then
    update clientes set localidad_id = v_loc, barrio = coalesce(barrio, v_barrio) where id = c.id returning * into c;
  end if;

  select * into l from localidades where id = coalesce(c.localidad_id, v_loc);
  select * into z from zonas where codigo = coalesce(c.zona, l.zona);

  insert into pedidos (cliente_id, nombre, celular, items, total, productos_por_consultar, zona, localidad, dia_entrega)
  values (c.id, trim(p_nombre), coalesce(c.celular, nullif(v_cel, '')), p_items, round(coalesce(p_total, 0), 2), coalesce(p_consultar, 0),
          z.codigo,
          case when l.id is null then null else l.nombre || coalesce(' · ' || coalesce(c.barrio, v_barrio), '') end,
          z.dias)
  returning id into v_id;

  if c.id is not null then update clientes set ultimo_acceso = now() where id = c.id; end if;

  return json_build_object('pedido_id', v_id, 'vinculado', c.id is not null,
    'token', v_token, 'nombre', c.nombre, 'negocio', c.negocio, 'celular', c.celular,
    'zona', z.codigo, 'zona_nombre', z.nombre, 'dias', z.dias);
end $$;

grant execute on function public.zonas_y_localidades() to anon, authenticated;
grant execute on function public.ingresar_cliente(text, text, text, text, text) to anon, authenticated;
grant execute on function public.entrar_cliente(text) to anon, authenticated;
grant execute on function public.actualizar_zona(uuid, text, text) to anon, authenticated;
grant execute on function public.enviar_pedido(uuid, text, text, jsonb, numeric, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Vistas para programar la ruta (solo panel de Supabase)
-- ---------------------------------------------------------------------
drop view if exists public.v_pedidos;
create view public.v_pedidos with (security_invoker = true) as
  select p.id, p.creado_en at time zone 'America/Panama' as fecha_panama,
         coalesce(z.nombre, 'Sin zona') as zona, p.dia_entrega, p.localidad,
         p.nombre, c.negocio, p.celular,
         jsonb_array_length(p.items) as referencias, p.total, p.productos_por_consultar, p.estado
  from pedidos p
  left join clientes c on c.id = p.cliente_id
  left join zonas z on z.codigo = p.zona
  order by p.creado_en desc;

create or replace view public.v_clientes with (security_invoker = true) as
  select c.nombre, c.negocio, c.celular, l.distrito, l.nombre as localidad, c.barrio,
         coalesce(z.nombre, 'Sin zona') as zona, z.dias as dia_entrega,
         count(p.id) as pedidos, coalesce(sum(p.total), 0) as total_pedido,
         max(p.creado_en) at time zone 'America/Panama' as ultimo_pedido,
         c.creado_en at time zone 'America/Panama' as registrado
  from clientes c
  left join localidades l on l.id = c.localidad_id
  left join zonas z on z.codigo = coalesce(c.zona, l.zona)
  left join pedidos p on p.cliente_id = c.id and p.estado <> 'cancelado'
  group by c.id, l.distrito, l.nombre, l.orden, z.nombre, z.dias, z.orden
  order by z.orden nulls last, l.orden, c.nombre;

create or replace view public.v_pedidos_por_zona with (security_invoker = true) as
  select (p.creado_en at time zone 'America/Panama')::date as fecha,
         coalesce(z.nombre, 'Sin zona') as zona, max(p.dia_entrega) as dia_entrega,
         count(*) as pedidos, count(distinct p.cliente_id) as clientes, sum(p.total) as total
  from pedidos p left join zonas z on z.codigo = p.zona
  where p.estado <> 'cancelado'
  group by 1, 2, z.orden
  order by 1 desc, z.orden nulls last;

revoke all on public.v_pedidos, public.v_clientes, public.v_pedidos_por_zona from anon, authenticated;
