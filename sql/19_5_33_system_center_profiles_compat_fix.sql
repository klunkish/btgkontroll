-- BTG Quality Control v19.5.33 – Systemcenter profiles compatibility fix
-- Kör denna om Systemcenter visar: column p.created_at does not exist
-- Fixen ersätter användarlistfunktionen så den inte kräver created_at/updated_at i btg_user_access_profiles.

create or replace function public.btg_systemcenter_list_users()
returns table(
  profile_id uuid,
  user_id uuid,
  email text,
  factory_id uuid,
  factory_name text,
  role_code text,
  activated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  return query
  select
    p.id,
    p.user_id,
    u.email::text,
    p.factory_id,
    f.name,
    p.role_code,
    p.activated_at,
    p.activated_at as created_at,
    null::timestamptz as updated_at
  from public.btg_user_access_profiles p
  left join auth.users u on u.id = p.user_id
  left join public.factories f on f.id = p.factory_id
  order by f.name nulls last, u.email nulls last;
end;
$$;

grant execute on function public.btg_systemcenter_list_users() to authenticated;
