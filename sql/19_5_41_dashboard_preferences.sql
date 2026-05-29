
-- BTG Quality Control v19.5.41 – Dashboard preferences / supporttabell
-- Valfri men rekommenderad. Frontend v1 sparar även i localStorage per användare/fabrik.
create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

create table if not exists public.btg_user_dashboard_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  factory_id uuid,
  selected_widgets jsonb not null default '[]'::jsonb,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, factory_id)
);

alter table public.btg_user_dashboard_preferences enable row level security;

drop policy if exists btg_user_dashboard_preferences_select on public.btg_user_dashboard_preferences;
create policy btg_user_dashboard_preferences_select
on public.btg_user_dashboard_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  or public.btg_systemcenter_is_superadmin()
);

drop policy if exists btg_user_dashboard_preferences_write on public.btg_user_dashboard_preferences;
create policy btg_user_dashboard_preferences_write
on public.btg_user_dashboard_preferences
for all
to authenticated
using (
  user_id = auth.uid()
  or public.btg_systemcenter_is_superadmin()
)
with check (
  user_id = auth.uid()
  or public.btg_systemcenter_is_superadmin()
);

grant select, insert, update, delete on public.btg_user_dashboard_preferences to authenticated;

create or replace function public.btg_user_dashboard_preferences_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists btg_user_dashboard_preferences_touch_trg on public.btg_user_dashboard_preferences;
create trigger btg_user_dashboard_preferences_touch_trg
before update on public.btg_user_dashboard_preferences
for each row execute function public.btg_user_dashboard_preferences_touch();
