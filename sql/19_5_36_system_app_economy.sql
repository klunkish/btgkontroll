
-- BTG Quality Control v19.5.36 – Systemcenter Applikationsekonomi
-- Kör i Supabase SQL Editor efter tidigare Systemcenter-SQL.

create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

create table if not exists public.system_app_economy_settings (
  id boolean primary key default true,
  target_margin_percent numeric not null default 35,
  vat_percent numeric not null default 25,
  min_monthly_price numeric not null default 0,
  support_markup_percent numeric not null default 0,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_app_economy_settings_one_row check (id = true)
);

insert into public.system_app_economy_settings(id)
values(true)
on conflict (id) do nothing;

create table if not exists public.system_app_economy_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  cost_type text not null default 'fixed' check (cost_type in ('fixed','per_factory','per_user')),
  monthly_amount numeric not null default 0,
  note text,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_app_economy_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  monthly_price numeric not null default 0,
  assigned_factories integer not null default 0,
  max_users integer not null default 0,
  description text,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_app_economy_settings enable row level security;
alter table public.system_app_economy_costs enable row level security;
alter table public.system_app_economy_plans enable row level security;

drop policy if exists system_app_economy_settings_superadmin on public.system_app_economy_settings;
create policy system_app_economy_settings_superadmin
on public.system_app_economy_settings
for all to authenticated
using (public.btg_systemcenter_is_superadmin())
with check (public.btg_systemcenter_is_superadmin());

drop policy if exists system_app_economy_costs_superadmin on public.system_app_economy_costs;
create policy system_app_economy_costs_superadmin
on public.system_app_economy_costs
for all to authenticated
using (public.btg_systemcenter_is_superadmin())
with check (public.btg_systemcenter_is_superadmin());

drop policy if exists system_app_economy_plans_superadmin on public.system_app_economy_plans;
create policy system_app_economy_plans_superadmin
on public.system_app_economy_plans
for all to authenticated
using (public.btg_systemcenter_is_superadmin())
with check (public.btg_systemcenter_is_superadmin());

grant select, insert, update, delete on public.system_app_economy_settings to authenticated;
grant select, insert, update, delete on public.system_app_economy_costs to authenticated;
grant select, insert, update, delete on public.system_app_economy_plans to authenticated;

create or replace function public.system_app_economy_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists system_app_economy_settings_touch on public.system_app_economy_settings;
create trigger system_app_economy_settings_touch before update on public.system_app_economy_settings
for each row execute function public.system_app_economy_touch();

drop trigger if exists system_app_economy_costs_touch on public.system_app_economy_costs;
create trigger system_app_economy_costs_touch before update on public.system_app_economy_costs
for each row execute function public.system_app_economy_touch();

drop trigger if exists system_app_economy_plans_touch on public.system_app_economy_plans;
create trigger system_app_economy_plans_touch before update on public.system_app_economy_plans
for each row execute function public.system_app_economy_touch();

create or replace function public.btg_systemcenter_app_economy_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factories_total bigint := 0;
  v_active_factories bigint := 0;
  v_users_total bigint := 0;
begin
  if to_regclass('public.factories') is not null then
    execute 'select count(*) from public.factories' into v_factories_total;
    execute 'select count(*) from public.factories where coalesce(status,''active'')=''active'' or coalesce(active,true)=true' into v_active_factories;
  end if;

  if to_regclass('public.btg_user_access_profiles') is not null then
    execute 'select count(*) from public.btg_user_access_profiles' into v_users_total;
  end if;

  return jsonb_build_object(
    'factories_total', coalesce(v_factories_total,0),
    'active_factories', coalesce(v_active_factories,0),
    'users_total', coalesce(v_users_total,0)
  );
end;
$$;

grant execute on function public.btg_systemcenter_app_economy_usage() to authenticated;

create or replace function public.btg_systemcenter_app_economy_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb := '{}'::jsonb;
  v_costs jsonb := '[]'::jsonb;
  v_plans jsonb := '[]'::jsonb;
  v_usage jsonb := '{}'::jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  select to_jsonb(s) into v_settings
  from public.system_app_economy_settings s
  where s.id=true;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.category,c.name),'[]'::jsonb)
  into v_costs
  from public.system_app_economy_costs c
  where c.is_active=true;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.monthly_price,p.name),'[]'::jsonb)
  into v_plans
  from public.system_app_economy_plans p
  where p.is_active=true;

  v_usage := public.btg_systemcenter_app_economy_usage();

  return jsonb_build_object(
    'settings',coalesce(v_settings,'{}'::jsonb),
    'costs',v_costs,
    'plans',v_plans,
    'usage',v_usage
  );
