BTG QC v19.5.33 – Systemcenter

Ny modul:
- Systemcenter visas endast för superadmin.
- Hybridlösning: ligger i samma app nu, men i separata filer så den kan brytas ut till egen adminapp senare.

Nya filer:
- css/system-center.css
- js/features/system/system-center.js
- sql/19_5_33_system_center.sql
- README_SYSTEMCENTER_v19_5_33.txt

Ändrad fil:
- BTG_Quality_Control_v19_5_29_modular.html

Viktigt:
Kör SQL-filen i Supabase innan funktionen används:
  sql/19_5_33_system_center.sql

Funktioner i v1:
- Systemöversikt
- Lista fabriker
- Lista användare per fabrik
- Användning per fabrik senaste 30 dagar
- Skapa/redigera fabrik
- Lås/lås upp fabrik
- Välj fabrik i appen
- Systemlogg för adminåtgärder
- Låsningskontroll för icke-superadmin

Statusar:
- active
- locked
- paused
- archived
- demo

Obs:
Om du får permission denied eller RPC saknas: kör SQL-filen igen i Supabase SQL Editor och ladda om appen.
