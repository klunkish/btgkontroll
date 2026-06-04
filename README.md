# BTG Quality Control 3.0.6

## Hotfix i 3.0.6

Fixar att fabriksväljaren fortfarande inte syntes.

## Ändrat

- Fabriksväljaren ligger nu som en egen fast synlig panel uppe till höger.
- Den är inte längre beroende av toppfältets layout.
- Den försöker ladda fabriker flera gånger efter inloggning om auth-state kommer sent.
- Superadmin ser alla fabriker.
- Vanlig användare ser fabriker från `btg_user_access_profiles`.
- Vald fabrik sparas och skickar `btg:factory-changed`.

## Ingen ny SQL krävs

Deploya och kör Ctrl + F5.
