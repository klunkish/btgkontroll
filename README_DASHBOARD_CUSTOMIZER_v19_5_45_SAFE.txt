BTG Quality Control v19.5.45 – SAFE dashboard hotfix

DENNA VERSION FIXAR KRASCHEN
- Tar bort aggressiv MutationObserver-loop.
- Dashboarden monteras bara försiktigt vid laddning och när man klickar i menyn.
- Gamla dashboarden döljs först efter att nya dashboard-roten har skapats.
- Om något fel uppstår stänger scriptet ner sig själv i stället för att låsa hela appen.

FUNKTION
- Dashboard visar Skapa dashboard.
- Användaren väljer widgets med checkboxar.
- Endast widgets från tillgängliga menyval visas.
- Valet sparas per användare och fabrik i localStorage.

INGEN SQL KRÄVS.

TEST
1. Ladda upp zippen.
2. Gör hård omladdning: Ctrl + F5.
3. Öppna Dashboard.
4. Klicka Skapa dashboard.
5. Välj widgets och spara.
6. Kontrollera att övriga menyknappar går att klicka.
