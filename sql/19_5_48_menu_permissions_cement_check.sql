
-- BTG QC v19.5.48 – Meny/behörighetskontroll för Cement & Silor
-- Kör endast om Cement & Silor fortfarande är dolt efter frontend-patchen.
-- Denna SQL visar först om några behörighetsrader döljer/låser cement_silos.

select
  factory_id,
  user_id,
  page_key,
  mode,
  updated_at
from public.btg_page_permissions
where page_key = 'cement_silos'
order by updated_at desc nulls last;

-- Om du vill göra Cement & Silor synligt igen för alla fabriker/användare,
-- avkommentera raden nedan och kör den:
-- update public.btg_page_permissions set mode='visible', updated_at=now() where page_key='cement_silos' and mode in ('hidden','locked');

-- Om du bara vill göra det synligt för en specifik fabrik:
-- update public.btg_page_permissions set mode='visible', updated_at=now() where page_key='cement_silos' and factory_id='<DIN_FACTORY_UUID>'::uuid;
