BTG Quality Control v19.5.49 – Cement & Silor värdesynk

PROBLEM
Dashboarden och Cement & Silor-fliken kunde visa olika silo-nivåer.

ORSAK
Dashboard-widgeten räknade tidigare direkt på silo-rådata, till exempel current_level_kg/start_level_kg.
Cement & Silor-fliken räknar däremot den verkliga nivån som:
startsaldo + leveranser + justeringar - manuella uttag - batchförbrukning.

FIX
Dashboard-widgeten använder nu samma analys som Cement & Silor-fliken:
- currentKg
- pct
- status
- inKg
- outKg

Cement & Silor-modulen exponerar också:
- BTG_CEMENT_SILOS.getAnalysis()
- BTG_CEMENT_SILOS.getDashboardData()

När Cement & Silor uppdateras skickas eventet:
- btg:cement-silos-updated

Dashboarden lyssnar på eventet och uppdaterar widgeten.

ÄNDRADE FILER
- js/features/silos/cement-silos.js
- js/patches/dashboard-customizer.js

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Cement & Silor och kontrollera en silos kg/%.
4. Gå till Dashboard.
5. Kontrollera att Cement & Silor-widgeten visar samma nivå.
6. Registrera leverans eller batchförbrukning.
7. Kontrollera att både flik och dashboard uppdateras till samma värde.
