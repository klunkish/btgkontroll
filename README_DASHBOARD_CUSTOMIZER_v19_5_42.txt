BTG Quality Control v19.5.42 – Dashboard Customizer v2

FIXAR
1. Den nya dashboarden ersätter den gamla dashboardytan i stället för att hamna ovanför den.
2. Knappen "Visa gammal dashboard" finns kvar om du vill jämföra eller felsöka.
3. Dashboardknapparna är omgjorda och försöker öppna rätt befintlig modul/menyval.
4. Cement & Silor-knappen i menyn är stabiliserad.
5. Dashboardvärden läses mer robust från:
   - appens befintliga window-listor
   - Supabase-tabeller där det går
   - Cement & Silor-modulens state
6. Cement & Silor på dashboarden visas kompakt, medan detaljvyn i fliken behålls.

NYA/ÄNDRADE FILER
- css/dashboard-customizer.css
- js/patches/dashboard-customizer.js
- README_DASHBOARD_CUSTOMIZER_v19_5_42.txt

SQL
Ingen ny SQL krävs för denna fix.
Den tidigare valfria filen sql/19_5_41_dashboard_preferences.sql ligger kvar om du vill använda den senare.

TEST
1. Ladda om appen hårt, Ctrl+F5.
2. Gå till Dashboard.
3. Kontrollera att den gamla dashboarden är dold.
4. Klicka "Visa gammal dashboard" om du vill se den gamla.
5. Testa knapparna i widgets, särskilt Cement & Silor.
6. Klicka Anpassa dashboard och välj widgets.
