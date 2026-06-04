# BTG Quality Control 3.0.3

## Hotfix i 3.0.3

Fixar blinkande laddstatus och blinkande Avformningskuber.

## Orsak

Blinkningen kom inte bara från Avformningskuber. Den globala moln-/access-statusen laddades om för ofta.
Avformningskuber körde dessutom full `loadCloudCoreData()` när sidan öppnades/uppdaterades, vilket satte indikatorn till gul/grön igen.

## Ändrat

- Avformningskuber laddar nu bara sin egen avformningshistorik.
- Avformningskuber triggar inte längre full molnladdning av recept/material/satser/provningar varje gång.
- Simple access-state har debounce och skickar bara `btg:access-ready` när accessläget faktiskt ändrats.
- Navigationen bygger bara om menyn när accessläget ändrats.
- Systemcenter kör inte längre flera upprepade accesskontroller vid uppstart.
- Ingen ny SQL krävs.

## Efter deploy

Kör Ctrl + F5.
