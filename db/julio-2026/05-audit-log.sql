-- ============================================================================
-- 2026-07-15 - Audit log (activity tracking: who did what, when)
--
-- Append-only record of every data change plus auth/session events.
--   * Data changes  -> captured AUTOMATICALLY by a generic AFTER trigger on
--                      every business table (before/after as jsonb, actor from
--                      the session JWT). Works for writes made through the
--                      session client (anon key + user JWT), which is how the
--                      app mutates data.
--   * Auth / user   -> written by the app layer (lib/audit/log.ts) for login,
--                      logout and the usuarios admin actions, which run through
--                      the service-role client where the JWT actor is NULL.
--
-- The table is append-only and locked down: RLS is on with NO policies, so the
-- anon/authenticated API roles cannot read or write it. The trigger is SECURITY
-- DEFINER (inserts as owner, bypassing RLS) and the app reads/writes it only via
-- the service-role client, gated by requireSuperAdmin().
--
-- Idempotent. ASCII only.
-- ============================================================================

create table if not exists public.audit_log (
  id           bigserial primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,                 -- auth.users id; NULL = system / SQL editor / migration
  actor_email  text,
  action       text not null,        -- insert | update | delete | login | logout | user.create | ...
  entity_type  text not null,        -- table name, or 'session' / 'auth'
  entity_id    text,                 -- affected row id (text to fit any pk type)
  summary      text,                 -- optional human label (app-level events set it)
  before       jsonb,                -- row state before (update/delete)
  after        jsonb,                -- row state after (insert/update)
  source       text not null default 'trigger'   -- 'trigger' | 'app'
);

create index if not exists idx_audit_log_occurred on public.audit_log (occurred_at desc);
create index if not exists idx_audit_log_actor    on public.audit_log (actor_id);
create index if not exists idx_audit_log_entity   on public.audit_log (entity_type, entity_id);
create index if not exists idx_audit_log_action   on public.audit_log (action);

-- ── Generic row-audit trigger. Actor comes from the request JWT claims (set by
--    PostgREST for session-client writes). NULL when the write is service-role,
--    the SQL editor, or a seed script. ──
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims json;
  v_actor  uuid;
  v_email  text;
begin
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  exception when others then
    v_claims := null;
  end;
  v_actor := nullif(v_claims ->> 'sub', '')::uuid;
  v_email := v_claims ->> 'email';

  insert into public.audit_log
    (occurred_at, actor_id, actor_email, action, entity_type, entity_id, before, after, source)
  values (
    now(),
    v_actor,
    v_email,
    lower(tg_op),
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(OLD) ->> 'id') else (to_jsonb(NEW) ->> 'id') end,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(NEW) else null end,
    'trigger'
  );
  return coalesce(NEW, OLD);
end;
$$;

-- Attach to every business table that exists. usuarios is intentionally EXCLUDED
-- (its admin writes are service-role, so they're logged in the app layer with
-- the real actor). audit_log excludes itself.
do $$
declare t text;
begin
  foreach t in array array[
    'transactions','contracts','liquidaciones','liquidacion_lines','adjustments',
    'contract_landlords','contract_tenants','contract_administrators','contract_period_notes',
    'contract_events','contract_recurring_charges','properties','property_landlords',
    'landlords','tenants','banks','bank_accounts'
  ]
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
      execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
    end if;
  end loop;
end;
$$;

-- usuarios: UPDATE + DELETE only. Creation is captured as a 'signup' on
-- auth.users below, so we skip INSERT here to avoid a duplicate row. Self edits
-- (session client) get the real actor; admin edits (service-role) are NULL actor.
drop trigger if exists audit_usuarios on public.usuarios;
create trigger audit_usuarios after update or delete on public.usuarios
  for each row execute function public.audit_row();

-- ── auth.users: signup + login, entirely in the database ──
-- signup  = a row is inserted into auth.users (actor = the new user).
-- login   = last_sign_in_at changes (GoTrue stamps it on each password sign-in).
create or replace function public.audit_auth_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, source)
    values (new.id, new.email, 'signup', 'auth', new.id::text, 'Alta de cuenta', 'trigger');
  elsif tg_op = 'UPDATE' and new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, summary, source)
    values (new.id, new.email, 'login', 'session', new.id::text, 'Inicio de sesion en el sistema', 'trigger');
  end if;
  return new;
end;
$$;

drop trigger if exists audit_auth_signup on auth.users;
create trigger audit_auth_signup after insert on auth.users
  for each row execute function public.audit_auth_event();

drop trigger if exists audit_auth_login on auth.users;
create trigger audit_auth_login after update on auth.users
  for each row execute function public.audit_auth_event();

-- Lock it down: RLS on, no policies -> anon/authenticated cannot touch it via the
-- API. The trigger (security definer) and the service-role client still work.
alter table public.audit_log enable row level security;
revoke update, delete on public.audit_log from anon, authenticated;

notify pgrst, 'reload schema';
