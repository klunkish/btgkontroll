BTG Quality Control v19.5.47 – Dashboard full width + Cement & Silor restore

FIXAR
1. Dashboard-widgets tvingas nu till verklig full PC-bredd inom dashboard-fliken.
2. Grid/container maxbredd tas bort för nya dashboarden.
3. Cement & Silor läggs tillbaka som tillgänglig widget om modulen finns.
4. Cement & Silor får en synlig stabil menyknapp om ordinarie menyval saknas eller är dolt.
5. Cement & Silor-knappen försöker först öppna befintlig BTG_CEMENT_SILOS.open(), därefter befintligt menyval, därefter befintlig cement/silo-sektion.

INGEN SQL KRÄVS.

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Dashboard.
4. Klicka Ändra widgets eller Skapa dashboard.
5. Kontrollera att Cement & Silor finns i listan.
6. Spara.
7. Kontrollera att varje widget tar full PC-bredd.
8. Kontrollera att Cement & Silor finns i menyn och att Öppna-knappen fungerar.
