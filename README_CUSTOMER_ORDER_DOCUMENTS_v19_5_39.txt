BTG Quality Control v19.5.39 – Kund & Beställningsdokument, kund/order fix

PROBLEM SOM FIXAS
- Offert/Faktura-modulen öppnade men visade inga kunder eller beställningar i listorna.

ORSAK
- Förra versionen filtrerade kunder/beställningar på factory_id/factoryId direkt mot tabellerna.
- Dina befintliga customers/orders-tabeller använder i grunden user_id och appens egna laddade listor.
- Därför kunde Supabase-frågan falla tillbaka till tom lista.

ÄNDRAD FIL
- js/features/orders/customer-order-documents.js

VAD FIXEN GÖR
- Läser kunder och beställningar från appens redan laddade CUSTOMERS/ORDERS-listor.
- Läser även från window-varianter om appen har lagt dem där.
- Läser från localStorage som extra fallback.
- Läser från Supabase-tabellerna customers/btg_customers och orders/btg_orders utan felaktigt factory_id-filter.
- Normaliserar flera olika fältnamn, t.ex. name, customer_name, order_name, recipeName.
- Visar tydligare meddelande om inga kunder/beställningar hittas.

SQL
- Ingen ny SQL krävs om du redan har kört 19_5_38_customer_order_documents.sql.

TEST
1. Packa upp zippen.
2. Ladda om appen helt.
3. Öppna Offert / Faktura.
4. Kontrollera att kunder och beställningar nu syns i listorna.
