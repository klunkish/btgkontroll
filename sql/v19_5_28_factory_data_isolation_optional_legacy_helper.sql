
-- =========================================================
-- BTG Quality Control v19.5.28
-- Fabriksisolerad data / nya fabriker startar utan ärvd data
--
-- Viktigt:
-- 1) HTML-patchen märker all NY data med aktiv factoryId i app_data.
-- 2) HTML-patchen visar bara data med samma factoryId som vald fabrik.
-- 3) Denna SQL är valfri hjälp för befintlig äldre data som saknar factoryId.
--    Kör INTE denna på en ny tom fabrik om du inte vill tilldela äldre omärkt data dit.
-- =========================================================

grant usage on schema public to authenticated, service_role;

create or replace function public.btg_assign_my_unscoped_core_data_to_factory(p_factory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'Ej inloggad.';
  end if;

  select exists (
    select 1 from public.btg_user_access_profiles p
    where p.user_id = v_uid
      and p.factory_id = p_factory_id
  ) or public.btg_is_superadmin()
  into v_allowed;

  if not coalesce(v_allowed,false) then
    raise exception 'Du saknar behörighet till vald fabrik.';
  end if;

  update public.recipes
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('recipes', v_n);

  update public.materials
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('materials', v_n);

  update public.batches
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('batches', v_n);

  update public.cubes
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('cubes', v_n);

  update public.air
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('air', v_n);

  update public.customers
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('customers', v_n);

  update public.orders
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('orders', v_n);

  update public.control_devices
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('control_devices', v_n);

  update public.diary_entries
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('diary_entries', v_n);

  update public.tasks
  set app_data = coalesce(app_data,'{}'::jsonb) || jsonb_build_object('factoryId', p_factory_id::text, 'factory_id', p_factory_id::text)
  where user_id = v_uid and coalesce(app_data ->> 'factoryId', app_data ->> 'factory_id', '') = '';
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('tasks', v_n);

  return jsonb_build_object('assigned_to_factory', p_factory_id, 'updated', v_counts);
end;
$$;

grant execute on function public.btg_assign_my_unscoped_core_data_to_factory(uuid) to authenticated;

select 'v19.5.28 factory data isolation helper ready' as status;