end;
$$;

grant execute on function public.btg_systemcenter_app_economy_get() to authenticated;

create or replace function public.btg_systemcenter_app_economy_save_cost(
  p_id uuid default null,
  p_name text default null,
  p_category text default null,
  p_cost_type text default 'fixed',
  p_monthly_amount numeric default 0,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Namn krävs.'; end if;

  if p_id is null then
    insert into public.system_app_economy_costs(name,category,cost_type,monthly_amount,note,created_by)
    values(trim(p_name),p_category,p_cost_type,coalesce(p_monthly_amount,0),p_note,auth.uid())
    returning id into v_id;
  else
    update public.system_app_economy_costs
    set name=trim(p_name), category=p_category, cost_type=p_cost_type, monthly_amount=coalesce(p_monthly_amount,0), note=p_note
    where id=p_id
    returning id into v_id;
  end if;

  perform public.btg_systemcenter_log('save_app_economy_cost','system_app_economy_cost',v_id,null,null,jsonb_build_object('name',p_name,'amount',p_monthly_amount),'Applikationskostnad sparad');
  return v_id;
end;
$$;

grant execute on function public.btg_systemcenter_app_economy_save_cost(uuid,text,text,text,numeric,text) to authenticated;

create or replace function public.btg_systemcenter_app_economy_save_plan(
  p_id uuid default null,
  p_name text default null,
  p_monthly_price numeric default 0,
  p_assigned_factories integer default 0,
  p_max_users integer default 0,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Namn krävs.'; end if;

  if p_id is null then
    insert into public.system_app_economy_plans(name,monthly_price,assigned_factories,max_users,description,created_by)
    values(trim(p_name),coalesce(p_monthly_price,0),coalesce(p_assigned_factories,0),coalesce(p_max_users,0),p_description,auth.uid())
    returning id into v_id;
  else
    update public.system_app_economy_plans
    set name=trim(p_name), monthly_price=coalesce(p_monthly_price,0), assigned_factories=coalesce(p_assigned_factories,0), max_users=coalesce(p_max_users,0), description=p_description
    where id=p_id
    returning id into v_id;
  end if;

  perform public.btg_systemcenter_log('save_app_economy_plan','system_app_economy_plan',v_id,null,null,jsonb_build_object('name',p_name,'price',p_monthly_price),'Prisplan sparad');
  return v_id;
end;
$$;

grant execute on function public.btg_systemcenter_app_economy_save_plan(uuid,text,numeric,integer,integer,text) to authenticated;

create or replace function public.btg_systemcenter_app_economy_save_settings(
  p_target_margin_percent numeric default 35,
  p_vat_percent numeric default 25,
  p_min_monthly_price numeric default 0,
  p_support_markup_percent numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;

  insert into public.system_app_economy_settings(id,target_margin_percent,vat_percent,min_monthly_price,support_markup_percent,updated_by)
  values(true,coalesce(p_target_margin_percent,35),coalesce(p_vat_percent,25),coalesce(p_min_monthly_price,0),coalesce(p_support_markup_percent,0),auth.uid())
  on conflict (id) do update
  set target_margin_percent=excluded.target_margin_percent,
      vat_percent=excluded.vat_percent,
      min_monthly_price=excluded.min_monthly_price,
      support_markup_percent=excluded.support_markup_percent,
      updated_by=auth.uid(),
      updated_at=now();

  perform public.btg_systemcenter_log('save_app_economy_settings','system_app_economy_settings',null,null,null,jsonb_build_object('target_margin_percent',p_target_margin_percent),'Applikationsekonomi-inställningar sparade');

  return (select to_jsonb(s) from public.system_app_economy_settings s where s.id=true);
end;
$$;

grant execute on function public.btg_systemcenter_app_economy_save_settings(numeric,numeric,numeric,numeric) to authenticated;
