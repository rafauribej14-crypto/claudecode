# Configuración de Supabase — freshapp

Cuentas en la nube (usuario/contraseña **y** Google) con sincronización de datos
protegida por **token de sesión**. Toda cuenta creada se guarda en la nube con
toda su información, así que el usuario puede iniciar sesión desde cualquier
dispositivo y ya tiene todo guardado y personalizado.

> ⚠️ **Qué código va en cada lugar (no los mezcles):**
> - `setup.sql` es **SQL** → va en el **SQL Editor**.
> - `functions/google-auth/index.ts` es **TypeScript (Deno)** → va en
>   **Edge Functions**, NUNCA en el SQL Editor (si lo pegas ahí verás
>   `syntax error at or near "//"`).

## Paso 1 — Correr `setup.sql` (obligatorio, en el SQL Editor)

En **Supabase → SQL Editor → New query**, pega **todo** `setup.sql` y dale **Run**.

Es un único archivo, idempotente y seguro de re-ejecutar: usa `if not exists` y
`drop … if exists`, así que **no aborta a medias ni borra datos** existentes.
Crea las tablas (`accounts`, `sessions`, `user_kv`, `user_state`, `price_intel`)
y las funciones (`app_signup`, `app_login`, `app_change_password`, `app_set_name`,
`kv_pull`, `kv_push`). Con solo este paso, **las cuentas usuario/contraseña ya
se guardan en la nube y persisten** entre dispositivos.

### Verifica que quedó bien
Corre estas líneas (una por una) en el SQL Editor:

```sql
-- crea una cuenta de prueba y devuelve sync_key + token
select * from public.app_signup('prueba_qa', 'clave1234', 'Prueba');
-- debe aparecer en la tabla de cuentas
select username, name, created_at from public.accounts order by created_at;
-- login: devuelve un token nuevo si la contraseña es correcta
select * from public.app_login('prueba_qa', 'clave1234');
-- limpieza opcional
delete from public.accounts where username = 'prueba_qa';
```

Si `app_signup` devuelve una fila con `sync_key` y `token`, **ya está arreglado**:
las cuentas se guardan en la nube.

## Login con Google — ya NO necesita Edge Function

El login con Google funciona con **solo `setup.sql`**. El navegador decodifica
el JWT de Google y llama la función `app_google_login`, que emite el token de
sesión (igual que usuario/contraseña). No hay que desplegar nada extra.

> La carpeta `functions/google-auth/` se conserva solo como opción avanzada por
> si algún día quieres verificar el JWT de Google del lado del servidor. NO es
> necesaria para que el login con Google funcione.

## Ver cuentas registradas

Desde el SQL Editor (rol service):

```sql
select username, name, created_at from public.accounts order by created_at;
```

Las cuentas de Google no están en `accounts`; viven como datos con
`sync_key = g_<google_sub>` en `user_kv`.

## Cómo funciona (resumen)

1. **Registro/login** → la app llama `app_signup`/`app_login`; la BD verifica con
   bcrypt y devuelve un **token de sesión**.
2. La app guarda ese token y **sincroniza los datos** (perfil, inventario,
   recetas, presupuesto…) con `kv_push`/`kv_pull`, que resuelven el token a un
   `sync_key` del lado del servidor.
3. En otro dispositivo, al iniciar sesión con el mismo usuario/contraseña, la
   app recibe un token y `kv_pull` restaura toda su información.
