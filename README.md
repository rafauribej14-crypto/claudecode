# Emprende con Gold Mills

Catálogo web de insumos de panadería de EPA Bakery y Gold Mills. El emprendedor arma su pedido y lo envía por WhatsApp a su asesor de ruta (+507 6757-7826).

## Qué hay en esta rama

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página completa |
| `img/` | Fotos de producto (nombradas por código) y logo |
| `supabase/esquema.sql` | Base de datos: clientes, pedidos y funciones seguras |
| `supabase/02_historial_y_entrada.sql` | El celular como dato madre, entrada con solo el celular e historial de compras |
| `supabase/03_zonas_y_localidades.sql` | Zonas de entrega, localidades de Panamá y vistas para programar la ruta |
| `netlify.toml` | Publicación en Netlify, sin compilación |

## Memoria de clientes

- **El celular es el dato madre.** "Soy emprendedor nuevo" crea la cuenta; "Ya tengo cuenta" pide solo el celular y abre el historial y la información de la cuenta.
- **Mis compras** muestra cada pedido con fecha, estado y detalle, y permite volver a pedirlo.
- Al enviar por WhatsApp la canasta se vacía. **Cerrar sesión** borra la cuenta y la canasta del teléfono.
- Cada vez que toca **Enviar pedido por WhatsApp**, el pedido queda guardado.
- En la próxima visita aparece **Repetir mi último pedido**, que llena la canasta con lo mismo y los precios de hoy.
- Si el cliente no tiene internet al enviar, el pedido queda pendiente y se sube solo la próxima vez que abra la página.

## Supabase

Proyecto conectado: `emprende-con-goldmills` (us-east-1), `https://wajzboetmyyyhnggjice.supabase.co`. La página usa la llave pública anon, que puede ir en el código del navegador.

### Para montar en otro proyecto

1. En Supabase, crear el proyecto.
2. Abrir **SQL Editor → New query**, pegar `supabase/esquema.sql` y ejecutar con **Run**. Repetir con `supabase/02_historial_y_entrada.sql` y `supabase/03_zonas_y_localidades.sql`.
3. En **Project Settings → API**, copiar la **Project URL** y la llave **anon public**.
4. En `index.html`, pegar ambas en `SUPABASE_URL` y `SUPABASE_KEY`.

Mientras esas dos líneas estén vacías, la página funciona igual, pero recuerda al cliente solo en su propio celular.

## Dónde ver los pedidos

En Supabase, **Table Editor**:
- `v_pedidos`: todos los pedidos con fecha de Panamá, cliente, negocio, total y estado.
- `v_productos_pedidos`: unidades pedidas por producto.

## Seguridad

La página pública no puede leer las tablas. Solo puede usar tres funciones: `ingresar_cliente`, `enviar_pedido` y `ultimo_pedido`. Para ver el último pedido de un cliente hace falta la llave privada que se guarda en su celular. Si alguien escribe un celular ajeno con otro nombre, la página no lo deja entrar.

## Zonas de entrega

- Al crear su cuenta, el cliente elige su corregimiento (26 del distrito de Panamá) o su distrito (La Chorrera, Arraiján, San Miguelito, Chepo), y escribe su barrio o referencia.
- La zona y el día salen de la tabla `localidades` → `zonas`. Para cambiar un día: **Table Editor → zonas → dias**. Para mover un corregimiento de zona: **Table Editor → localidades → zona**.
- Cada pedido guarda la zona, el día y la localidad del momento.
- Vistas para programar: `v_pedidos_por_zona` (pedidos por día y zona), `v_clientes` (clientes con su zona) y `v_pedidos` (con zona, día y localidad).
