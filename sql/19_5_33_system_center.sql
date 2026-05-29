-- BTG Quality Control v19.5.33 – Systemcenter / Owner Console
-- Kör i Supabase SQL Editor. Behövs för Systemcenter, fabriksstatus, loggning och användningsstatistik.

create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

-- Superadmin-kontroll. Lägg till fler e-postadresser här vid behov.
create or replace function public.btg_systemcenter_is_superadmin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) in ('j.ottosson53@gmail.com')
  )
  or exists (
    select 1 from public.btg_user_access_profiles p
    where p.user_id = auth.uid()
      and upper(coalesce(p.role_code,'')) = 'SUPERADMIN'
  );
$$;

grant execute on function public.btg_systemcenter_is_superadmin() to authenticated;

alter table if exists public.factories add column if not exists status text not null default 'active';
alter table if exists public.factories add column if not exists plan text;
alter table if exists public.factories add column if not exists max_users integer;
alter table if exists public.factories add column if not exists locked_reason text;
alter table if exists public.factories add column if not exists locked_until timestamptz;
alter table if exists public.factories add column if not exists public_message text;
alter table if exists public.factories add column if not exists internal_note text;
alter table if exists public.factories add column if not exists contact_email text;
alter table if exists public.factories add column if not exists updated_at timestamptz not null default now();

create table if not exists public.system_admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  factory_id uuid,
  before_data jsonb,
  after_data jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.system_admin_logs enable row level security;

