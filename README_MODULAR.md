# BTG Quality Control v19.5.29 – modular HTML-version

Denna version behåller HTML-appen men flyttar ut CSS och JavaScript i separata filer.

## Starta

Öppna `BTG_Quality_Control_v19_5_29_modular.html` i webbläsaren, eller kör en enkel lokal server:

```bash
python3 -m http.server 8080
```

Öppna sedan `http://localhost:8080/BTG_Quality_Control_v19_5_29_modular.html`.

## Viktigt

- Script laddas i exakt samma ordning som originalfilen.
- Det är fortfarande vanlig HTML/CSS/JS, ingen React och ingen build-process.
- Lägg nya funktioner som egna filer under `js/features/` eller `js/patches/`.
- Lägg ny CSS som egen fil under `css/` och länka den i HTML efter bas-CSS.
- `module-map.json` visar vilka originalscript som flyttats till vilka filer.

## Rekommenderad regel framåt

1. Ändra inte i stora `10-main-app-persistence-and-ui.js` om det går att undvika.
2. Lägg nya moduler isolerat i `js/features/<område>/`.
3. Lägg rena kompatibilitetsfixar i `js/patches/`.
4. Exponera bara nödvändiga funktioner på `window.BTG_*`.
5. Flytta senare modul för modul till React när strukturen är stabil.

## v19.5.30 – Fabriksadmin: Kvalitetstrender

Ny separat modul för trendrapportering utan att skriva om kärnappen.

Nya filer:
- `js/features/reports/factory-quality-trends.js`
- `css/factory-quality-trends.css`

Ändrad fil:
- `BTG_Quality_Control_v19_5_29_modular.html` laddar den nya CSS/JS-modulen.

Funktionen visas som menyknappen **Kvalitetstrender** för fabriksadmin/ADMIN/SUPERADMIN och läser befintliga provkuber, satser och `demoulding_cubes`. Rapporten är uppdelad i provtagningar, avformningar, hållfasthet per klass och bevakningspunkter. Knappen **Skapa rapport** öppnar utskriftsvänlig rapport.

## v19.5.31 – Cement & Silor

Ny modul för fabriksadmin:

- `css/cement-silos.css`
- `js/features/silos/cement-silos.js`
- `sql/19_5_31_cement_silos.sql`

Kör SQL-filen i Supabase SQL Editor innan funktionen används första gången. Modulen läser befintliga `materials`, `recipes` och `batches`, och beräknar cementförbrukning från receptens cementmängd × satsens m³. Cementleveranser sparas i `cement_silo_transactions` och försöker även skapa en dagbokspost i `diary_entries`.
