BTG Quality Control v19.5.58 – Materialschema-safe fix

PROBLEM
Material & Silor kunde inte laddas och visade:
column materials.factory_id does not exist

ORSAK
v19.5.57 försökte läsa och filtrera på materials.factory_id.
Din materials-tabell saknar den kolumnen, därför kraschade hela laddningen innan silosarna kunde visas.

FIX
1. Materialhämtningen väljer nu bara kolumner som finns i äldre schema:
   id, name, type, ef, note, app_data, created_at, user_id
2. Ingen query använder längre materials.factory_id.
3. Materialfel stoppar inte längre silo-laddningen.
4. Dina befintliga silos ska synas igen.
5. Materiallistan kompletteras fortfarande med:
   - material kopplade till fabriksanvändare via user_id
   - appens lokala materiallista
   - material som finns i recept
6. Ta bort silo-knappen från v19.5.57 finns kvar.

INGEN SQL KRÄVS
Kör inte någon ny SQL för detta.

ÄNDRADE FILER
- js/features/silos/cement-silos.js
- README_MATERIAL_SCHEMA_SAFE_v19_5_58.txt

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Material & Silor.
4. Kontrollera att befintliga silos syns igen.
5. Klicka Skapa silo.
6. Kontrollera att materialdropdownen laddas utan factory_id-fel.
7. Kontrollera att Ta bort-knappen finns kvar.
