-- ============================================================================
-- 2026-07-15 - Usuarios (app user profiles + roles)
--
-- Adds a profile row per Supabase Auth user so the app can manage users:
--   * super_admin  -> full CRUD over every user (via the service-role client)
--   * user         -> can view / edit only their own profile
--
-- Auth (email + password) still lives in Supabase's built-in auth.users; this
-- table holds the app-level fields (name, phone, dni, role, active) 1:1 with it.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create table if not exists public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  dni         text,
  photo_url   text,
  role        text not null default 'user' check (role in ('super_admin','user')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Idempotent: add photo_url if the table already existed from an earlier run.
alter table public.usuarios add column if not exists photo_url text;

-- Public storage bucket for employee photos. Read is public (so <img> works);
-- uploads go through the service-role client in the app, so no upload policy
-- is needed here.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Auto-create a bare profile whenever an auth user is created. The app then
-- fills name/role/etc. via the service-role client. SECURITY DEFINER so it can
-- insert regardless of RLS.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill a profile for every existing auth user.
insert into public.usuarios (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Ensure there is at least one super admin: promote the earliest account.
-- CHANGE this afterwards if the wrong person was promoted, e.g.:
--   update public.usuarios set role = 'super_admin' where email = 'alejandro@example.com';
update public.usuarios
set role = 'super_admin'
where id = (select id from auth.users order by created_at asc limit 1);

-- ── RLS: self-service only. Admin operations use the service-role client,
--    which BYPASSES RLS, so no "admin sees all" policy is needed here. ──
alter table public.usuarios enable row level security;

drop policy if exists usuarios_select_self on public.usuarios;
create policy usuarios_select_self on public.usuarios
  for select using (auth.uid() = id);

-- A user may update their own row. Role escalation is prevented in the app
-- layer (updateMyProfile never writes `role`); admin edits bypass RLS.
drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self on public.usuarios
  for update using (auth.uid() = id) with check (auth.uid() = id);

notify pgrst, 'reload schema';
