# Emprende con Gold Mills

Catálogo web de insumos de panadería de EPA Bakery y Gold Mills. El emprendedor arma su pedido y lo envía por WhatsApp a su asesor de ruta (+507 6757-7826).

## Qué hay en esta rama

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página completa |
| `img/` | Fotos de producto (nombradas por código) y logo |
| `supabase/esquema.sql` | Base de datos: clientes, pedidos y funciones seguras |
| `netlify.toml` | Publicación en Netlify, sin compilación |

## Memoria de clientes

- El cliente entra con **nombre + celular**. Si ya existe, la página lo reconoce en cualquier celular.
- Cada vez que toca **Enviar pedido por WhatsApp**, el pedido queda guardado.
- En la próxima visita aparece **Repetir mi último pedido**, que llena la canasta con lo mismo y los precios de hoy.
- Si el cliente no tiene internet al enviar, el pedido queda pendiente y se sube solo la próxima vez que abra la página.

## Encender Supabase (una sola vez)

1. En Supabase, crear el proyecto.
2. Abrir **SQL Editor → New query**, pegar `supabase/esquema.sql` y ejecutar con **Run**.
3. En **Project Settings → API**, copiar la **Project URL** y la llave **anon public**.
4. En `index.html`, pegar ambas en `SUPABASE_URL` y `SUPABASE_KEY`.

Mientras esas dos líneas estén vacías, la página funciona igual, pero recuerda al cliente solo en su propio celular.

## Dónde ver los pedidos

En Supabase, **Table Editor**:
- `v_pedidos`: todos los pedidos con fecha de Panamá, cliente, negocio, total y estado.
- `v_productos_pedidos`: unidades pedidas por producto.

## Seguridad

La página pública no puede leer las tablas. Solo puede usar tres funciones: `ingresar_cliente`, `enviar_pedido` y `ultimo_pedido`. Para ver el último pedido de un cliente hace falta la llave privada que se guarda en su celular. Si alguien escribe un celular ajeno con otro nombre, la página no lo deja entrar.