do $$ begin
  create policy "system_admin_logs_superadmin_select" on public.system_admin_logs
  for select using (public.btg_systemcenter_is_superadmin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "system_admin_logs_superadmin_insert" on public.system_admin_logs
  for insert with check (public.btg_systemcenter_is_superadmin());
exception when duplicate_object then null; end $$;

grant select, insert on table public.system_admin_logs to authenticated;

do $$ begin
  create index if not exists idx_system_admin_logs_created on public.system_admin_logs(created_at desc);
  create index if not exists idx_system_admin_logs_factory on public.system_admin_logs(factory_id, created_at desc);
exception when undefined_table then null; end $$;

create or replace function public.btg_systemcenter_log(p_action text, p_target_type text default null, p_target_id uuid default null, p_factory_id uuid default null, p_before jsonb default null, p_after jsonb default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.btg_systemcenter_is_superadmin() then
    raise exception 'Endast superadmin.';
  end if;
  insert into public.system_admin_logs(actor_user_id, action, target_type, target_id, factory_id, before_data, after_data, note)
  values(auth.uid(), p_action, p_target_type, p_target_id, p_factory_id, p_before, p_after, p_note);
end;
$$;

grant execute on function public.btg_systemcenter_log(text,text,uuid,uuid,jsonb,jsonb,text) to authenticated;

create or replace function public.btg_systemcenter_list_factories()
returns table(
  factory_id uuid,
  factory_name text,
  status text,
  plan text,
  max_users integer,
  contact_email text,
  locked_reason text,
  locked_until timestamptz,
  public_message text,
  internal_note text,
  created_at timestamptz,
  updated_at timestamptz,
  users_count bigint,
  batches_30d bigint,
  cubes_30d bigint,
  demoulding_30d bigint,
  silo_tx_30d bigint,
  last_activity_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  return query
  select f.id,
         f.name,
         coalesce(f.status, case when coalesce(f.active,true) then 'active' else 'archived' end),
         f.plan,
         f.max_users,
         f.contact_email,
         f.locked_reason,
         f.locked_until,
         f.public_message,
         f.internal_note,
         f.created_at,
         f.updated_at,
         (select count(*) from public.btg_user_access_profiles p where p.factory_id=f.id),
         (select count(*) from public.batches b where coalesce(b.app_data->>'factoryId', b.app_data->>'factory_id')=f.id::text and b.created_at>=now()-interval '30 days'),
         (select count(*) from public.cubes c where coalesce(c.app_data->>'factoryId', c.app_data->>'factory_id')=f.id::text and c.created_at>=now()-interval '30 days'),
         (select count(*) from public.demoulding_cubes d where coalesce(d.factory_id::text, d.app_data->>'factoryId', d.app_data->>'factory_id')=f.id::text and d.created_at>=now()-interval '30 days'),
         (select count(*) from public.cement_silo_transactions st where st.factory_id=f.id and st.created_at>=now()-interval '30 days'),
         greatest(
           coalesce((select max(b.created_at) from public.batches b where coalesce(b.app_data->>'factoryId', b.app_data->>'factory_id')=f.id::text),'1970-01-01'::timestamptz),
           coalesce((select max(c.created_at) from public.cubes c where coalesce(c.app_data->>'factoryId', c.app_data->>'factory_id')=f.id::text),'1970-01-01'::timestamptz),
           coalesce((select max(d.created_at) from public.demoulding_cubes d where coalesce(d.factory_id::text, d.app_data->>'factoryId', d.app_data->>'factory_id')=f.id::text),'1970-01-01'::timestamptz),
           coalesce((select max(st.created_at) from public.cement_silo_transactions st where st.factory_id=f.id),'1970-01-01'::timestamptz),
           coalesce(f.updated_at, f.created_at, '1970-01-01'::timestamptz)
         )
  from public.factories f
  order by f.created_at desc nulls last;
end;
$$;

grant execute on function public.btg_systemcenter_list_factories() to authenticated;

create or replace function public.btg_systemcenter_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare out jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  select jsonb_build_object(
    'factories_total', (select count(*) from public.factories),
    'factories_active', (select count(*) from public.factories where coalesce(status,'active')='active'),
    'factories_locked', (select count(*) from public.factories where coalesce(status,'active') in ('locked','paused')),
    'users_total', (select count(distinct user_id) from public.btg_user_access_profiles),
    'batches_30d', (select count(*) from public.batches where created_at>=now()-interval '30 days'),
    'cubes_30d', (select count(*) from public.cubes where created_at>=now()-interval '30 days'),
    'demoulding_30d', (select count(*) from public.demoulding_cubes where created_at>=now()-interval '30 days'),
    'silo_tx_30d', (select count(*) from public.cement_silo_transactions where created_at>=now()-interval '30 days')
  ) into out;
  return out;
end;
$$;

grant execute on function public.btg_systemcenter_overview() to authenticated;

create or replace function public.btg_systemcenter_factory_usage(p_days integer default 30)
returns table(
  factory_id uuid,
  factory_name text,
  status text,
  users_count bigint,
  batches_30d bigint,
  cubes_30d bigint,
  demoulding_30d bigint,
  silo_tx_30d bigint
)
language sql
security definer
set search_path = public
as $$
  select factory_id, factory_name, status, users_count, batches_30d, cubes_30d, demoulding_30d, silo_tx_30d
  from public.btg_systemcenter_list_factories();
$$;

grant execute on function public.btg_systemcenter_factory_usage(integer) to authenticated;

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
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
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
  left join auth.users u on u.id=p.user_id
  left join public.factories f on f.id=p.factory_id
  order by f.name nulls last, u.email nulls last;
end;
$$;

grant execute on function public.btg_systemcenter_list_users() to authenticated;

create or replace function public.btg_systemcenter_save_factory(
  p_factory_id uuid default null,
  p_name text default null,
  p_status text default 'active',
  p_plan text default null,
  p_max_users integer default null,
  p_contact_email text default null,
  p_locked_until timestamptz default null,
  p_public_message text default null,
  p_internal_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_before jsonb; v_after jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  if coalesce(trim(p_name),'')='' then raise exception 'Fabriksnamn krävs.'; end if;
  if p_factory_id is null then
    insert into public.factories(name, status, plan, max_users, contact_email, locked_until, public_message, internal_note, active, updated_at)
    values(trim(p_name), coalesce(p_status,'active'), p_plan, p_max_users, p_contact_email, p_locked_until, p_public_message, p_internal_note, coalesce(p_status,'active') not in ('archived','locked','paused'), now())
    returning id into v_id;
    select to_jsonb(f) into v_after from public.factories f where f.id=v_id;
    perform public.btg_systemcenter_log('create_factory','factory',v_id,v_id,null,v_after,'Fabrik skapad i Systemcenter');
  else
    v_id := p_factory_id;
    select to_jsonb(f) into v_before from public.factories f where f.id=v_id;
    update public.factories
    set name=trim(p_name), status=coalesce(p_status,'active'), plan=p_plan, max_users=p_max_users, contact_email=p_contact_email, locked_until=p_locked_until, public_message=p_public_message, internal_note=p_internal_note, active=coalesce(p_status,'active') not in ('archived','locked','paused'), updated_at=now()
    where id=v_id;
    select to_jsonb(f) into v_after from public.factories f where f.id=v_id;
    perform public.btg_systemcenter_log('update_factory','factory',v_id,v_id,v_before,v_after,'Fabrik uppdaterad i Systemcenter');
  end if;
  return v_id;
end;
$$;

grant execute on function public.btg_systemcenter_save_factory(uuid,text,text,text,integer,text,timestamptz,text,text) to authenticated;

create or replace function public.btg_systemcenter_update_factory_status(p_factory_id uuid, p_status text, p_reason text default null, p_public_message text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_before jsonb; v_after jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  if p_status not in ('active','locked','paused','archived','demo') then raise exception 'Ogiltig status.'; end if;
  select to_jsonb(f) into v_before from public.factories f where f.id=p_factory_id;
  update public.factories
  set status=p_status,
      active=(p_status='active' or p_status='demo'),
      locked_reason=case when p_status='locked' then p_reason else null end,
      public_message=case when p_status='locked' then coalesce(p_public_message, public_message) else public_message end,
      updated_at=now()
  where id=p_factory_id;
  select to_jsonb(f) into v_after from public.factories f where f.id=p_factory_id;
  perform public.btg_systemcenter_log('update_factory_status','factory',p_factory_id,p_factory_id,v_before,v_after,coalesce(p_reason,p_status));
end;
$$;

grant execute on function public.btg_systemcenter_update_factory_status(uuid,text,text,text) to authenticated;

create or replace function public.btg_systemcenter_logs(p_limit integer default 80)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  action text,
  target_type text,
  target_id uuid,
  factory_id uuid,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  return query
  select l.id, l.actor_user_id, u.email::text, l.action, l.target_type, l.target_id, l.factory_id, l.note, l.created_at
  from public.system_admin_logs l
  left join auth.users u on u.id=l.actor_user_id
  order by l.created_at desc
  limit greatest(1, least(coalesce(p_limit,80),300));
end;
$$;

grant execute on function public.btg_systemcenter_logs(integer) to authenticated;

create or replace function public.btg_systemcenter_my_factory_status(p_factory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare out jsonb;
begin
  if auth.uid() is null then raise exception 'Ej inloggad.'; end if;
  if not exists(select 1 from public.btg_user_access_profiles p where p.user_id=auth.uid() and p.factory_id=p_factory_id)
     and not public.btg_systemcenter_is_superadmin() then
    raise exception 'Du saknar behörighet till fabriken.';
  end if;
  select jsonb_build_object('factory_id',id,'name',name,'status',coalesce(status,'active'),'public_message',public_message,'locked_reason',locked_reason,'locked_until',locked_until)
  into out
  from public.factories where id=p_factory_id;
  return out;
end;
$$;

grant execute on function public.btg_systemcenter_my_factory_status(uuid) to authenticated;

select 'v19.5.33 Systemcenter ready' as status;
