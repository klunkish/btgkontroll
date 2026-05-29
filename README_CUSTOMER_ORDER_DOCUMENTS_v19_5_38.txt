BTG Quality Control v19.5.38 – Kund & Beställningsdokument

NY FUNKTION
- Ny knapp i vanliga appmenyn: Offert / Faktura
- Funktionen är kopplad till Kunder & Beställningar
- Skapar offert, faktura, orderbekräftelse och beställningsunderlag

KÖR SQL
Kör denna fil i Supabase SQL Editor:
sql/19_5_38_customer_order_documents.sql

NYA FILER
- css/customer-order-documents.css
- js/features/orders/customer-order-documents.js
- sql/19_5_38_customer_order_documents.sql
- README_CUSTOMER_ORDER_DOCUMENTS_v19_5_38.txt

ÄNDRAD FIL
- BTG_Quality_Control_v19_5_29_modular.html

FUNKTIONER
- Välj dokumenttyp: Offert, Faktura, Orderbekräftelse, Beställningsunderlag
- Välj kund och beställning/order
- Lägg in prisrader med antal, enhet, pris/st, rabatt och moms
- Välj via checkboxar vad som ska vara med i PDF-vyn
- Spara dokumenthistorik i Supabase
- Öppna tidigare dokument
- Skapa utskriftsvy och spara som PDF via webbläsaren

PDF
Första versionen använder webbläsarens utskrift:
Skriv ut -> Spara som PDF

NOTERING
Modulen försöker läsa kunder från tabellerna customers/btg_customers och beställningar från orders/btg_orders.
Om din databas använder andra tabellnamn kan vi lägga till fler sökvägar i nästa patch.
