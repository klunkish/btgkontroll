-- BTG Quality Control v19.5.37 – Systemcenter Offert/Faktura
-- Kör i Supabase SQL Editor efter Systemcenter-SQL.

create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

create table if not exists public.system_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('quote','invoice','proposal','subscription')),
  document_no text not null,
  status text not null default 'draft',
  factory_id uuid null,
  customer_name text,
  customer_org_no text,
  customer_email text,
  customer_address text,
  contact_person text,
  issue_date date not null default current_date,
  due_date date null,
  valid_until date null,
  currency text not null default 'SEK',
  subtotal numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  options jsonb not null default '{}'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  notes text,
  terms text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists system_documents_document_no_uq on public.system_documents(document_no);
alter table public.system_documents enable row level security;

drop policy if exists system_documents_superadmin on public.system_documents;
create policy system_documents_superadmin on public.system_documents
for all to authenticated
using (public.btg_systemcenter_is_superadmin())
with check (public.btg_systemcenter_is_superadmin());

grant select, insert, update, delete on public.system_documents to authenticated;

create or replace function public.system_documents_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists system_documents_touch_trg on public.system_documents;
create trigger system_documents_touch_trg before update on public.system_documents
for each row execute function public.system_documents_touch();

create or replace function public.btg_systemcenter_next_document_no(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year text := to_char(now(),'YYYY');
  v_next int;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  v_prefix := case when p_type='invoice' then 'FAK' when p_type='quote' then 'OFF' when p_type='subscription' then 'ABB' else 'PRF' end;
  select coalesce(max(nullif(regexp_replace(document_no,'^.*-','','g'),'')::int),0)+1
    into v_next
  from public.system_documents
  where document_no like v_prefix || '-' || v_year || '-%';
  return v_prefix || '-' || v_year || '-' || lpad(v_next::text,4,'0');
end;
$$;

grant execute on function public.btg_systemcenter_next_document_no(text) to authenticated;

create or replace function public.btg_systemcenter_documents_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_docs jsonb := '[]'::jsonb; v_factories jsonb := '[]'::jsonb; v_plans jsonb := '[]'::jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc),'[]'::jsonb) into v_docs from public.system_documents d;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.factory_name),'[]'::jsonb) into v_factories from public.btg_systemcenter_list_factories() f;
  if to_regclass('public.system_app_economy_plans') is not null then
    select coalesce(jsonb_agg(to_jsonb(p) order by p.monthly_price,p.name),'[]'::jsonb) into v_plans from public.system_app_economy_plans p where p.is_active=true;
  end if;
  return jsonb_build_object('documents',v_docs,'factories',v_factories,'plans',v_plans);
end;
$$;

grant execute on function public.btg_systemcenter_documents_get() to authenticated;

create or replace function public.btg_systemcenter_documents_save(p_doc jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_no text; v_type text; v_before jsonb; v_after jsonb;
begin
  if not public.btg_systemcenter_is_superadmin() then raise exception 'Endast superadmin.'; end if;
  v_type := coalesce(p_doc->>'document_type','quote');
  v_no := coalesce(nullif(p_doc->>'document_no',''), public.btg_systemcenter_next_document_no(v_type));

  if nullif(p_doc->>'id','') is null then
    insert into public.system_documents(document_type,document_no,status,factory_id,customer_name,customer_org_no,customer_email,customer_address,contact_person,issue_date,due_date,valid_until,currency,subtotal,vat_amount,total_amount,options,lines,notes,terms,created_by)
    values(v_type,v_no,coalesce(p_doc->>'status','draft'),nullif(p_doc->>'factory_id','')::uuid,p_doc->>'customer_name',p_doc->>'customer_org_no',p_doc->>'customer_email',p_doc->>'customer_address',p_doc->>'contact_person',coalesce(nullif(p_doc->>'issue_date','')::date,current_date),nullif(p_doc->>'due_date','')::date,nullif(p_doc->>'valid_until','')::date,coalesce(p_doc->>'currency','SEK'),coalesce((p_doc->>'subtotal')::numeric,0),coalesce((p_doc->>'vat_amount')::numeric,0),coalesce((p_doc->>'total_amount')::numeric,0),coalesce(p_doc->'options','{}'::jsonb),coalesce(p_doc->'lines','[]'::jsonb),p_doc->>'notes',p_doc->>'terms',auth.uid()) returning id into v_id;
  else
    v_id := (p_doc->>'id')::uuid;
    select to_jsonb(d) into v_before from public.system_documents d where d.id=v_id;
    update public.system_documents set document_type=v_type,document_no=v_no,status=coalesce(p_doc->>'status','draft'),factory_id=nullif(p_doc->>'factory_id','')::uuid,customer_name=p_doc->>'customer_name',customer_org_no=p_doc->>'customer_org_no',customer_email=p_doc->>'customer_email',customer_address=p_doc->>'customer_address',contact_person=p_doc->>'contact_person',issue_date=coalesce(nullif(p_doc->>'issue_date','')::date,current_date),due_date=nullif(p_doc->>'due_date','')::date,valid_until=nullif(p_doc->>'valid_until','')::date,currency=coalesce(p_doc->>'currency','SEK'),subtotal=coalesce((p_doc->>'subtotal')::numeric,0),vat_amount=coalesce((p_doc->>'vat_amount')::numeric,0),total_amount=coalesce((p_doc->>'total_amount')::numeric,0),options=coalesce(p_doc->'options','{}'::jsonb),lines=coalesce(p_doc->'lines','[]'::jsonb),notes=p_doc->>'notes',terms=p_doc->>'terms' where id=v_id;
  end if;
  select to_jsonb(d) into v_after from public.system_documents d where d.id=v_id;
  perform public.btg_systemcenter_log('save_system_document','system_document',v_id,null,v_before,v_after,'Offert/faktura sparad');
  return v_id;
end;
$$;

grant execute on function public.btg_systemcenter_documents_save(jsonb) to authenticated;
