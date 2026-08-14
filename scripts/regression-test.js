/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log('--- Phase 8 Regression Tests ---');
  
  // 1. Guest Checkout
  const { data: orders, error: orderError } = await supabase.rpc('create_guest_cod_order', {
    p_product_id: '8d779e3a-3a03-4a9f-90b6-391b8902356a',
    p_variant_id: '0161c7e0-f35b-473a-853e-aba3ee66ada5',
    p_quantity: 1,
    p_checkout_request_id: require('crypto').randomUUID(),
    p_customer_name: 'Regression Test User',
    p_customer_phone: '01700000000',
    p_customer_email: 'test@example.com',
    p_division: 'Dhaka',
    p_district: 'Dhaka',
    p_area: 'Gulshan',
    p_address: 'Test Address',
    p_postal_code: '1212',
    p_notes: 'Test Notes'
  });
  
  if (orderError) {
    console.error('FAIL: Guest Checkout Regression -', orderError.message);
  } else {
    const order = Array.isArray(orders) ? orders[0] : orders;
    console.log('PASS: Guest Checkout Regression - Created Order:', order.order_number);
    
    // 2. Invoice Generation
    const { data: invoices, error: invoiceError } = await supabase.rpc('ensure_invoice_for_order', {
      p_order_id: order.order_id
    });
    
    if (invoiceError) {
      console.error('FAIL: Invoice Regression -', invoiceError.message);
    } else {
      const invoice = Array.isArray(invoices) ? invoices[0] : invoices;
      console.log('PASS: Invoice Regression - Created Invoice:', invoice.invoice_number);
    }
  }
  
  // 3. Storefront Access
  const { error: productsError } = await supabase.from('products').select('name').limit(1);
  if (productsError) {
    console.error('FAIL: Storefront Regression -', productsError.message);
  } else {
    console.log('PASS: Storefront Regression - Fetched Products');
  }
}

runTests();
