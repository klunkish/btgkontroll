BTG Quality Control v19.5.36 – Systemcenter Applikationsekonomi

NY FUNKTION
- Systemcenter får en ny knapp: Applikationsekonomi
- Endast superadmin ska använda funktionen

KÖR SQL
Kör denna fil i Supabase SQL Editor:
sql/19_5_36_system_app_economy.sql

NYA FILER
- css/system-app-economy.css
- js/features/system/system-app-economy.js
- sql/19_5_36_system_app_economy.sql
- README_APP_ECONOMY_v19_5_36.txt

ÄNDRAD FIL
- BTG_Quality_Control_v19_5_29_modular.html

FUNKTIONER
- Lägg in kostnader för att hålla applikationen live
- Stöd för fast kostnad, kostnad per fabrik och kostnad per användare
- Lägg in prisplaner och antal fabriker på varje plan
- Visa månadskostnad, månadsintäkt, resultat, marginal och break-even
- Prisförslag per aktiv fabrik baserat på kostnader och målmarginal
- Intern rapport / utskriftsrapport

EXEMPEL PÅ KOSTNADER
- Supabase
- Domän
- Hosting
- Support
- Utveckling
- Licenser
- Backup
- Administration

BERÄKNING
Total månadskostnad =
fasta kostnader
+ kostnad per aktiv fabrik * antal aktiva fabriker
+ kostnad per användare * antal användare

Rekommenderat pris per fabrik =
kostnad per aktiv fabrik / (1 - målmarginal)

Möjlig intäkt =
prisplanens månadspris * antal fabriker i planen
