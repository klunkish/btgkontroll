BTG Quality Control v19.5.43 – Dashboard Customizer v3 hotfix

PROBLEMEN SOM FIXAS
1. Dashboarden hamnade överst även när andra sidor valdes.
2. Nya dashboardens värden stämde inte.
3. Vissa dashboardknappar öppnade inte rätt funktion.

ÄNDRINGAR
- Dashboardpatchen tvingar inte längre #tab-dashboard att visas.
- Body får bara dashboardläge när Dashboard-fliken faktiskt är aktiv.
- Nya dashboarden speglar i första hand den befintliga/gamla dashboardens egna värden.
- Den gamla dashboarden är dold på Dashboard-fliken, men kan visas med knappen "Visa gammal dashboard".
- Cement & Silor-menyn stabiliseras fortfarande.
- Knapparna använder mer försiktig navigering så de inte triggar fel sida.

INGEN NY SQL KRÄVS

TEST
1. Ladda upp zippen.
2. Gör hård omladdning: Ctrl + F5.
3. Gå till Dashboard och kontrollera att nya dashboarden syns.
4. Gå till Material/Recept/Beställningar och kontrollera att dashboarden INTE ligger ovanpå.
5. Gå tillbaka till Dashboard.
6. Testa Visa gammal dashboard.
7. Testa Öppna på Cement & Silor.
