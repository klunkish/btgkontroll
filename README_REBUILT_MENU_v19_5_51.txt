BTG Quality Control v19.5.51 – Ny meny från grunden

DETTA ÄR EN STÖRRE MENYFIX
Den gamla menyn döljs och en ny meny byggs från ett fast sidregister.

VARFÖR
Tidigare fanns flera olika script som försökte styra samma meny:
- gammal HTML-meny
- Systemcenter sidbehörigheter
- Cement & Silor fallback
- Dashboard customizer
- navigation-registry

Det gjorde att Cement & Silor kunde blinka till och sedan försvinna vid refresh.

NY LÖSNING
1. Sidan sätter btg-menu-rebuild-started direkt i <head>.
2. Gamla menyn hålls osynlig.
3. navigation-registry.js väntar kort på Supabase/användare/fabrik.
4. Effektiva sidbehörigheter läses.
5. En ny meny byggs från sidregistret PAGES.
6. Gamla menyknappar döljs helt.
7. Nya menyknappar visas/döljs/låses efter behörighet.
8. Cement & Silor är nu en riktig sida i sidregistret.
9. Dashboarden väntar på den nya menyn.
10. Gamla dashboarden döljs från start.

ÄNDRADE FILER
- BTG_Quality_Control_v19_5_29_modular.html
- css/dashboard-customizer.css
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- js/features/system/system-page-permissions.js

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Logga in.
4. Kontrollera att gamla dashboarden inte blinkar fram.
5. Kontrollera att menyn byggs en gång.
6. Kontrollera att Cement & Silor finns kvar efter refresh.
7. Kontrollera Systemcenter sidbehörigheter:
   - Dölj ska ta bort sidan från nya menyn
   - Låst ska visa sidan men blockera klick
   - Synlig ska visa och tillåta klick
8. Öppna Dashboard och kontrollera att widgetvalen följer den nya menyn.
