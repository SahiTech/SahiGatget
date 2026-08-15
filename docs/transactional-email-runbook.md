# SahiGadget Transactional Email Runbook

## Required production configuration

Configure these variables in the authorized Vercel project `sahi-gatget` for Production only:

| Variable | Purpose | Secret |
| --- | --- | --- |
| `RESEND_API_KEY` | Server-only authorization for the Resend email API. | Yes |
| `RESEND_WEBHOOK_SECRET` | Optional server-only signing secret for `/api/webhooks/resend`. | Yes |

The application does not expose either variable to the browser and does not include values in source control.

## Sender-domain prerequisite

Verify the sending domain or subdomain in Resend before enabling production notifications. The application sender remains `orders@mail.sahigadget.shop`, and the reply-to/support mailbox remains `hello@sahigadget.shop`. Configure the DNS records shown by Resend, including SPF/DKIM and an appropriate DMARC policy, before live sends.

## Webhook setup

If delivery-state updates are required, configure a Resend webhook pointed at:

`https://www.sahigadget.shop/api/webhooks/resend`

Subscribe to `email.sent`, `email.delivered`, `email.failed`, and `email.bounced`. Store the returned signing secret as `RESEND_WEBHOOK_SECRET` in Vercel Production. The endpoint verifies the raw request body and Svix headers before updating a matching notification row.

## Failure behavior

Order creation and admin status transitions remain authoritative database operations. If Resend is unavailable, unconfigured, or rejects a request, the order/status operation remains successful and the isolated notification row records the attempt and error. The admin order detail view shows notification state, provider ID, attempt count, and the bounded error message.

## Verification checklist

1. Confirm the `email_notifications` migration is applied to Supabase project ref `ncknpaezdhsqiicdjtgr`.
2. Configure `RESEND_API_KEY` in Vercel Production without exposing it in logs.
3. Verify the sending domain and confirm the sender address is authorized.
4. Create one controlled test order using a permitted test recipient.
5. Confirm one customer event and one admin event exist for the order, each with a distinct deterministic event key.
6. Confirm the Resend provider message ID is recorded and no duplicate is created on a repeated action.
7. Configure and test the webhook only after signature verification is enabled.
8. Confirm a status transition creates exactly one status event and delivery state updates appear in admin order detail.
9. Confirm failed email delivery never rolls back order creation or status changes.
