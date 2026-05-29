BTG Quality Control v19.5.46 – Persistent full-width dashboard

FIXAR
1. Dashboardvalet sparas stabilare och ska inte behöva väljas om vid refresh.
2. Valet sparas nu på en global dashboardnyckel i localStorage i stället för en nyckel som kan ändras när användare/fabrik laddas sent.
3. Gamla dashboardval migreras automatiskt om de finns.
4. Varje widget tar nu 1 hel sidbredd.
5. Ny förbättrad widget: Aktiv fabrik.
6. Aktiv fabrik visar:
   - fabriksnamn
   - fabrik-ID
   - inloggad användare/e-post
   - roll
   - Supabase/anslutningsstatus
   - synliga menybehörigheter

INGEN SQL KRÄVS

TEST
1. Ladda upp zippen.
2. Gör Ctrl+F5.
3. Skapa dashboard och välj widgets.
4. Refresh.
5. Kontrollera att dashboarden ligger kvar.
6. Kontrollera att varje widget tar full bredd.
7. Kontrollera Aktiv fabrik-widgeten.
