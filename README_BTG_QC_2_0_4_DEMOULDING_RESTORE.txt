BTG Quality Control 2.0.4 – Avformningskuber återställd

PROBLEM
Avformningskuber fanns kvar i appen, men saknades i nya menyregistret.
Den gamla knappen doldes av nya menyn, men ingen ny Avformningskuber-knapp skapades.

FIX
1. Avformningskuber är nu en riktig sida i navigation-registry.js.
2. Nya menyn skapar knappen Avformningskuber om demouldingmodulen finns.
3. Klick på Avformningskuber öppnar befintlig avformningsfunktion.
4. Gamla menyknappar hålls fortfarande dolda.
5. Avformningskuber finns även som valbar dashboardwidget/genväg.

ÄNDRADE FILER
- js/patches/navigation-registry.js
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- VERSION_BTG_QC_2_0_4.txt
- README_BTG_QC_2_0_4_DEMOULDING_RESTORE.txt

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Kontrollera att Avformningskuber finns i menyn.
4. Klicka Avformningskuber.
5. Kontrollera att avformningsvyn öppnas.
6. Kontrollera att inga extra gamla menyknappar dyker upp.
