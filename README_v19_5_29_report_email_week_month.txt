BTG Quality Control v19.5.29 – Vecko-/månadsrapporter till mail

Bas: v19.5.28 factory data isolation.

Ny funktion:
- Knapparna "Veckorapport" och "Månadsrapport" finns i Tillverkningsdata > Tillverkningsjournal.
- Veckorapport visar valbar veckolista.
- Månadsrapport visar valbar månadslista.
- Rapporten delas upp i Prefab och Beställning.
- Rapporten öppnas som utskrifts-/PDF-fönster och appen öppnar samtidigt ett förifyllt mailutkast till sparad rapportmailadress.
- Rapportmailadressen kan anges i rapportdialogen eller i Inställningar.

Viktigt:
Ren klient-HTML kan inte skicka e-post helt automatiskt utan mailtjänst/serverfunktion. Denna version använder därför mailto: och kräver att datorn/mobilen har en e-postklient eller webbmail-hanterare kopplad. För helt automatisk e-postsändning behöver vi lägga till en Supabase Edge Function med t.ex. Resend/Sendgrid senare.

Deploy:
1. Deploya HTML-filen BTG_Quality_Control_v19_5_29_report_email_week_month.html.
2. Ingen ny SQL krävs jämfört med v19.5.28/v19.5.26.
