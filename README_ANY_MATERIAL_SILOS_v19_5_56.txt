BTG Quality Control v19.5.56 – Silo kan kopplas till valfritt material

ÄNDRAT
Cement & Silor-funktionen är nu mer generell och kan användas för vilket material som helst.

NYTT
1. När du skapar/redigerar en silo visas ALLA material från materiallistan.
2. Funktionen filtrerar inte längre bara på cement.
3. Receptavräkning matchar nu valt material generellt.
4. Om ett recept använder materialet som är kopplat till silon räknas det av från silons nivå.
5. Material kan matchas via material-ID eller materialnamn.
6. Dashboarden visar nu Material & Silor i stället för Cement & Silor.
7. Menytexten ändras till Material & Silor, men teknisk page_key är fortfarande cement_silos för att behålla befintlig SQL/behörigheter.

VIKTIGT
Ingen SQL krävs.
Befintliga silos fortsätter fungera.
Befintlig sidbehörighet cement_silos används fortfarande.

ÄNDRADE FILER
- js/features/silos/cement-silos.js
- js/patches/dashboard-customizer.js
- js/patches/navigation-registry.js

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Material & Silor.
4. Skapa ny silo.
5. Kontrollera att du kan välja vilket material som helst från materiallistan.
6. Kör/registrera en batch med recept som innehåller valt material.
7. Kontrollera att nivån räknas av.
8. Kontrollera Dashboardens Material & Silor-kort.
