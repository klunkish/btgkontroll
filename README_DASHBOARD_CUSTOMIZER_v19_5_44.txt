BTG Quality Control v19.5.44 – Skapa dashboard

ÄNDRING
Dashboarden börjar nu med en enkel knapp:
- Skapa dashboard

När användaren klickar där öppnas en ruta med checkboxar.
Användaren kan bara välja widgets från sidor/menyval som finns tillgängliga för användaren.

VIKTIGT
- Den gamla dashboarden döljs när denna patch är aktiv.
- Inga widgets visas innan användaren har skapat sin dashboard.
- Valet sparas per användare och fabrik i webbläsarens localStorage.
- Ingen ny SQL krävs.

FIXAR
- Dashboarden ska inte längre hamna ovanpå andra sidor.
- Tom dashboard ersätts av tydlig Skapa dashboard-knapp.
- Cement & Silor får fortsatt menyfallback om menyvalet saknas.
- Cement & Silor-widgeten visar kompakt silovy på dashboarden.

TEST
1. Ladda om med Ctrl+F5.
2. Öppna Dashboard.
3. Klicka Skapa dashboard.
4. Välj widgets.
5. Spara dashboard.
6. Byt till andra sidor och kontrollera att dashboarden inte ligger ovanpå.
