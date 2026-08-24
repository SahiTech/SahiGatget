# Phase 5 — Admin Operations Design

## Scope and isolation

Phase 5 builds administration only in the `phase-5-admin-operations` branch of the isolated `SahiTech/SahiGatget` repository. The target database is the authorized Supabase production project and the target deployment project is `sahi-gatget`. No legacy repository, legacy Supabase project, DNS record, Cloudflare configuration, `sahigadget.shop`, or default Vercel alias is in scope.

## Trust boundary

The browser has no privileged database capability. All administrative reads and writes are initiated by server-rendered pages and server actions. A request must first resolve a real Supabase Auth user from the request cookie, then resolve an active `admin_users` record in server-only authorization code. The service-role client is used only after this check, is never imported by a client component, and has no public environment variable.

| Role | Server-enforced capability |
|---|---|
| `OWNER` | All operational data, settings, audit logs, staff records, image management, IMEI/serial management, and destructive/archive actions. |
| `ADMIN` | Catalogue, brands, categories, variants, images, stock, IMEI/serial records, customer/order operations, and normal operational settings. It cannot administer staff roles or owner-only policy/store controls. |
| `STAFF` | Read operational catalogue/customer/order data, update permitted order statuses, and create controlled stock movements. It has no settings, staff administration, audit-log, IMEI/serial, product/price, or role-management access. |

The exact server action checks are stricter than UI visibility. Hiding a menu item is not authorization.

## Data integrity

`product_images` will store only public product-image metadata and a storage path. Product media is stored in a dedicated Supabase Storage bucket with an image-only MIME allow-list and a five-megabyte file limit. Browser uploads use a server action after role validation; storage objects never contain IMEI, invoice, customer, or other internal documents.

Stock changes use a service-role-only, security-definer database transaction. It locks the selected variant, validates the supported movement type, rejects a negative resulting quantity, changes the authoritative stock balance, inserts an immutable movement ledger record, and writes an audit event. Order-status changes follow a predefined lifecycle, update the current status, append immutable history, and audit the operation in the same transaction.

Catalogue, brand, category, variant, image, settings, and IMEI operations are validated by Zod on the server. Logical archive/deactivation is preferred over destructive deletes where business records can depend on an entity. Historical order and order-item snapshots remain untouched.

## RLS and grants

Existing public storefront policy remains limited to published/active catalogue data, boolean stock availability through `storefront_variants`, and the two established public setting keys. Phase 5 adds role-aware private helpers and keeps all sensitive table operations unavailable to direct browser roles. Server actions enforce the final role matrix before using the service role. RLS remains defence in depth; it is not replaced by client-side checks.

## Administration routes

| Route | Primary operation |
|---|---|
| `/admin/login` | Supabase Auth sign-in and protected redirect. |
| `/admin` and `/admin/dashboard` | Operational metrics, recent orders, low-stock alerts. |
| `/admin/products` | Product, variant, brand, category, and image management. |
| `/admin/inventory` | Stock ledger, adjustment workflow, and owner/admin IMEI/serial management. |
| `/admin/orders` | Searchable order list, customer/order detail, and lifecycle updates. |
| `/admin/customers` | Privacy-bounded customer and order-history view. |
| `/admin/settings` | Warranty, delivery, store information, return/refund policy, audit activity, and owner-only role management. |

## Authentication provisioning note

The specified owner email has no `auth.users` or `admin_users` record in the isolated project at the beginning of Phase 5. The application will support Supabase Auth immediately, but a live owner sign-in test will require an authenticated identity to be created or accepted for that email and then assigned the `OWNER` role. No password will be created, requested, transmitted, or logged by this implementation.
