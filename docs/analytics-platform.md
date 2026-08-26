# SahiGadget Commerce Analytics Platform

## Purpose and boundaries

The analytics layer sits above the existing Commerce Operations Foundation. Existing product, cart, checkout, order, payment, delivery, risk, and AI systems remain authoritative. The platform records one canonical commerce event and optionally forwards a privacy-sanitized copy to configured destinations. Analytics failures are best-effort and must never block cart, checkout, or order creation.

## Event lifecycle

A storefront interaction creates a versioned event with a stable `eventId`, timestamp, session and anonymous identifiers, route context, attribution, device metadata, consent state, and an optional sanitized commerce payload. The client dispatches to the local data layer and asynchronously posts the same event to `/api/analytics`. The server validates the contract, persists it in the existing `commerce_events` table, applies the privacy boundary, and forwards it to configured provider adapters. Duplicate logical events are ignored by `event_id`; purchase events use `purchase:<orderId>` and originate only from the server-loaded successful order summary.

## Canonical events

The contract supports page, catalogue, search, cart, checkout, purchase, refund, lead, contact, support, attribution, recovery-ready, risk, and order lifecycle events. Each event uses `eventVersion: "1.0"`. Commerce payloads are limited to safe catalogue and transaction fields such as SKU, product name, category, price, quantity, currency, value, shipping, and transaction ID.

## Providers

GA4 uses the Measurement Protocol on the server when `GA4_API_SECRET` and the configured measurement ID are present. Browser GA4 uses the same event ID and BDT currency mapping. GTM receives the centralized versioned `dataLayer` contract and can be enabled with `NEXT_PUBLIC_GTM_CONTAINER_ID` or the server-side endpoint setting. Meta Pixel maps canonical events to `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`, `Search`, `Contact`, and `PageView`. Meta Conversions API is server-only, requires `META_CAPI_ACCESS_TOKEN`, and is gated by both marketing consent and admin configuration. Server-side GTM receives sanitized events through the configured HTTPS endpoint.

## Consent and privacy

Necessary commerce behavior is independent of optional tracking. Analytics and marketing default to off until the visitor chooses. Analytics-denied events are not dispatched to analytics destinations; marketing-denied events are never sent to Meta destinations. The sanitizer rejects keys containing phone, email, address, password, token, secret, authorization, payment, notes, message, cookie, IP, or user-agent terms. Raw customer addresses, phone numbers, private notes, payment credentials, API keys, and authorization headers never enter provider payloads or browser analytics.

## Attribution

The client captures first-touch and last-touch UTM context plus `gclid`, `fbclid`, and `ttclid` in session storage. Attribution is attached to canonical events without overwriting first-touch context. Purchase reporting uses the authoritative order total and item snapshot, not browser-submitted subtotal or quantity.

## Admin configuration

`/admin/analytics` uses the existing authenticated operations shell and settings/audit infrastructure. IDs and feature flags are editable; server credentials remain environment-managed and masked by design. Synthetic page view, view item, add-to-cart, begin-checkout, and purchase tests are marked `test_mode: true`; the purchase test never creates an order. The control center reports configured status and does not decrypt or display provider secrets.

## Reliability and performance

Provider requests use bounded timeouts, at most one retry, `Promise.allSettled`, and sanitized failure categories. Storefront scripts load lazily once and data-layer pushes are non-blocking. Route rendering and essential commerce interactions do not wait for analytics. The local ingestion route accepts only validated canonical events and returns a safe response on failure.

## Adding a provider or event

Add a canonical event to the shared event list, define only safe commerce fields, update the server adapter mapping, and add contract, consent, sanitization, deduplication, and regression tests. A new commerce project can reuse the core by replacing provider configuration, the commerce mapper, and site configuration; internal SahiGadget names should remain outside the core contracts.

## Environment variables

Use independent values per environment. Development is disabled by default. Preview must use safe test IDs and never inherit Production destinations accidentally. Production uses real IDs only after an explicit readiness decision. Supported server-only values include `GA4_API_SECRET`, `META_CAPI_ACCESS_TOKEN`, and an HTTPS server-side GTM endpoint. Public browser identifiers are limited to `NEXT_PUBLIC_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_GTM_CONTAINER_ID`, and `NEXT_PUBLIC_META_PIXEL_ID`; no server credential uses a `NEXT_PUBLIC_` name.

## Validation

Run TypeScript, ESLint, production build, `git diff --check`, event contract validation, consent denial/grant checks, sanitizer tests, attribution tests, stable purchase ID checks, data-layer/provider mapping tests, admin authorization tests, secret scans, and forbidden-project scans. Runtime validation must remain read-only: do not create customer orders, payments, shipments, or courier requests.
