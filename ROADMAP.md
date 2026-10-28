# Roadmap

Ideas that are **not** part of v1. Each one waits for the owner's go-ahead.

## Money and tax

- **GST**: GST rate and HSN code per item, customer GSTIN, CGST/SGST/IGST breakdown, and
  GST-compliant tax invoices. Order lines would need to store the rate and HSN at the time of sale.
- **Payments and credit (udhaar)**: record payments against orders, customer balances, and an
  outstanding dues list.
- **Profit reports**: sales minus cost per order, item, customer and month. The data is already
  captured, because every sale records the average cost at the time of sale.

## Stock

- **Stock correction screen**: count the shelf and fix the number (`ADJUST` movements already
  exist in the database), with a required reason.
- **Suppliers**: record who supplied each Add Stock bill, and keep purchase history per supplier.
- **Loose selling from packs**: sell single pieces out of a box, with unit conversion.
- **Multiple godowns**: track stock per location, and move stock between them.
- **Barcode scanning**: use the phone camera to find items quickly.

## Orders

- **Cancel or return an order**: put the stock back with a reversing movement.
- **PDF and WhatsApp sharing**: send the order or invoice to the customer.
- **Reserving stock for drafts**: hold stock while a cart is open.

## Other

- **Hindi UI**: add `hi` messages next to `src/i18n/en`.
- **Reports export**: download items, stock and orders as CSV or Excel.
- **Activity log**: who changed what, for item edits and archiving.
- **Offline mode** for weak godown signal.
