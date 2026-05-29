
-- BTG Quality Control v19.5.35 – Systemcenter sidbehörigheter
-- Kör i Supabase SQL Editor efter tidigare Systemcenter-SQL.

create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

create table if not exists public.btg_page_permissions (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null,
  user_id uuid null,
  page_key text not null,
  mode text not null default 'visible' check (mode in ('inherit','visible','hidden','locked')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint btg_page_permissions_scope_chk check (
    (user_id is null and mode in ('visible','hidden','locked'))
    or
    (user_id is not null and mode in ('inherit','visible','hidden','locked'))
  )
);

create unique index if not exists btg_page_permissions_factory_page_uq
  on public.btg_page_permissions(factory_id,page_key)
  where user_id is null;

create unique index if not exists btg_page_permissions_user_page_uq
  on public.btg_page_permissions(factory_id,user_id,page_key)
  where user_id is not null;

alter table public.btg_page_permissions enable row level security;

drop policy if exists btg_page_permissions_select on public.btg_page_permissions;
create policy btg_page_permissions_select
on public.btg_page_permissions
for select
to authenticated
using (
  public.btg_systemcenter_is_superadmin()
  or user_id = auth.uid()
  or user_id is null
);

drop policy if exists btg_page_permissions_write on public.btg_page_permissions;
create policy btg_page_permissions_write
on public.btg_page_permissions
for all
to authenticated
using (public.btg_systemcenter_is_superadmin())
with check (public.btg_systemcenter_is_superadmin());

grant select, insert, update, delete on public.btg_page_permissions to authenticated;

create or replace function public.btg_page_permissions_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists btg_page_permissions_touch_trg on public.btg_page_permissions;
create trigger btg_page_permissions_touch_trg
before update on public.btg_page_permissions
for each row execute function public.btg_page_permissions_touch();

create or replace function public.btg_systemcenter_get_permissions_meta()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_factories jsonb := '[]'::jsonb;
  v_users jsonb := '[]'::jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.factory_name),'[]'::jsonb)
  into v_factories
  from public.btg_systemcenter_list_factories() f;

  select coalesce(jsonb_agg(to_jsonb(u) order by u.factory_name, u.email),'[]'::jsonb)
  into v_users
  from public.btg_systemcenter_list_users() u;

  return jsonb_build_object('factories',v_factories,'users',v_users);
end;
$$;

grant execute on function public.btg_systemcenter_get_permissions_meta() to authenticated;

create or replace function public.btg_systemcenter_get_page_permissions(
  p_factory_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factory jsonb := '{}'::jsonb;
  v_user jsonb := '{}'::jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  select coalesce(jsonb_object_agg(page_key, mode),'{}'::jsonb)
  into v_factory
  from public.btg_page_permissions
  where factory_id=p_factory_id and user_id is null;

  if p_user_id is not null then
    select coalesce(jsonb_object_agg(page_key, mode),'{}'::jsonb)
    into v_user
    from public.btg_page_permissions
    where factory_id=p_factory_id and user_id=p_user_id;
  end if;

  return jsonb_build_object('factory',v_factory,'user',v_user);
end;
$$;

grant execute on function public.btg_systemcenter_get_page_permissions(uuid,uuid) to authenticated;

create or replace function public.btg_systemcenter_set_page_permissions(
  p_factory_id uuid,
  p_user_id uuid default null,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_factory jsonb := coalesce(p_permissions->'factory','{}'::jsonb);
  v_user jsonb := coalesce(p_permissions->'user','{}'::jsonb);
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  delete from public.btg_page_permissions
  where factory_id=p_factory_id and user_id is null;

  for r in select key, value from jsonb_each_text(v_factory)
  loop
    if r.value in ('visible','hidden','locked') then
      insert into public.btg_page_permissions(factory_id,user_id,page_key,mode,created_by)
      values(p_factory_id,null,r.key,r.value,auth.uid());
    end if;
  end loop;

  if p_user_id is not null then
    delete from public.btg_page_permissions
    where factory_id=p_factory_id and user_id=p_user_id;

    for r in select key, value from jsonb_each_text(v_user)
    loop
      if r.value in ('inherit','visible','hidden','locked') then
        insert into public.btg_page_permissions(factory_id,user_id,page_key,mode,created_by)
        values(p_factory_id,p_user_id,r.key,r.value,auth.uid());
      end if;
    end loop;
  end if;

  perform public.btg_systemcenter_log(
    'update_page_permissions',
    case when p_user_id is null then 'factory' else 'user' end,
    coalesce(p_user_id,p_factory_id),
    p_factory_id,
    null,
    p_permissions,
    'Sidbehörigheter uppdaterade'
  );

  return public.btg_systemcenter_get_page_permissions(p_factory_id,p_user_id);
end;
$$;

grant execute on function public.btg_systemcenter_set_page_permissions(uuid,uuid,jsonb) to authenticated;

create or replace function public.btg_get_effective_page_permissions(
  p_factory_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_factory jsonb := '{}'::jsonb;
  v_user jsonb := '{}'::jsonb;
begin
  if v_uid is distinct from auth.uid() and not public.btg_systemcenter_is_superadmin() then
    raise exception 'Du får bara läsa dina egna sidbehörigheter.';
  end if;

  select coalesce(jsonb_object_agg(page_key, mode),'{}'::jsonb)
  into v_factory
  from public.btg_page_permissions
  where factory_id=p_factory_id and user_id is null;

  select coalesce(jsonb_object_agg(page_key, mode),'{}'::jsonb)
  into v_user
  from public.btg_page_permissions
  where factory_id=p_factory_id and user_id=v_uid;

  return jsonb_build_object('factory',v_factory,'user',v_user);
end;
$$;

grant execute on function public.btg_get_effective_page_permissions(uuid,uuid) to authenticated;
