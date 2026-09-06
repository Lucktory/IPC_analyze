-- ============================================================================
-- ENABLE ROW LEVEL SECURITY  (2026-09-05)
-- ============================================================================
-- Run this ONCE in the Supabase SQL editor. It is idempotent: re-running it is
-- safe and makes no further changes.
--
-- WHY
-- ---
-- Postgres creates tables with RLS OFF by default, and db/schema.sql never
-- turned it on for any business table. db/rls-disable.sql additionally turned
-- it off explicitly. Because the app authenticates with the public anon key
-- plus the user's JWT, RLS is what separates "a logged-in user reading data"
-- from "any PostgREST caller reading data".
--
-- Application-layer fixes (the middleware matcher, per-action auth checks) do
-- NOT cover this: PostgREST traffic never reaches the Next.js app, so none of
-- its guards run. RLS is the only control at that layer.
--
-- WHAT THIS DOES
-- --------------
-- For every BASE TABLE in the public schema it enables RLS and grants a
-- permissive floor policy to the `authenticated` role only. Logged-in users of
-- the app keep exactly the access they have today; the `anon` role loses all
-- row access. This is deliberately a floor, not a scoping rule -- narrowing by
-- administration_id is a later, separate change (the app is single-tenant
-- today, so a blanket authenticated policy is not a behaviour change for it).
--
-- Two tables are deliberately EXCLUDED:
--
--   public.usuarios   Already has RLS on with self-scoped policies
--                     (usuarios_select_self / usuarios_update_self). Adding a
--                     blanket `authenticated` policy here would LET EVERY
--                     EMPLOYEE READ EVERY USER ROW -- a regression. Leave it.
--                     (Its separate privilege-escalation bug -- the update
--                     policy not pinning the `role` column -- is fixed in its
--                     own migration, not here.)
--
--   public.audit_log  Already has RLS on with no policies, which is correct:
--                     it is written by SECURITY DEFINER triggers and read only
--                     through the service-role client (lib/audit/queries.ts).
--                     A policy here would widen access, not narrow it.
--
-- The table list is discovered from the catalog rather than hard-coded, so
-- nothing is missed -- including tables created later from the dashboard and
-- the dead ones (rendiciones, rendicion_landlords, liquidacion_lines,
-- liquidacion_payouts, contract_administrators) that carry real data but no
-- application reader. Unlike db/rls-disable.sql -- which names a table that was
-- dropped in June and therefore aborts before doing anything -- this cannot
-- fail on a missing table.
--
-- AFTER RUNNING
-- -------------
--   1. Run the verification query at the bottom. Every row must show
--      rls_enabled = true.
--   2. Click through the app while logged in: /liquidacion, /movimientos,
--      /contratos, /bancos, and one save on a planilla cell. Nothing should
--      change.
--   3. Confirm the anon key now returns nothing:
--        curl "$SUPABASE_URL/rest/v1/landlords?select=name" \
--             -H "apikey: $ANON_KEY"
--      Expect [] instead of the full landlord list.
--   4. Only then rotate the anon key. Rotating before this migration is
--      applied breaks the app without closing anything.
--
-- KNOWN BREAKAGE (dev tooling only, not the app)
-- ----------------------------------------------
-- These scripts talk to production with the ANON key and will start returning
-- zero rows once this runs. Switch them to SUPABASE_SERVICE_ROLE_KEY before or
-- after; they are developer utilities, not part of the deployed app:
--   scripts/migrate-otros-cell-marker.mjs
--   scripts/find-email-pending.mjs
--   scripts/verify-one-contract.ts
-- ============================================================================

do $$
declare
  t record;
  skipped text[] := array['usuarios', 'audit_log'];
begin
  for t in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'                    -- ordinary tables only
      and not (c.relname = any (skipped))
    order by c.relname
  loop
    -- 1. Turn RLS on. No-op when it is already on.
    execute format('alter table public.%I enable row level security', t.table_name);

    -- 2. Permissive floor policy for logged-in users. Dropped first so the
    --    script stays re-runnable and so re-running cannot stack duplicates.
    execute format('drop policy if exists %I on public.%I',
                   t.table_name || '_authenticated_all', t.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t.table_name || '_authenticated_all', t.table_name);

    raise notice 'RLS enabled + authenticated policy created on public.%', t.table_name;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- VERIFICATION -- every business table must report rls_enabled = true.
-- usuarios and audit_log are expected here too (they were already enabled).
-- policy_count = 0 on audit_log is CORRECT (service-role only access).
-- ----------------------------------------------------------------------------
select
  c.relname                                as table_name,
  c.relrowsecurity                         as rls_enabled,
  (select count(*) from pg_policies p
    where p.schemaname = 'public'
      and p.tablename  = c.relname)        as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, c.relname;
