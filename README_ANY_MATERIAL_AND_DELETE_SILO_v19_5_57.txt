BTG Quality Control v19.5.57 – Alla material i silo + Ta bort silo

FIXAR
1. Ny/redigera silo ska nu visa ALLA material, inte bara cement.
2. Material hämtas bredare:
   - material kopplade till användare/fabriksanvändare
   - material kopplade till aktiv factory_id
   - fallback från senaste materialrader
   - material från kärnappens lokala lista
   - material som finns i recept
3. Receptfallback filtrerar inte längre på cement.
4. Borttagningsknapp har lagts till på varje silo.
5. Ta bort silo frågar efter bekräftelse.
6. Efter borttagning laddas Material & Silor om.

ÄNDRADE FILER
- js/features/silos/cement-silos.js
- css/dashboard-customizer.css
- sql/19_5_57_cement_silos_delete_policy_helper.sql
- README_ANY_MATERIAL_AND_DELETE_SILO_v19_5_57.txt

VIKTIGT
Ingen SQL krävs för materialdropdownen.
Om "Ta bort silo" ger permission denied/RLS-fel, kör hjälpfilen:
sql/19_5_57_cement_silos_delete_policy_helper.sql

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Material & Silor.
4. Klicka Skapa silo.
5. Kontrollera att alla material i materiallistan syns.
6. Skapa en silo på valfritt material.
7. Kontrollera att knappen Ta bort finns på silokortet.
8. Testa att ta bort en test-silo.
