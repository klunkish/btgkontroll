BTG Quality Control v19.5.50 – Stabil menyboot och dashboard efter meny

PROBLEM
Menyn blinkade till och byggdes om flera gånger. Dashboarden kunde läsa widgets innan menyn var färdigfiltrerad efter fabrik/användarbehörighet.

NY STARTORDNING
1. HTML sätter tidigt btg-menu-booting på sidan.
2. Menyn hålls osynlig medan behörigheter laddas.
3. js/patches/navigation-registry.js väntar kort på Supabase/användare/fabrik.
4. Menyregister läser effektiva behörigheter.
5. Menyval visas/döljs/låses en gång stabilt.
6. Eventet btg:menu-ready skickas.
7. Dashboarden bygger först därefter widgets.

ÄNDRADE FILER
- BTG_Quality_Control_v19_5_29_modular.html
- css/dashboard-customizer.css
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js

VIKTIGT
Navigation-registry laddas nu före dashboard-customizer, så dashboarden aldrig ska läsa en halvfärdig meny.

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Logga in.
4. Kontrollera att menyn inte blinkar fram/försvinner.
5. Kontrollera att Cement & Silor syns om användaren har rätt.
6. Öppna Dashboard.
7. Kontrollera att valda widgets läses in först efter att menyn är klar.
8. Byt fabrik/användare och kontrollera att menyn byggs om stabilt.
