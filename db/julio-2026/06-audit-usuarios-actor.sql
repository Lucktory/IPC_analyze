-- ============================================================================
-- 06 - Audit: attribute usuarios admin writes to the real actor
--
-- Admin user-management writes (role / email / active / photo changes, and
-- deletes) run through the service-role client, so the generic audit trigger
-- recorded them with a NULL actor and the Actividades view showed "Sistema".
--
-- Those actions are now logged in the APP layer with the real acting admin
-- (see lib/usuarios/actions.ts -> logAudit). To avoid a duplicate "Sistema"
-- row, the usuarios trigger now uses a dedicated function that SKIPS writes
-- with no real user, while still logging self edits (session client) with the
-- real actor exactly as before.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================================

create or replace function public.audit_usuarios_row()
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

  -- No real user (service-role / SQL editor / migration): skip. Those admin
  -- actions are logged in the app layer with the real actor, so skipping here
  -- prevents the useless "Sistema" duplicate.
  if v_actor is null then
    return coalesce(NEW, OLD);
  end if;

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

drop trigger if exists audit_usuarios on public.usuarios;
create trigger audit_usuarios after update or delete on public.usuarios
  for each row execute function public.audit_usuarios_row();

notify pgrst, 'reload schema';
