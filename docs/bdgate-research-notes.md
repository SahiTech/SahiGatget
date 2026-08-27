# BDGate research notes

Source: https://docs.bdgate.net/

Verified from the official BDGate docs on 2026-08-27:

- The API base URL is `https://api.bdgate.net/api`.
- API requests use the `X-API-Key` header.
- The docs identify live keys with the `bd_live_` prefix and sandbox keys with the `bd_test_` prefix.
- The documented primary checkout endpoint is `POST https://api.bdgate.net/api/v1/checkout`.
- The documentation warns that API keys can create payments and must not be exposed in frontend JavaScript or committed to a repository.
- The docs describe BDGate as supporting hosted checkout and real-time IPN/webhooks, but endpoint-level callback and verification details still need to be extracted before implementation.

No credential was requested, copied, displayed, or used. The previously supplied live key is treated as compromised and will not be reused.


Additional verified findings from the official API reference:

- The recommended endpoint is `POST https://api.bdgate.net/api/v1/checkout`.
- Required headers are `X-API-Key` and `Content-Type: application/json`.
- Checkout fields include amount, order_id, customer_name, optional customer email/phone, currency, description, success_url/callback_url, fail_url, cancel_url, webhook_url, and metadata.
- The official docs describe a hosted checkout response containing `payment_url`; the complete response and status examples still require extraction from the API section before coding against them.
- The webhook reference documents webhook settings and webhook delivery logs, but the extracted page does not yet expose a concrete signed payload schema or signature-header algorithm. Incoming callbacks must therefore remain untrusted until those details are verified from the provider’s documentation or sandbox behavior.
- The official docs show webhook support exists, but do not justify inventing a signature implementation.
