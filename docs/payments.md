# Payment Platform

SahiGadget uses one provider-neutral payment boundary. Checkout and order code select a payment requirement, the payment service selects a registered adapter, the adapter translates the provider contract, and only server-side verification may move a transaction to `PAID`.

## Current providers

| Provider | Status | Capabilities | Configuration |
|---|---|---|---|
| COD | Enabled | Create payment record, query state | Existing commerce flow |
| BDGate | Adapter implemented; runtime-enabled only when `BDGATE_LIVE_API_KEY` is present | Hosted checkout, status lookup, server verification | Server-only environment secret |
| bKash | Disabled | None registered | Not configured |
| Nagad | Disabled | None registered | Not configured |
| Rocket | Disabled | None registered | Not configured |

BDGate uses the documented `POST https://api.bdgate.net/api/v1/checkout` endpoint with the `X-API-Key` header. The adapter accepts only validated checkout values, applies an eight-second timeout, parses a narrow response shape, and returns a normalized provider reference and hosted checkout URL. Status is verified through the documented `GET /api/bdgate-pay/sessions/:token` endpoint. The browser redirect is never treated as proof of payment.

## Secret boundary

`BDGATE_LIVE_API_KEY` is read only by the server-side adapter. It is not placed in client bundles, API responses, analytics payloads, audit metadata, logs, documentation, or screenshots. The previously exposed key is considered compromised and must not be reused; the replacement must be rotated and entered through the approved server-side secret store by the owner.

## State and integrity

The `payment_transactions` table stores normalized state, provider references, amount, currency, idempotency key, expiry, paid time, and safe failure categories. It does not store raw provider payloads or payment credentials. State transitions are validated in the payment service. A transaction cannot be marked paid by browser input, and a verified payment must match the server order amount and `BDT` currency.

## Webhooks

BDGate documentation confirms webhook delivery and webhook management, but the publicly extracted reference does not define a concrete signature header or signed payload algorithm. No webhook endpoint is invented. Until the provider supplies the exact signature contract, status lookup remains the authoritative verification route. A future webhook adapter must validate signatures, replay identity, order identity, amount, currency, provider reference, and idempotency before updating payment state.

## Adding another provider

A new provider requires a contract-compatible adapter, explicit capabilities, server-only configuration, normalized status mapping, amount and currency verification, state-transition handling, and registration in `lib/payments/service.ts`. Checkout, order creation, the Risk Engine, analytics, and existing transactions must not be rewritten. Existing payment records remain permanently associated with the provider that created them.

## Current limitation

No live provider credential has been supplied or used in this task. BDGate runtime activation, sandbox verification, and Production payment validation remain pending owner-side secret configuration and approval. COD remains the only currently verified customer payment path.
