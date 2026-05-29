BTG Quality Control v19.5.34 – Ekonomi & Kalkyl

Ny modul:
- Ekonomi & Kalkyl för fabriksadmin/superadmin
- Materialpriser
- Utpris per recept
- Receptkalkyl kr/m³
- Tillverkningsanalys från tillverkningsjournalen
- Översikt med KPI-kort
- Diagram för intäkt/kostnad/TB
- Rapportknapp med utskriftsvänlig ekonomirapport

Kör först denna SQL i Supabase:
  sql/19_5_34_economy_calculation.sql

Nya filer:
  css/economy-calculation.css
  js/features/economy/economy-calculation.js
  sql/19_5_34_economy_calculation.sql

Ändrad fil:
  BTG_Quality_Control_v19_5_29_modular.html

Så används modulen:
1. Logga in som fabriksadmin eller superadmin.
2. Öppna Ekonomi & Kalkyl i menyn.
3. Gå till Materialpriser och sätt pris på inmaterial.
4. Gå till Receptkalkyl och sätt utpris per recept i kr/m³.
5. Välj period i översikten.
6. Tillverkningsanalysen räknas från satser i tillverkningsjournalen.
7. Skapa rapport från Rapport-fliken.

Beräkning:
Materialkostnad kr/m³ = receptets materialmängder × materialpris
Intäkt = utpris kr/m³ × producerad volym
Täckningsbidrag = intäkt - materialkostnad
Marginal = täckningsbidrag / intäkt × 100

Version 1 räknar på materialkostnad + utpris.
Transport, maskinkostnad, rabatt, kundspecifika priser och orderpriser är tänkta som senare uppgraderingar.
