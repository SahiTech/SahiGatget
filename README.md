# SahiGadget E-Commerce Platform

> **"সঠিক দাম, সঠিক গ্যাজেট"**  
> **আসল পণ্য • দ্রুত ডেলিভারি • সারা দেশে সেবা**

## 1. Project Purpose
SahiGadget is a professional e-commerce platform specializing in official mobile phones and smart gadgets in Bangladesh. Established in 2019 and based in Araihazar, Narayanganj, the platform provides authentic devices, transparent pricing, nationwide delivery, and robust warranty support.

This repository (**SahiTech/SahiGatget**) represents **Phase 1 — Clean Production Foundation**, establishing a rigorous, secure, and scalable technical architecture using modern web standards.

---

## 2. Business Overview
- **Business Name**: SahiGadget Mobile Phone & Gadget Shop
- **Repository**: [SahiTech/SahiGatget](https://github.com/SahiTech/SahiGatget)
- **Website**: [https://sahigadget.shop](https://sahigadget.shop)
- **Location**: Araihazar, Narayanganj, Bangladesh – 1460
- **Contact**: +880 1601-654316 | www.sahigadget.com@gmail.com
- **Admin Support**: helpline.sahitech@gmail.com
- **Currency**: BDT (৳)
- **Delivery Charges**: Dhaka ৳80 | Outside Dhaka ৳130 (Server-calculated)
- **Warranty Policy**: 7 Days Guarantee & 1 Year Service Warranty (Configurable)

---

## 3. Technology Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & shadcn/ui primitives
- **Icons**: Lucide React
- **Database & Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Validation**: Zod & React Hook Form
- **Tables**: TanStack Table
- **Notifications**: Sonner
- **Charts**: Recharts
- **Deployment**: Vercel

---

## 4. Local Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- pnpm

### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/SahiTech/SahiGatget.git sahigatget
   cd sahigatget
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Configure environment variables:
   Copy `.env.example` to `.env.local` and fill in your Supabase project credentials.
   ```bash
   cp .env.example .env.local
   ```
4. Run development server:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_SITE_URL=https://sahigadget.shop
```

---

## 6. Development & Build Commands
- **Development**: `pnpm dev`
- **Production Build**: `pnpm build`
- **Start Production Server**: `pnpm start`
- **Linting**: `pnpm lint`

---

## 7. Architecture & Route Structure
```
app/
├── page.tsx                    # Homepage
├── products/                   # Product catalog
│   └── [slug]/                 # Product landing page
├── brands/                     # Brand browsing
├── categories/                 # Category browsing
├── search/                     # Fast search engine
├── order/                      # Checkout & customer details
│   └── success/                # Order confirmation
├── track-order/                # Order tracking
└── admin/                      # Secure admin portal
    ├── login/                  # Admin authentication
    ├── dashboard/              # Sales overview & analytics
    ├── orders/                 # Order management
    ├── products/               # Product CRUD
    ├── inventory/              # Stock adjustment & IMEI tracking
    ├── customers/              # Customer records
    └── settings/               # Store settings & delivery config
```

---

## 8. Security Notes
- **Server-Only Secrets**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side modules using `server-only` to prevent client exposure.
- **Server Validation**: Prices, discounts, delivery charges, and stock quantities are validated server-side.
- **Authentication**: Role-based access control preparation for OWNER, ADMIN, and STAFF roles via Supabase Auth.

---

## 9. Git Workflow & Deployment
- Developed on branch `main` in repository `SahiTech/SahiGatget`.
- Vercel-ready with zero configuration required beyond environment variables.
- Verified linting, TypeScript compilation, and production build.

---
*(c) 2019–2026 SahiGadget. All rights reserved.*
