# SahiGadget Database & Core Commerce Architecture

This document defines the production-grade relational database schema and architecture for **SahiGadget** (`SahiTech/SahiGatget`), hosted in the authorized Supabase Production project.

---

## 1. Architectural Overview

The schema is built for high performance, data integrity, concurrency safety, and historical auditability. It supports:
* **Product Catalog & Variants**: Multi-attribute variants (RAM, storage, color) with standalone pricing and inventory.
* **Inventory & Concurrency**: Atomic stock allocation, low-stock thresholds, and stock movement logs.
* **IMEI & Serial Number Tracking**: Unique device tracking for mobile phones with assignment history.
* **Historical Orders & Invoices**: Snapshot preservation of product names, variants, pricing, and delivery charges at checkout to ensure invoices remain immutable over time.
* **Guest Checkout & Security**: Secure guest checkout workflows without mandatory account creation, backed by RLS policies protecting sensitive operational data.

---

## 2. Relational Schema Definition

### A. Brands (`brands`)
* `id` (UUID, PK)
* `name` (VARCHAR, UNIQUE, NOT NULL)
* `slug` (VARCHAR, UNIQUE, NOT NULL)
* `logo_url` (TEXT)
* `description` (TEXT)
* `is_active` (BOOLEAN, DEFAULT TRUE)
* `meta_title` (VARCHAR)
* `meta_description` (TEXT)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### B. Categories (`categories`)
* `id` (UUID, PK)
* `name` (VARCHAR, NOT NULL)
* `slug` (VARCHAR, UNIQUE, NOT NULL)
* `description` (TEXT)
* `image_url` (TEXT)
* `sort_order` (INTEGER, DEFAULT 0)
* `is_active` (BOOLEAN, DEFAULT TRUE)
* `meta_title` (VARCHAR)
* `meta_description` (TEXT)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### C. Products (`products`)
* `id` (UUID, PK)
* `brand_id` (UUID, FK -> brands.id)
* `category_id` (UUID, FK -> categories.id)
* `name` (VARCHAR, NOT NULL)
* `slug` (VARCHAR, UNIQUE, NOT NULL)
* `short_description` (TEXT)
* `description` (TEXT)
* `product_type` (VARCHAR, DEFAULT 'phone') -- phone, feature_phone, accessory
* `status` (VARCHAR, DEFAULT 'draft') -- draft, active, archived
* `is_featured` (BOOLEAN, DEFAULT FALSE)
* `is_published` (BOOLEAN, DEFAULT FALSE)
* `warranty_policy` (TEXT, DEFAULT '7 Days Guarantee & 1 Year Service Warranty')
* `meta_title` (VARCHAR)
* `meta_description` (TEXT)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### D. Product Variants (`product_variants`)
* `id` (UUID, PK)
* `product_id` (UUID, FK -> products.id ON DELETE CASCADE)
* `sku` (VARCHAR, UNIQUE, NOT NULL)
* `variant_title` (VARCHAR, NOT NULL) -- e.g., "8GB / 128GB - Midnight Black"
* `ram` (VARCHAR) -- e.g., "8GB"
* `storage` (VARCHAR) -- e.g., "128GB"
* `color` (VARCHAR) -- e.g., "Midnight Black"
* `price` (DECIMAL(10,2), NOT NULL)
* `compare_at_price` (DECIMAL(10,2))
* `stock_quantity` (INTEGER, DEFAULT 0, NOT NULL)
* `low_stock_threshold` (INTEGER, DEFAULT 5)
* `is_active` (BOOLEAN, DEFAULT TRUE)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### E. IMEI / Serial Numbers (`imei_inventory`)
* `id` (UUID, PK)
* `variant_id` (UUID, FK -> product_variants.id ON DELETE CASCADE)
* `imei_1` (VARCHAR, UNIQUE, NOT NULL)
* `imei_2` (VARCHAR)
* `serial_number` (VARCHAR)
* `status` (VARCHAR, DEFAULT 'in_stock') -- in_stock, allocated, sold, returned, defective
* `order_id` (UUID, NULLABLE)
* `sold_at` (TIMESTAMPTZ)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### F. Customers (`customers`)
* `id` (UUID, PK)
* `user_id` (UUID, NULLABLE) -- Optional link to auth.users if registered
* `full_name` (VARCHAR, NOT NULL)
* `phone` (VARCHAR, NOT NULL)
* `email` (VARCHAR)
* `notes` (TEXT)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### G. Orders (`orders`)
* `id` (UUID, PK)
* `order_number` (VARCHAR, UNIQUE, NOT NULL) -- e.g., SG-20260812-XXXX
* `customer_id` (UUID, FK -> customers.id)
* `subtotal` (DECIMAL(10,2), NOT NULL)
* `discount_total` (DECIMAL(10,2), DEFAULT 0.00)
* `delivery_charge` (DECIMAL(10,2), NOT NULL)
* `grand_total` (DECIMAL(10,2), NOT NULL)
* `payment_method` (VARCHAR, DEFAULT 'COD') -- COD
* `payment_status` (VARCHAR, DEFAULT 'pending') -- pending, paid, refunded
* `order_status` (VARCHAR, DEFAULT 'PENDING') -- PENDING, CONFIRMED, PROCESSING, READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, RETURNED
* `delivery_zone` (VARCHAR, NOT NULL) -- dhaka, outside_dhaka
* `shipping_address` (TEXT, NOT NULL)
* `shipping_area` (VARCHAR, NOT NULL)
* `customer_name_snapshot` (VARCHAR, NOT NULL)
* `customer_phone_snapshot` (VARCHAR, NOT NULL)
* `notes` (TEXT)
* `tracking_token` (VARCHAR, UNIQUE, NOT NULL) -- Secure public tracking token
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### H. Order Items (`order_items`)
* `id` (UUID, PK)
* `order_id` (UUID, FK -> orders.id ON DELETE CASCADE)
* `product_id` (UUID, NULLABLE)
* `variant_id` (UUID, NULLABLE)
* `sku` (VARCHAR, NOT NULL)
* `product_name_snapshot` (VARCHAR, NOT NULL)
* `variant_title_snapshot` (VARCHAR, NOT NULL)
* `unit_price` (DECIMAL(10,2), NOT NULL)
* `quantity` (INTEGER, NOT NULL)
* `line_total` (DECIMAL(10,2), NOT NULL)
* `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### I. Settings & Config (`settings`)
* `id` (UUID, PK)
* `key` (VARCHAR, UNIQUE, NOT NULL)
* `value` (JSONB, NOT NULL)
* `description` (TEXT)
* `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

---

## 3. Security & Row Level Security (RLS) Strategy

1. **Public Read-Only Catalog**: `brands`, `categories`, `products`, and `product_variants` have RLS enabled with policies allowing public read access to active/published items.
2. **Protected Operational Data**: `imei_inventory`, `customers`, `orders`, and `order_items` restrict public read access entirely. Guests can create orders via a secure server action, and track orders using their unique `tracking_token`.
3. **Admin Privileges**: Administrative users authenticated via Supabase Auth with admin claims have full management access across all tables.
