BTG Quality Control v19.5.48 – Stabil meny och sidbehörigheter

PROBLEM SOM FIXAS
- Cement & Silor blinkade till i menyn och försvann.
- Olika patchar försökte själva lägga till menyknappar.
- Sidbehörigheter och menyknappar kunde köra i fel ordning.

NY LÖSNING
En ny central menyfil styr nu extra moduler:
- js/patches/navigation-registry.js

Den gör detta:
1. Registrerar moduler som Cement & Silor, Kvalitetstrender, Ekonomi, Offert/Faktura.
2. Skapar saknade menyknappar endast om modulen finns.
3. Läser effektiva sidbehörigheter från Supabase via btg_get_effective_page_permissions.
4. Visar/döljer/låser menyval efter fabrikens och användarens behörigheter.
5. Kör igen efter inloggning/fabriksbyte så menyn inte blinkar bort.

ÄNDRADE FILER
- BTG_Quality_Control_v19_5_29_modular.html
- js/features/system/system-page-permissions.js
- js/patches/dashboard-customizer.js
- js/patches/navigation-registry.js

NY SQL-HJÄLPFIL
- sql/19_5_48_menu_permissions_cement_check.sql

VIKTIGT
Om Cement & Silor fortfarande inte syns efter denna patch betyder det troligen att det finns en behörighetsrad i Supabase som sätter cement_silos till hidden eller locked.
Kör då:
sql/19_5_48_menu_permissions_cement_check.sql

Den visar om cement_silos är dold/låst. I filen finns även en avkommenterbar update-rad för att göra Cement & Silor synligt igen.

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Logga in.
4. Kontrollera att Cement & Silor ligger i menyn för användare som har behörighet.
5. Gå till Systemcenter → Sidor och kontrollera att Cement & Silor kan sättas Visa/Dölj/Låst per fabrik och användare.
6. Kontrollera att Dashboard-widgetlistan bara visar widgets som användaren har rätt till.
