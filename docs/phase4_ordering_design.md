# Phase 4 Ordering & COD Checkout Design

Phase 4 implements a **guest-only, direct-order checkout** for one selected product variant at a time. It extends the existing relational model without touching any legacy repository, domain, or Supabase project.

## Authority boundaries

| Concern | Browser role | Server action role | Database transaction role |
|---|---|---|---|
| Product / variant selection | Submits IDs and quantity only | Validates Zod payload and invokes transaction | Re-fetches product, variant, stock, settings, and warranty data |
| Price and discount | May display public data only | Returns a server-computed review quote | Uses live variant price; calculates any snapshot discount; persists authoritative amounts |
| Delivery charge | May display a server quote only | Determines quote from the submitted division | Reads `delivery_charges` setting and persists actual charge used |
| Stock | Never changes stock | Has no stock-mutation logic outside transaction | Locks variant row, checks availability, decrements stock atomically, and writes a movement ledger row |
| Customer data | Provides untrusted form values | Validates and normalizes with Zod | Creates customer/address records and immutable order snapshots |
| Tracking | Sends order number and phone | Verifies both server-side | Returns a deliberately minimal customer-safe tracking shape |

## Database transaction

A single `SECURITY DEFINER` Postgres function, executable only by the server-side service-role client, will create the guest COD order. It will take a product ID, variant ID, quantity, customer object, delivery object, and UUID checkout request ID. The function will acquire an advisory lock on the request ID for idempotency and a row lock on the chosen variant for stock safety.

The transaction will verify that the selected product is published and that the variant is active, verify a positive quantity and sufficient stock, derive delivery zone and charge from database settings, create the customer and address records, create the `PENDING` / `COD` order, preserve all requested price, warranty, product, variant, SKU, and delivery snapshots, add the initial status-history record, decrement stock, and create a `SALE` stock-movement record. It will return only the order ID and public order number.

## Minimal schema extensions

| Object | Change | Reason |
|---|---|---|
| `orders` | Add customer email snapshot, division, district, postal-code snapshots, and unique checkout request ID | Complete historical delivery/contact record and idempotency |
| `order_items` | Add compare-at price, discount, and warranty-policy snapshots | Preserve the sold product representation even after catalogue changes |
| `public.create_guest_cod_order` | Add secure server-only RPC transaction | Establish atomic, authoritative order creation and stock protection |

## UX flow

The order route accepts the selected product slug and variant ID. A mobile-first form collects customer and delivery information, asks the server for a fresh quote, presents a dedicated review step marked **Cash on Delivery**, and submits once with a client-generated UUID idempotency key. Loading, disabled submit, Zod field errors, unavailable selection, and generic server error states are explicit.

Success is rendered from the action response in the success route's client experience. A refresh-safe fallback directs the customer to secure order tracking, which requires the professional order number plus matching phone number. No IMEI, serial number, internal notes, full address, raw customer IDs, internal inventory, or service-role credential is returned to the browser.
