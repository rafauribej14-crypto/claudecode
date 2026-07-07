-- ============================================================================
-- freshapp — Seal the data tables  (STEP 2 of 2)
--
-- Run this ONLY after:
--   1. supabase/accounts.sql has been run,
--   2. the google-auth Edge Function is deployed,
--   3. the new app build is live, and
--   4. you've verified that logging in (username/password AND Google) and data
--      sync both work.
--
-- This removes the open anon policies from user_kv and user_state, so the
-- public/anon key can no longer read or write them directly. All access then
-- goes through kv_pull / kv_push, which require a valid session token.
-- The SECURITY DEFINER functions keep working (they run as the table owner).
-- price_intel stays open on purpose — it's anonymous community data.
-- ============================================================================

drop policy if exists "anon rw user_kv"                     on public.user_kv;
drop policy if exists "anon can read/write by user_id"      on public.user_state;

-- RLS stays ON for both tables; with no anon policies, direct REST access from
-- the browser is denied. To confirm, this should now return 401/empty for anon:
--   select * from public.user_kv limit 1;   (run as anon / from the app)
