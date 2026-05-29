BTG Quality Control v19.5.41 – Dashboard Customizer + Cement & Silor menyfix

ÄNDRINGAR
1. Cement & Silor får en stabil menyknapp om den saknas.
2. Dashboarden får en kompakt personlig "Min dashboard".
3. Varje användare kan välja widgets utifrån sidor/funktioner användaren har tillgång till.
4. Checklistan visas mer sammanfattad och kan öppnas vid behov.
5. Cement & Silor på dashboarden visas som små rena silostaplar.
6. Inne i Cement & Silor-fliken behålls den detaljerade grafiken.

NYA FILER
- css/dashboard-customizer.css
- js/patches/dashboard-customizer.js
- sql/19_5_41_dashboard_preferences.sql
- README_DASHBOARD_CUSTOMIZER_v19_5_41.txt

ÄNDRAD FIL
- BTG_Quality_Control_v19_5_29_modular.html

SQL
sql/19_5_41_dashboard_preferences.sql är valfri men rekommenderad för senare serverlagring.
Nuvarande version sparar användarens dashboardval i localStorage per användare och fabrik.

TESTA
1. Packa upp zippen.
2. Ladda om appen helt.
3. Kontrollera att Cement & Silor syns i menyn.
4. Öppna Dashboard.
5. Klicka Anpassa dashboard.
6. Välj widgets och spara.
7. Kontrollera att checklistan är kompakt.
8. Kontrollera att Cement & Silor-widgeten visar små silostaplar.
9. Öppna Cement & Silor-fliken och kontrollera att detaljerad vy finns kvar.
