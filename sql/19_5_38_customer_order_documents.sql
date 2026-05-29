
-- BTG Quality Control v19.5.38 – Kund & Beställningsdokument
-- Kör i Supabase SQL Editor.

create extension if not exists pgcrypto;
grant usage on schema public to authenticated, service_role;

create table if not exists public.customer_order_documents (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid,
  customer_id text,
  order_id text,
  document_type text not null default 'offer' check (document_type in ('offer','invoice','order','basis')),
  document_number text,
  title text,
  customer_name text,
  order_name text,
  document_date date default current_date,
  due_date date,
  payment_terms text,
  reference text,
  note text,
  lines jsonb not null default '[]'::jsonb,
  document_data jsonb not null default '{}'::jsonb,
  net_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_order_documents enable row level security;

drop policy if exists customer_order_documents_select on public.customer_order_documents;
create policy customer_order_documents_select
on public.customer_order_documents
for select
to authenticated
using (
  public.btg_systemcenter_is_superadmin()
  or factory_id::text = coalesce(
    nullif((auth.jwt()->'user_metadata'->>'factory_id'), ''),
    nullif((auth.jwt()->'app_metadata'->>'factory_id'), '')
  )
  or created_by = auth.uid()
);

drop policy if exists customer_order_documents_write on public.customer_order_documents;
create policy customer_order_documents_write
on public.customer_order_documents
for all
to authenticated
using (
  public.btg_systemcenter_is_superadmin()
  or created_by = auth.uid()
)
with check (
  public.btg_systemcenter_is_superadmin()
  or created_by = auth.uid()
);

grant select, insert, update, delete on public.customer_order_documents to authenticated;

create or replace function public.customer_order_documents_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists customer_order_documents_touch_trg on public.customer_order_documents;
create trigger customer_order_documents_touch_trg
before update on public.customer_order_documents
for each row execute function public.customer_order_documents_touch();

create or replace function public.btg_customer_order_documents_list(p_factory_id text default null)
returns setof public.customer_order_documents
language sql
security definer
set search_path = public
as $$
  select *
  from public.customer_order_documents
  where (p_factory_id is null or p_factory_id='' or factory_id::text=p_factory_id)
  order by created_at desc
  limit 200;
$$;

grant execute on function public.btg_customer_order_documents_list(text) to authenticated;

create or replace function public.btg_customer_order_document_save(
  p_factory_id text,
  p_document jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type text := coalesce(p_document->>'document_type','offer');
  v_num text := nullif(p_document->>'document_number','');
  v_prefix text;
  v_next int;
begin
  if v_type not in ('offer','invoice','order','basis') then
    v_type := 'offer';
  end if;

  if v_num is null then
    v_prefix := case v_type
      when 'invoice' then 'FAK'
      when 'order' then 'ORD'
      when 'basis' then 'UND'
      else 'OFF'
    end;
    select count(*)::int + 1 into v_next
    from public.customer_order_documents
    where document_type=v_type
      and (p_factory_id is null or p_factory_id='' or factory_id::text=p_factory_id);
    v_num := v_prefix || '-' || to_char(now(),'YYYY') || '-' || lpad(v_next::text,4,'0');
  end if;

  insert into public.customer_order_documents(
    factory_id, customer_id, order_id, document_type, document_number, title,
    customer_name, order_name, document_date, due_date, payment_terms, reference, note,
    lines, document_data, net_amount, vat_amount, total_amount, created_by
  )
  values(
    nullif(p_factory_id,'')::uuid,
    p_document->>'customer_id',
    p_document->>'order_id',
    v_type,
    v_num,
    p_document->>'title',
    p_document->>'customer_name',
    p_document->>'order_name',
    coalesce(nullif(p_document->>'document_date','')::date,current_date),
    nullif(p_document->>'due_date','')::date,
    p_document->>'payment_terms',
    p_document->>'reference',
    p_document->>'note',
    coalesce(p_document->'lines','[]'::jsonb),
    p_document || jsonb_build_object('document_number',v_num),
    coalesce((p_document->'totals'->>'net')::numeric,0),
    coalesce((p_document->'totals'->>'vat')::numeric,0),
    coalesce((p_document->'totals'->>'total')::numeric,0),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.btg_customer_order_document_save(text,jsonb) to authenticated;
