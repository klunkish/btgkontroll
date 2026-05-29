BTG Quality Control v19.5.53 – Defensiv fix för Systemcenter och tom Dashboard

FIXAR
1. Systemcenter visas mer defensivt i nya menyn.
2. Systemcenter är inte längre beroende av att superadmin-rollen hinner laddas exakt före menybygget.
3. Dashboarden monteras även om aktiv dashboard-klass inte hunnit sättas.
4. Om dashboardconfig är tom visas en knapp för att bygga dashboard.
5. Extra nödfallback i HTML skapar "Bygg din dashboard"-knappen om dashboard-scriptet inte hinner montera.

ÄNDRADE FILER
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- BTG_Quality_Control_v19_5_29_modular.html

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Logga in som superadmin.
4. Kontrollera att Systemcenter syns.
5. Gå till Dashboard.
6. Kontrollera att knappen "Bygg din dashboard" syns.
