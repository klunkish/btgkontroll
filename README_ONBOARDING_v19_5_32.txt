BTG Quality Control v19.5.32 – Rundtur, funktionsguide och Kom igång-checklista

Nya filer:
- css/onboarding-tour.css
- js/features/help/onboarding-tour.js

Ändrad fil:
- BTG_Quality_Control_v19_5_29_modular.html

Funktionen innehåller:
- Starta rundtur-knapp på dashboarden
- Hjälp / Guide-knapp i huvudmenyn
- Spotlight-rundtur med stegvis förklaring
- Funktionsguide med separata guider för appens huvudfunktioner
- Kom igång-checklista på dashboarden
- Automatisk avbockning där appen kan hitta data
- Manuell avbockning för kontrollpunkter
- localStorage för visad välkomstruta, slutförd rundtur och manuella checklistval

Ingen ny SQL krävs.

Testa:
1. Öppna appen lokalt.
2. Logga in.
3. Kontrollera att knappen "? Hjälp / Guide" syns i huvudmenyn.
4. Kontrollera att dashboarden visar "Kom igång".
5. Klicka "Starta rundtur".
6. Klicka igenom stegen.
7. Öppna "Funktionsguide".
8. Testa manuell avbockning i checklistan.

Teknisk notering:
Funktionen är fristående och ligger i js/features/help/onboarding-tour.js. Den använder bara DOM, localStorage och befintliga vyer/knappar. Den ändrar inte Supabase-tabeller.
