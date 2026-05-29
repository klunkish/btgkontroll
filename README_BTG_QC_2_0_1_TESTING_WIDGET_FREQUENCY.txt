BTG Quality Control 2.0.1 – Provningar-widget kopplad till Tillverkningsjournal + Provfrekvens

PROBLEM
Provningar-widgeten fanns på dashboarden men visade inget eftersom den bara letade efter direkta cube_taken/sample_taken-fält.
I systemet ligger tillverkningen i Tillverkningsjournalen/batches och provtagningen i Provningar/cubes.

FIX
1. Provningar-widgeten läser nu Tillverkningsjournalen från:
   - befintlig BATCHES/LAST_BATCHES_VIEW i appen
   - Supabase-tabellen batches
2. Widgeten läser registrerade provkuber från:
   - befintlig CUBES i appen
   - Supabase-tabellen cubes
3. Widgeten använder provfrekvensinställningen från SETTINGS.en206.samplingFrequency.
4. Den räknar själv ut vilka satser som borde ha kub/prov enligt frekvens:
   - per arbetsdag
   - per produktionsdag
   - per vecka
   - per månad
   - per m³
   - per antal satser
   - per hållfasthetsklass eller all produktion
5. Den visar:
   - antal satser i Tillverkningsjournalen denna månad
   - krav/gjorda
   - saknade kuber
   - vilka satser som saknar kub
   - vilka som redan har kub
6. Den matchar kub mot sats via:
   - batchId
   - batch cloudId
   - batchnummer
   - recept + datum som fallback

INGEN SQL KRÄVS

VIKTIGT
Provfrekvensen styrs av befintliga inställningar i systemet:
SETTINGS.en206.samplingFrequency

Standard är samma som tidigare:
1 prov per hållfasthetsklass per 5 arbetsdagar.

ÄNDRADE FILER
- js/patches/dashboard-customizer.js
- css/dashboard-customizer.css
- VERSION_BTG_QC_2_0_1.txt
- README_BTG_QC_2_0_1_TESTING_WIDGET_FREQUENCY.txt

TEST
1. Deploya zippen.
2. Kör Ctrl+F5.
3. Säkerställ att Tillverkningsjournalen har satser denna månad.
4. Säkerställ att Provningar-widgeten är vald på dashboarden.
5. Kontrollera att widgeten visar krav/gjorda/saknas.
6. Registrera en provkub med batchId/satskoppling.
7. Kontrollera att status går från Kub saknas till Kub tagen.
