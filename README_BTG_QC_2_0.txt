BTG Quality Control 2.0 – Stabil grundapplikation

DETTA ÄR NY GRUNDVERSION
Denna version är paketerad som BTG QC 2.0 och bygger på den nya fungerande menyn och dashboardbyggaren.

FIXAT I DENNA VERSION
1. Materialdropdownen i Material & Silor dedupliceras hårdare.
   Orsaken till dubletter var att samma material kunde komma från flera källor:
   - Supabase materials
   - receptmaterial
   - lokal appdata
   - fallbacklistor
   Nu nycklas material på normaliserat namn + typ.

2. Ny dashboardwidget: Provningar.
   Den visar:
   - satser där kub/provtagning ska tas
   - om provtagning är gjord eller ej
   - antal att göra
   - antal gjorda
   - genväg till Provningar

3. 2.0-versionen innehåller alla valda funktioner som grund:
   - Ny stabil meny
   - Rätt meny per användare/fabrik
   - Dashboardbyggare
   - Widgets med full sidbredd och valbar höjd
   - Material & Silor för valfritt material
   - Ta bort silo
   - Material & Silor-widget
   - Provningar-widget
   - Systemcenter
   - Ekonomi
   - Kvalitetstrender
   - Dokument/offert/faktura
   - Kunder och beställningar

ÄNDRADE FILER
- js/features/silos/cement-silos.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- VERSION_BTG_QC_2_0.txt
- README_BTG_QC_2_0.txt

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Material & Silor.
4. Skapa/redigera silo och kontrollera att materiallistan inte har dubletter.
5. Öppna Dashboard.
6. Klicka Ändra dashboard eller Bygg din dashboard.
7. Välj Provningar-widgeten.
8. Kontrollera att den visar satser och status gjord/ej gjord.
