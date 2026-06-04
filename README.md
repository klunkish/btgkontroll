# BTG Quality Control 3.0.0 – Ren grundversion

Detta är en ny grundversion där gamla roll- och accesslager har rensats bort.

## Behållet

Alla huvudfunktioner från 2.x finns kvar:

- Dashboard
- Tillverkningsdata
- Prefabkö
- Avformningskuber
- Provningar
- Beställningar
- Material
- Recept
- Bord & Temperatur
- Material & Silor
- Miljö / EN 15804-underlag
- Offert / Faktura
- Ekonomi & Kalkyl
- Kvalitetstrender
- Systemcenter
- Användarkonton

## Borttaget / avaktiverat

Gamla accesslager som orsakade konflikter är borttagna från `index.html`:

- gamla role-based-access
- gamla access codes / factory roles
- stable-access
- access-stabilizer
- stable-nav
- production-limited-access
- multi-profile-safe-fix
- kontor-limited-access
- kontor-menu-hide
- access-dialog-stability-fix

## Ny behörighetsmodell

Endast denna modell ska styra menyn:

```json
{
  "access_model": "simple_account_pages_v1",
  "allowed_pages": ["dashboard", "production", "prefab"]
}
```

Superadmin gör allt via:

**Systemcenter → Användarkonton**

Där väljer man:

1. användarkonto
2. fabrik
3. roll
4. sidor
5. spara

## Viktigt SQL

Om du inte redan har kört SQL från 2.0.33, kör:

`sql/30_clean_base_simple_access_required.sql`

Den innehåller funktionerna för det enkla access-systemet.

## Efter deploy

Kör Ctrl + F5.
