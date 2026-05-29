BTG Quality Control 2.0.3 – Prefabkö återställd

PROBLEM
Prefabkö fanns kvar i appen men saknades i nya menyregistret.
Den gamla prefabknappen doldes av nya menyn, men ingen ny Prefabkö-knapp skapades.

FIX
1. Prefabkö är nu en riktig sida i navigation-registry.js.
2. Nya menyn skapar knappen Prefabkö om prefabmodulen finns.
3. Klick på Prefabkö öppnar befintlig prefabfunktion.
4. Gamla menyknappar hålls fortfarande dolda.
5. Prefabkö finns även som valbar dashboardwidget/genväg.

ÄNDRADE FILER
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- VERSION_BTG_QC_2_0_3.txt
- README_BTG_QC_2_0_3_PREFAB_QUEUE_RESTORE.txt

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Kontrollera att Prefabkö finns i menyn.
4. Klicka Prefabkö.
5. Kontrollera att prefabvyn öppnas och att inga extra gamla menyknappar dyker upp.
