BTG Quality Control v19.5.54 – Menyklick och aktiv flik fix

PROBLEM
När man klickade i nya menyn kunde gamla menyknappar bli synliga igen.
Då såg det ut som att det blev fler och fler menyval.
Dashboarden kunde också försöka montera även när andra flikar var aktiva.

ORSAK
Nya menyn använde gamla knappens click-handler för att öppna gamla flikar.
I v19.5.53 gjordes den gamla knappen synlig innan click, vilket gjorde att den gamla menyn kom tillbaka.

FIXAR
1. Gamla menyknappar visas aldrig igen.
2. Nya menyn använder fortfarande gamla click-handler internt men håller knappen dold.
3. Gamla menyn döljs igen direkt efter varje sidbyte.
4. Nya menyn markerar aktiv flik.
5. Aktiv flik sparas i localStorage.
6. Dashboarden monteras bara när Dashboard faktiskt är aktiv.
7. Nödfallbacken som kunde montera dashboard vid fel tillfälle är borttagen.

ÄNDRADE FILER
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- BTG_Quality_Control_v19_5_29_modular.html

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Klicka runt i menyn.
4. Kontrollera att inga extra menyval dyker upp.
5. Kontrollera att aktiv flik stannar markerad.
6. Kontrollera att Dashboard bara visas på Dashboard.
