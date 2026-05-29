BTG Quality Control v19.5.52 – Systemcenter tillbaka + Dashboard builder

FIXAR
1. Systemcenter ska nu alltid finnas i nya menyn för superadmin.
2. Dashboarden börjar med knappen: Bygg din dashboard.
3. Dashboarden visar inget tomt/gammalt innehåll innan den är byggd.
4. Widgetar kan bara väljas från sidor som finns i nya menyn.
5. Alla widgets/kort är full sidbredd.
6. Höjd kan väljas per widget:
   - Kompakt
   - Normal
   - Stor
   - Extra stor
7. Dashboardkonfigurationen sparas i localStorage.

ÄNDRADE FILER
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- README_DASHBOARD_BUILDER_v19_5_52.txt

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Logga in som superadmin.
4. Kontrollera att Systemcenter finns i menyn.
5. Gå till Dashboard.
6. Klicka Bygg din dashboard.
7. Välj widgets och höjd.
8. Spara.
9. Kontrollera att korten är full sidbredd och att höjden följer valet.
