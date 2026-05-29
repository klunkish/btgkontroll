-- v19.5.31 Cement & Silor - permissions fix
-- Kör denna i Supabase SQL Editor om appen visar:
-- "permission denied for table cement_silos" eller "Har du kört SQL?"
--
-- Detta ger inloggade användare rätt att använda tabellerna.
-- RLS-policies styr fortfarande vilka rader användaren får se/ändra.

-- Säkerställ att RLS är aktivt
alter table if exists public.cement_silos enable row level security;
alter table if exists public.cement_silo_transactions enable row level security;

-- Ge Supabase authenticated-rollen tabellrättigheter.
-- Utan dessa kan RLS-policies inte ens utvärderas från frontend.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.cement_silos to authenticated;
grant select, insert, update, delete on table public.cement_silo_transactions to authenticated;

-- Om anon av misstag fått rättigheter: dra tillbaka skrivåtkomst.
revoke insert, update, delete on table public.cement_silos from anon;
revoke insert, update, delete on table public.cement_silo_transactions from anon;

-- Tillåt service_role full åtkomst för serverjobb/backup/RPC.
grant select, insert, update, delete on table public.cement_silos to service_role;
grant select, insert, update, delete on table public.cement_silo_transactions to service_role;

-- Säkerställ policies om original-SQL inte hann skapa dem.
do $$ begin
  create policy "cement_silos_select_factory" on public.cement_silos
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silos.factory_id
        and fm.user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_insert_own_factory" on public.cement_silos
  for insert with check (
    auth.uid() = user_id
    and (
      factory_id is null
      or exists (
        select 1 from public.factory_members fm
        where fm.factory_id = cement_silos.factory_id
          and fm.user_id = auth.uid()
      )
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_update_owner_or_factory_admin" on public.cement_silos
  for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silos.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  ) with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silos.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silos_delete_owner_or_factory_admin" on public.cement_silos
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silos.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_select_factory" on public.cement_silo_transactions
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silo_transactions.factory_id
        and fm.user_id = auth.uid()
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_insert_own_factory" on public.cement_silo_transactions
  for insert with check (
    auth.uid() = user_id
    and (
      factory_id is null
      or exists (
        select 1 from public.factory_members fm
        where fm.factory_id = cement_silo_transactions.factory_id
          and fm.user_id = auth.uid()
      )
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_update_owner_or_factory_admin" on public.cement_silo_transactions
  for update using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silo_transactions.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  ) with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silo_transactions.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cement_silo_transactions_delete_owner_or_factory_admin" on public.cement_silo_transactions
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.factory_members fm
      where fm.factory_id = cement_silo_transactions.factory_id
        and fm.user_id = auth.uid()
        and lower(coalesce(fm.role,'')) in ('admin','fabriksadmin','superadmin')
    )
  );
exception when duplicate_object then null; end $$;

-- Snabb kontroll: dessa frågor ska ge rader om grants är på plats.
-- select grantee, table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema='public'
--   and table_name in ('cement_silos','cement_silo_transactions')
--   and grantee in ('authenticated','service_role')
-- order by table_name, grantee, privilege_type;
