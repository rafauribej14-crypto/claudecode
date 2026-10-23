-- =====================================================================
-- Emprende con Gold Mills · Migración 2
-- El celular es el dato madre: identifica la cuenta, sus pedidos y su historial.
-- =====================================================================

-- 1. Crear cuenta ("Soy emprendedor nuevo"). Si el celular ya existe, entra a esa cuenta.
create or replace function public.ingresar_cliente(p_nombre text, p_negocio text, p_celular text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g'); v_nuevo boolean := false;
begin
  if v_cel !~ '^6[0-9]{7}$' then raise exception 'celular_invalido'; end if;
  select * into c from clientes where celular = v_cel;
  if found then
    update clientes
       set ultimo_acceso = now(),
           negocio = coalesce(negocio, nullif(trim(p_negocio), ''))
     where id = c.id returning * into c;
  else
    if length(trim(coalesce(p_nombre,''))) < 2 then raise exception 'nombre_invalido'; end if;
    insert into clientes (nombre, negocio, celular)
    values (trim(p_nombre), nullif(trim(p_negocio), ''), v_cel) returning * into c;
    v_nuevo := true;
  end if;
  return json_build_object(
    'id', c.id, 'token', c.token, 'nombre', c.nombre, 'negocio', c.negocio,
    'celular', c.celular, 'nuevo', v_nuevo, 'ultimo_pedido', _ultimo_pedido_de(c.id));
end $$;

-- 2. Entrar ("Ya tengo cuenta") solo con el celular. No crea cuentas.
drop function if exists public.entrar_cliente(text, text);
create or replace function public.entrar_cliente(p_celular text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare c clientes; v_cel text := regexp_replace(coalesce(p_celular,''), '\D', '', 'g');
begin
  if v_cel !~ '^6[0-9]{7}$' then raise exception 'celular_invalido'; end if;
  select * into c from clientes where celular = v_cel;
  if not found then raise exception 'no_registrado'; end if;
  update clientes set ultimo_acceso = now() where id = c.id returning * into c;
  return json_build_object(
    'id', c.id, 'token', c.token, 'nombre', c.nombre, 'negocio', c.negocio,
    'celular', c.celular, 'nuevo', false, 'ultimo_pedido', _ultimo_pedido_de(c.id));
end $$;

-- 3. Guardar pedido: si el celular ya tiene cuenta, el pedido va a esa cuenta.
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
      insert into clientes (nombre, celular) values (split_part(trim(p_nombre), ' – ', 1), v_cel) returning * into c;
    end if;
    v_token := c.token;
  end if;

  insert into pedidos (cliente_id, nombre, celular, items, total, productos_por_consultar)
  values (c.id, trim(p_nombre), coalesce(c.celular, nullif(v_cel, '')), p_items, round(coalesce(p_total, 0), 2), coalesce(p_consultar, 0))
  returning id into v_id;

  if c.id is not null then update clientes set ultimo_acceso = now() where id = c.id; end if;

  return json_build_object('pedido_id', v_id, 'vinculado', c.id is not null,
    'token', v_token, 'nombre', c.nombre, 'negocio', c.negocio, 'celular', c.celular);
end $$;

-- 4. Historial de compras de la cuenta (más reciente primero)
create or replace function public.mis_pedidos(p_token uuid, p_limite int default 30)
returns json language sql stable security definer set search_path = public, extensions as $$
  select coalesce(json_agg(x order by x.creado_en desc), '[]'::json)
  from (
    select p.id, p.creado_en, p.items, p.total, p.productos_por_consultar, p.estado
    from pedidos p join clientes c on c.id = p.cliente_id
    where c.token = p_token
    order by p.creado_en desc
    limit least(greatest(coalesce(p_limite, 30), 1), 100)
  ) x
$$;

grant execute on function public.entrar_cliente(text) to anon, authenticated;
grant execute on function public.mis_pedidos(uuid, int) to anon, authenticated;
