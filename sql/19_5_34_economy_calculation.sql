-- v19.5.34 Ekonomi & Kalkyl
-- Kör denna i Supabase SQL Editor innan du använder ekonomimodulen.
-- Modulen använder materialpriser + utpris per recept och räknar analys från tillverkningsjournalen.

create table if not exists public.material_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factory_id uuid,
  material_ref text not null,
  material_name text not null,
  material_type text,
  price_value numeric not null default 0,
  price_unit text not null default 'kr/kg',
  price_per_base numeric not null default 0,
  valid_from date not null default current_date,
  note text,
  active boolean not null default true,
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_sales_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factory_id uuid,
  recipe_ref text not null,
  recipe_name text not null,
  strength text,
  sales_price_per_m3 numeric not null default 0,
  valid_from date not null default current_date,
  note text,
  active boolean not null default true,
  app_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_material_prices_user_factory on public.material_prices(user_id, factory_id);
create index if not exists idx_material_prices_factory_ref on public.material_prices(factory_id, material_ref);
create index if not exists idx_recipe_sales_prices_user_factory on public.recipe_sales_prices(user_id, factory_id);
create index if not exists idx_recipe_sales_prices_factory_ref on public.recipe_sales_prices(factory_id, recipe_ref);

create or replace function public.btg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger trg_material_prices_updated_at before update on public.material_prices
  for each row execute function public.btg_set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_recipe_sales_prices_updated_at before update on public.recipe_sales_prices
  for each row execute function public.btg_set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.material_prices enable row level security;
alter table public.recipe_sales_prices enable row level security;

-- Samma princip som övriga fabriksmoduler:
-- egen rad tillåts alltid, och fabrikens medlemmar kan läsa rader på samma factory_id.
-- ändring/radering begränsas till radens ägare eller fabriksadmin/superadmin i samma fabrik.

do $$ begin
  create policy "material_prices_select_factory" on public.material_prices
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = material_prices.factory_id and fm.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "material_prices_insert_own_factory" on public.material_prices
  for insert with check (
    auth.uid() = user_id
    and (factory_id is null or exists (select 1 from public.factory_members fm where fm.factory_id = material_prices.factory_id and fm.user_id = auth.uid()))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "material_prices_update_owner_or_admin" on public.material_prices
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = material_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  ) with check (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = material_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "material_prices_delete_owner_or_admin" on public.material_prices
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = material_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "recipe_sales_prices_select_factory" on public.recipe_sales_prices
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = recipe_sales_prices.factory_id and fm.user_id = auth.uid())
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "recipe_sales_prices_insert_own_factory" on public.recipe_sales_prices
  for insert with check (
    auth.uid() = user_id
    and (factory_id is null or exists (select 1 from public.factory_members fm where fm.factory_id = recipe_sales_prices.factory_id and fm.user_id = auth.uid()))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "recipe_sales_prices_update_owner_or_admin" on public.recipe_sales_prices
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = recipe_sales_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  ) with check (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = recipe_sales_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "recipe_sales_prices_delete_owner_or_admin" on public.recipe_sales_prices
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from public.factory_members fm where fm.factory_id = recipe_sales_prices.factory_id and fm.user_id = auth.uid() and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin'))
  );
exception when duplicate_object then null; end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.material_prices to authenticated;
grant select, insert, update, delete on table public.recipe_sales_prices to authenticated;
grant select, insert, update, delete on table public.material_prices to service_role;
grant select, insert, update, delete on table public.recipe_sales_prices to service_role;
