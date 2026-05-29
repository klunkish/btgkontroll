BTG Quality Control v19.5.55 – Cement & Silor dashboarddetaljer

ÄNDRAT
Cement & Silor-widgeten på Dashboard visar nu mer information per silo.

NYTT I WIDGETEN
- Totalt innehåll i kg
- Total kapacitet i kg
- Total fyllnadsgrad i %
- En tydligare silokarta
- Silo-namn under rätt stapel
- Kopplat cement/material under silon
- Aktuellt kg per silo
- Maxkapacitet per silo
- Status: OK nivå, Låg nivå eller Kritisk nivå

VIKTIGT
Beräkningen är fortfarande synkad med Cement & Silor-fliken.
Dashboarden använder samma currentKg/pct-data som silomodulen.

ÄNDRADE FILER
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css

INGEN SQL KRÄVS

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Öppna Dashboard.
4. Lägg till Cement & Silor-widgeten om den inte redan är vald.
5. Kontrollera att varje stapel visar rätt silo, material, kg, maxkapacitet och procent.
