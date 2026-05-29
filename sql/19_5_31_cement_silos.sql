-- v19.5.31 Cement & Silor
-- Kör denna i Supabase SQL Editor innan du använder modulen första gången.
-- Funktionen är byggd för aktiv fabrik. Fabriksadmin kan se/ändra silos i sin fabrik.

create table if not exists public.cement_silos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factory_id uuid,
  name text not null,
  material_id uuid,
  material_name text not null,
  max_capacity_kg numeric not null default 0,
  start_level_kg numeric not null default 0,
  current_level_kg numeric not null default 0,
  low_warn_pct numeric not null default 20,
  critical_warn_pct numeric not null default 10,
  note text,
  active boolean not null default true,
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cement_silo_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factory_id uuid,
  silo_id uuid not null references public.cement_silos(id) on delete cascade,
  type text not null check (type in ('in','out','adjust')),
  source text not null default 'manual',
  material_id uuid,
  material_name text,
  amount_kg numeric not null default 0,
  reference_table text,
  reference_id uuid,
  note text,
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cement_silos_user_factory on public.cement_silos(user_id, factory_id);
create index if not exists idx_cement_silo_transactions_silo_date on public.cement_silo_transactions(silo_id, created_at desc);
create index if not exists idx_cement_silo_transactions_user_factory on public.cement_silo_transactions(user_id, factory_id);

alter table public.cement_silos enable row level security;
alter table public.cement_silo_transactions enable row level security;

-- Helperlogik i policies:
-- - egen rad är alltid tillåten
-- - rad med factory_id är synlig för medlemmar i samma fabrik
-- - uppdatering/radering tillåts för radens ägare eller admin/fabriksadmin i samma fabrik

do $$ begin
  create policy "cement_silos_select_factory" on public.cement_silos
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silos.factory_id and fm.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_insert_own_factory" on public.cement_silos
  for insert with check (
    auth.uid() = user_id
    and (factory_id is null or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silos.factory_id and fm.user_id = auth.uid()))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_update_owner_or_factory_admin" on public.cement_silos
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silos.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  ) with check (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silos.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_delete_owner_or_factory_admin" on public.cement_silos
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silos.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_select_factory" on public.cement_silo_transactions
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silo_transactions.factory_id and fm.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_insert_own_factory" on public.cement_silo_transactions
  for insert with check (
    auth.uid() = user_id
    and (factory_id is null or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silo_transactions.factory_id and fm.user_id = auth.uid()))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_update_owner_or_factory_admin" on public.cement_silo_transactions
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silo_transactions.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  ) with check (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silo_transactions.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_delete_owner_or_factory_admin" on public.cement_silo_transactions
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = cement_silo_transactions.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

-- Permissions required for Supabase frontend access.
-- RLS policies above still decide which rows are visible/editable.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.cement_silos to authenticated;
grant select, insert, update, delete on table public.cement_silo_transactions to authenticated;
grant select, insert, update, delete on table public.cement_silos to service_role;
grant select, insert, update, delete on table public.cement_silo_transactions to service_role;
