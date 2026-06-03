# BTG Quality Control 2.0.30

## Nytt i 2.0.30

### Systemcenter – bättre användarhantering

Fixar problemet där nya testanvändare inte syntes när sidbehörigheter skulle tilldelas.

## Ändrat i appen

I Systemcenter → Sidbehörigheter finns nu:

- fabriksväljare
- användarväljare
- ny ruta: **Lägg till användare i vald fabrik**
- e-postfält
- rollfält
- knapp: **Lägg till**

Det betyder att om en testanvändare inte syns i listan kan du lägga till den direkt via e-post, så länge användaren redan har skapat konto/loggat in minst en gång i Supabase Auth.

## Sidlistan kompletterad

Sidbehörigheter innehåller nu fler sidor, bland annat:

- Prefabkö
- Utvärdering
- Kontroll
- Offert / Faktura
- Miljö
- Bord & Temperatur
- Material & Silor
- Kvalitetstrender
- Ekonomi & Kalkyl

## SQL

Ny SQL-fil finns i:

`sql/30_systemcenter_user_access_and_pages.sql`

Kör den i Supabase SQL Editor.

Den skapar/uppdaterar:

- `btg_systemcenter_is_superadmin()`
- `btg_systemcenter_page_registry()`
- `btg_systemcenter_get_permissions_meta()`
- `btg_systemcenter_add_user_to_factory(email, factory_id, role_code)`

## Viktigt flöde för ny användare

1. Testanvändaren måste först skapa konto/logga in minst en gång.
2. Gå till Systemcenter → Sidbehörigheter.
3. Välj fabrik.
4. Skriv användarens e-post i “Lägg till användare”.
5. Välj roll.
6. Tryck Lägg till.
7. Användaren dyker upp i användarlistan.
8. Tilldela sidbehörigheter.
9. Spara.

## Ingen hemlig adminnyckel i appen

Appen använder ingen hemlig adminnyckel. Lägg till-funktionen går via en Supabase RPC med `security definer`.
