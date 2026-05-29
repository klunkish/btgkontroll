
-- BTG QC v19.5.57 – Hjälp om Ta bort silo får RLS/permission error
-- Kör bara om knappen "Ta bort silo" ger permission denied / RLS-fel.

-- Kontrollera befintliga policies:
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname='public'
  and tablename in ('cement_silos','cement_silo_transactions')
order by tablename, policyname;

-- Exempelpolicy för att låta inloggade användare ta bort sina egna silos.
-- Anpassa om du vill att bara superadmin/fabriksadmin ska få ta bort.
drop policy if exists "cement_silos_delete_own" on public.cement_silos;
create policy "cement_silos_delete_own"
on public.cement_silos
for delete
to authenticated
using (user_id = auth.uid());

-- Om ni använder factory_id och vill ge admin bredare delete-rätt bör det kopplas mot era profiles/roles.
