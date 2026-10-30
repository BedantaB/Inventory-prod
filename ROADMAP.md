# Roadmap

Ideas that are **not** part of v1. Each one waits for the owner's go-ahead.

## Money and tax

- **GST**: GST rate and HSN code per item, customer GSTIN, CGST/SGST/IGST breakdown, and
  GST-compliant tax invoices. Order lines would need to store the rate and HSN at the time of sale.
- **Customer statement**: a printable list of a customer's orders and payments with the running
  balance, and payment reminders by WhatsApp or SMS (payments and outstanding are built).
- **Profit reports**: sales minus cost per order, item, customer and month. The data is already
  captured, because every sale records the average cost at the time of sale.

## Stock

- **Stock count sheet**: count many items in one go (today each item is corrected on its own
  page).
- **Suppliers**: record who supplied each Add Stock bill, and keep purchase history per supplier.
- **List of all stock bills**: browse every Add Stock entry by date or bill number. Today a bill
  is reached from the item's stock history.
- **Loose selling from packs**: sell single pieces out of a box, with unit conversion.
- **Multiple godowns**: track stock per location, and move stock between them.
- **Barcode scanning**: use the phone camera to find items quickly.

## Orders

- **Partial returns**: take back some items of an order (today the whole order is cancelled).
- **PDF and WhatsApp sharing**: send the order or invoice to the customer.
- **Reserving stock for drafts**: hold stock while a cart is open.

## Other

- **Hindi UI**: add `hi` messages next to `src/i18n/en`.
- **Reports export**: download items, stock and orders as CSV or Excel.
- **Excel (.xlsx) import**: import directly without saving as CSV first.
- **Bulk price update**: change MRP or selling prices for many items at once (for example
  when DOMS sends a new price list).
- **Activity log**: who changed what, for item edits and archiving.
- **Offline mode** for weak godown signal.
- **Dark mode**: optional in the brief and not built. The colours are already set up for it in
  `globals.css`.
