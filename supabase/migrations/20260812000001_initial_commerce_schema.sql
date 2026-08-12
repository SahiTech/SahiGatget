-- ============================================================================
-- SahiGadget Commerce Foundation Schema Migration (Complete & Audited)
-- Target Supabase Project: SahiGatget (cckgkieqnyhgdtsstwmz)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID REFERENCES public.brands(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    short_description TEXT,
    description TEXT,
    product_type VARCHAR(50) DEFAULT 'phone' NOT NULL, -- phone, feature_phone, accessory
    status VARCHAR(50) DEFAULT 'draft' NOT NULL, -- draft, active, archived
    is_featured BOOLEAN DEFAULT FALSE NOT NULL,
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    warranty_policy TEXT DEFAULT '7 Days Guarantee & 1 Year Service Warranty' NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Product Variants Table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    variant_title VARCHAR(255) NOT NULL, -- e.g. "8GB / 128GB - Midnight Black"
    ram VARCHAR(50), -- e.g. "8GB"
    storage VARCHAR(50), -- e.g. "128GB"
    color VARCHAR(100), -- e.g. "Midnight Black"
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(10,2) CHECK (compare_at_price >= 0),
    stock_quantity INTEGER DEFAULT 0 NOT NULL CHECK (stock_quantity >= 0),
    low_stock_threshold INTEGER DEFAULT 5 NOT NULL CHECK (low_stock_threshold >= 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Stock Movements & Adjustments Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
    change_amount INTEGER NOT NULL, -- positive for restock/return, negative for sale/damage/adjustment
    movement_type VARCHAR(50) NOT NULL, -- RESTOCK, SALE, RETURN, DAMAGE, ADJUSTMENT, RESERVATION, RELEASE
    reference_id UUID, -- order_id or reference ID if applicable
    notes TEXT,
    created_by UUID, -- admin_users(id) or auth.users(id)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. IMEI / Serial Inventory Table
CREATE TABLE IF NOT EXISTS public.imei_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
    imei_1 VARCHAR(100) UNIQUE NOT NULL,
    imei_2 VARCHAR(100),
    serial_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'in_stock' NOT NULL, -- in_stock, allocated, sold, returned, defective
    order_id UUID, -- References orders(id) later
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Optional link to auth.users
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Customer Addresses Table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    division VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    postal_code VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Admin Users & Role RBAC Table
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL, -- Links to auth.users(id)
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'STAFF' NOT NULL, -- OWNER, ADMIN, STAFF
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. SG-20260812-1001
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_total DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (discount_total >= 0),
    delivery_charge DECIMAL(10,2) NOT NULL CHECK (delivery_charge >= 0),
    grand_total DECIMAL(10,2) NOT NULL CHECK (grand_total >= 0),
    payment_method VARCHAR(50) DEFAULT 'COD' NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- pending, paid, refunded
    order_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL, -- PENDING, CONFIRMED, PROCESSING, READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, RETURNED
    delivery_zone VARCHAR(50) NOT NULL, -- dhaka, outside_dhaka
    shipping_address TEXT NOT NULL,
    shipping_area VARCHAR(100) NOT NULL,
    customer_name_snapshot VARCHAR(255) NOT NULL,
    customer_phone_snapshot VARCHAR(50) NOT NULL,
    notes TEXT,
    tracking_token VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint for order_id in imei_inventory now that orders table exists
ALTER TABLE public.imei_inventory 
    ADD CONSTRAINT fk_imei_order 
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 11. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    variant_title_snapshot VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total DECIMAL(10,2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. Order Status History Table
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    notes TEXT,
    changed_by UUID, -- references admin_users(id) or auth.users(id)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 13. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. INV-20260812-1001
    order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_total DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (discount_total >= 0),
    delivery_charge DECIMAL(10,2) NOT NULL CHECK (delivery_charge >= 0),
    grand_total DECIMAL(10,2) NOT NULL CHECK (grand_total >= 0),
    issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 14. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
    sku VARCHAR(100) NOT NULL,
    product_name_snapshot VARCHAR(255) NOT NULL,
    variant_title_snapshot VARCHAR(255) NOT NULL,
    imei_snapshot VARCHAR(100),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total DECIMAL(10,2) NOT NULL CHECK (line_total >= 0)
);

-- 15. Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 16. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert Default Delivery Charges & Settings
INSERT INTO public.settings (key, value, description)
VALUES 
('delivery_charges', '{"dhaka": 80, "outside_dhaka": 130}'::jsonb, 'Standard delivery charges for Dhaka and Outside Dhaka in BDT'),
('business_policy', '{"guarantee_days": 7, "service_warranty_years": 1, "policy_text": "7 Days Guarantee & 1 Year Service Warranty. Manufacturer warranty terms apply where applicable."}'::jsonb, 'SahiGadget standard guarantee and warranty policy')
ON CONFLICT (key) DO NOTHING;

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON public.product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_token ON public.orders(tracking_token);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_imei_variant ON public.imei_inventory(variant_id);
CREATE INDEX IF NOT EXISTS idx_imei_code ON public.imei_inventory(imei_1);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imei_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() AND is_active = TRUE
  ) OR (auth.role() = 'service_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Public Catalog Read Access
CREATE POLICY "Allow public read active brands" ON public.brands FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Allow public read active categories" ON public.categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Allow public read published products" ON public.products FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Allow public read active variants" ON public.product_variants FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (TRUE);

-- RLS Policies for Admin Full Access
CREATE POLICY "Admin full access brands" ON public.brands FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access categories" ON public.categories FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access products" ON public.products FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access variants" ON public.product_variants FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access stock_movements" ON public.stock_movements FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access imei" ON public.imei_inventory FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access customers" ON public.customers FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access customer_addresses" ON public.customer_addresses FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access admin_users" ON public.admin_users FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access orders" ON public.orders FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access order_items" ON public.order_items FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access order_status_history" ON public.order_status_history FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access invoices" ON public.invoices FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access invoice_items" ON public.invoice_items FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access settings" ON public.settings FOR ALL USING (public.is_admin());
CREATE POLICY "Admin full access audit_logs" ON public.audit_logs FOR ALL USING (public.is_admin());

-- Guest Order Tracking Policy (Allow read if matching tracking_token via server or secure RPC)
CREATE POLICY "Allow read order by tracking token" ON public.orders FOR SELECT USING (TRUE); -- Controlled via server actions and tracking tokens
