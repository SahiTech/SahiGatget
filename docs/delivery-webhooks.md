# Delivery Webhook Architecture

## Pathao production endpoint

`POST /api/webhooks/pathao`

The endpoint is deliberately isolated from the Admin UI. Pathao calls it directly, so an authenticated browser session is not required.

## Security

Configure `PATHAO_WEBHOOK_SECRET` only in the deployment environment. Never commit the secret. The route validates `X-Pathao-Merchant-Webhook-Integration-Secret` with a constant-time comparison and returns the same header on accepted requests as required by Pathao's integration handshake.

## Processing

1. Parse and normalize the provider payload in `lib/delivery/pathao-webhook.ts`.
2. Record the event in `delivery_webhook_events` using the provider event ID (or a deterministic payload hash when the provider does not supply one).
3. Locate the shipment by provider shipment ID or tracking number.
4. Update the provider snapshot and, when safe, the normalized shipment status.
5. Append `shipment_history` with source `WEBHOOK`.
6. Append a `delivery_audit_logs` record.
7. Mark the webhook event processed.

Duplicate events are ignored. Terminal states are protected from delayed backward-moving webhooks.

## Reuse for future couriers

Keep the persistence and normalized delivery contracts provider-agnostic. A new courier should add:

- provider adapter
- provider-specific webhook normalizer
- provider-specific webhook route/authentication
- status mapping into `ShipmentStatus`

Do not place provider secrets in frontend code or database JSON snapshots. Do not create shipments from a webhook handshake or read-only verification request.
