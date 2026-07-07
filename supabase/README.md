# Supabase setup — freshapp

Cuentas en la nube (usuario/contraseña **y** Google) con sincronización de datos
protegida por **token de sesión**. El navegador nunca accede directo a las tablas
de datos: inicia sesión, recibe un token, y todo el sync pasa por funciones que
verifican ese token en el servidor.

## Orden de pasos (impórtate seguirlo para no romper el sync)

### 1. Crear tablas y funciones
En **Supabase → SQL Editor → New query**, pega y corre `accounts.sql`.
Crea: tabla `accounts`, tabla `sessions`, y las funciones `app_signup`,
`app_login`, `app_change_password`, `app_set_name`, `kv_pull`, `kv_push`.
Es aditivo: **no toca** `user_kv`, `user_state` ni `price_intel`.

### 2. Desplegar la función Edge de Google
Verifica el login de Google del lado del servidor (no se puede confiar en el
navegador para eso). Desde tu máquina, con el [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
supabase link --project-ref oxkxxvxzrhksbllyhhjg
supabase functions deploy google-auth --no-verify-jwt
# opcional (ya trae el client id de la app por defecto):
# supabase secrets set GOOGLE_CLIENT_ID=<tu-client-id>.apps.googleusercontent.com
```

El código está en `functions/google-auth/index.ts`.
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan solos.

### 3. El código de la app
Ya está desplegado en Vercel (`cookeasy-smart.vercel.app`). Usa las funciones
y la Edge Function de arriba. Si aún no corriste los pasos 1–2, la app **sigue
funcionando** en modo local (sin sync ni cuentas en la nube) — no se rompe.

### 4. Verificar
- Crea una cuenta usuario/contraseña → debe aparecer en `select * from accounts`.
- Inicia sesión con Google → debe sincronizar.
- Cambia algo (ej. presupuesto), entra desde otro dispositivo → debe verse.

### 5. Sellar las tablas (cierre final)
Cuando confirmes que todo funciona, corre `lockdown.sql`. Cierra `user_kv` y
`user_state` para que la anon key ya no pueda leerlas/escribirlas directamente.

## Ver cuentas registradas
Desde el SQL Editor (service role):

```sql
select username, name, created_at from public.accounts order by created_at;
```

Las cuentas de Google no están en `accounts`; viven como sesiones/datos con
`sync_key = g_<google_sub>`.
