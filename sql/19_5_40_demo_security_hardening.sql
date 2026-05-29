
-- BTG QC v19.5.40 – Demo security hardening / kontroll
-- Kör efter tidigare SQL. Denna fil ersätter dokument-RPC med fabriksmedlemskontroll.

create or replace function public.btg_is_member_of_factory(p_factory_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_factory_id is null then return false; end if;
  if public.btg_systemcenter_is_superadmin() then return true; end if;
  if to_regclass('public.btg_user_access_profiles') is not null then
    return exists (
      select 1 from public.btg_user_access_profiles p
      where p.user_id=auth.uid() and p.factory_id=p_factory_id
    );
  end if;
  return false;
end;
$$;
grant execute on function public.btg_is_member_of_factory(uuid) to authenticated;

create or replace function public.btg_customer_order_documents_list(p_factory_id text default null)
returns setof public.customer_order_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_factory uuid;
begin
  v_factory := nullif(p_factory_id,'')::uuid;
  if v_factory is null or not public.btg_is_member_of_factory(v_factory) then
    raise exception 'Saknar behörighet till vald fabrik.';
  end if;
  return query
  select * from public.customer_order_documents
  where factory_id=v_factory
  order by created_at desc
  limit 200;
end;
$$;
grant execute on function public.btg_customer_order_documents_list(text) to authenticated;

create or replace function public.btg_customer_order_document_save(p_factory_id text, p_document jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_factory uuid := nullif(p_factory_id,'')::uuid;
  v_type text := coalesce(p_document->>'document_type','offer');
  v_num text := nullif(p_document->>'document_number','');
  v_prefix text;
  v_next int;
begin
  if v_factory is null or not public.btg_is_member_of_factory(v_factory) then
    raise exception 'Saknar behörighet till vald fabrik.';
  end if;
  if v_type not in ('offer','invoice','order','basis') then v_type := 'offer'; end if;
  if v_num is null then
    v_prefix := case v_type when 'invoice' then 'FAK' when 'order' then 'ORD' when 'basis' then 'UND' else 'OFF' end;
    select count(*)::int + 1 into v_next from public.customer_order_documents where document_type=v_type and factory_id=v_factory;
    v_num := v_prefix || '-' || to_char(now(),'YYYY') || '-' || lpad(v_next::text,4,'0');
  end if;
  insert into public.customer_order_documents(factory_id,customer_id,order_id,document_type,document_number,title,customer_name,order_name,document_date,due_date,payment_terms,reference,note,lines,document_data,net_amount,vat_amount,total_amount,created_by)
  values(v_factory,p_document->>'customer_id',p_document->>'order_id',v_type,v_num,p_document->>'title',p_document->>'customer_name',p_document->>'order_name',coalesce(nullif(p_document->>'document_date','')::date,current_date),nullif(p_document->>'due_date','')::date,p_document->>'payment_terms',p_document->>'reference',p_document->>'note',coalesce(p_document->'lines','[]'::jsonb),p_document || jsonb_build_object('document_number',v_num),coalesce((p_document->'totals'->>'net')::numeric,0),coalesce((p_document->'totals'->>'vat')::numeric,0),coalesce((p_document->'totals'->>'total')::numeric,0),auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.btg_customer_order_document_save(text,jsonb) to authenticated;
