import type { Metadata } from 'next'

import { PolicyPage } from '@/components/storefront/policy-page'

export const metadata: Metadata = {
  title: 'Terms & Conditions · SahiGadget',
  description: 'The terms that apply to browsing, ordering, verification, delivery, warranty, and customer use of SahiGadget.',
}

export default function TermsPage() {
  return <PolicyPage
    eyebrow="Store guidelines"
    title="Terms & Conditions"
    description="These terms explain how SahiGadget handles product information, orders, verification, delivery, customer responsibilities, and support. They are intended to be read together with the applicable product and service policies."
    sections={[
      { id: 'introduction', title: '1. Introduction', body: 'By using the SahiGadget website or placing an order, you agree to use the service lawfully and to provide information that is accurate enough for order verification and delivery. These terms are subject to applicable Bangladesh law and do not remove mandatory customer rights.' },
      { id: 'eligibility', title: '2. Eligibility to purchase', body: 'Customers should be legally able to place an order and should provide a reachable phone number and accurate delivery information. If a customer is ordering on behalf of another person, the customer remains responsible for the accuracy of the order details provided.' },
      { id: 'product-information', title: '3. Product information', paragraphs: [
        'SahiGadget makes reasonable efforts to maintain accurate product names, descriptions, specifications, images, variants, stock information, and prices. Product appearance, packaging, accessories, or manufacturer specifications may vary where applicable.',
        'Images and specifications are provided to help customers make an informed decision. Customers may contact support before ordering if a specific specification or included item is important to the purchase.'
      ]},
      { id: 'pricing-availability', title: '4. Pricing and availability', paragraphs: [
        'Products are offered subject to availability. A product may become unavailable, require verification, or be removed from sale without prior notice where legally permissible.',
        'If an obvious technical, typographical, data-entry, synchronization, or system error causes incorrect information to be displayed, SahiGadget may verify and correct the information before final order fulfillment, subject to applicable law. This is not an unrestricted right to arbitrarily change a confirmed transaction.'
      ]},
      { id: 'order-placement', title: '5. Order placement and acceptance', paragraphs: [
        'Submitting an order is a request to purchase; it does not by itself guarantee final acceptance or fulfillment. SahiGadget may contact the customer to verify the order and may accept, clarify, or decline it based on product availability, accurate information, verification results, or other reasonable operational grounds.',
        'Customers should review the product, quantity, price, delivery address, phone number, and applicable delivery charge before confirming an order.'
      ]},
      { id: 'cod-verification', title: '6. Cash on Delivery verification', bullets: [
        'For Cash on Delivery orders, SahiGadget may contact the customer to verify the name, phone number, delivery address, product, quantity, and order intent.',
        'Customers should cooperate with reasonable order verification and delivery communication.',
        'Where legally permissible, SahiGadget may refuse or cancel suspicious, fraudulent, duplicate, abusive, unverifiable, or clearly erroneous orders.',
        'No arbitrary cancellation fee is created by these terms.'
      ]},
      { id: 'cancellation', title: '7. Order cancellation', body: 'A customer should contact SahiGadget as soon as possible if an order needs correction or cancellation. Whether a cancellation is possible may depend on order status, verification, dispatch progress, product availability, and applicable law.' },
      { id: 'delivery', title: '8. Delivery', body: 'Delivery is available across Bangladesh. Current charges are ৳80 inside Dhaka and ৳130 outside Dhaka. Timing may vary due to location, courier conditions, weather, holidays, address problems, customer unavailability, operational disruption, or circumstances outside SahiGadget’s reasonable control. See the Shipping & Delivery policy for details.' },
      { id: 'inspection', title: '9. Product inspection', body: 'Customers should inspect the package and product as soon as reasonably possible after delivery and report a damaged, defective, or incorrect product within 7 days. See the Returns & Replacements policy for the verification process.' },
      { id: 'warranty', title: '10. Warranty and service', body: 'SahiGadget’s standard support framework includes a 7-day guarantee and a 1-year service warranty, subject to eligibility, verification, product condition, and applicable manufacturer terms. See the Warranty & Guarantee policy.' },
      { id: 'customer-responsibilities', title: '11. Customer responsibilities', bullets: [
        'Provide accurate name, phone number, address, area, district, and delivery information.',
        'Cooperate with reasonable order verification and delivery communication.',
        'Use products according to applicable instructions and avoid unauthorized repair or modification.',
        'Keep relevant order, product, serial, IMEI, and purchase information available when requesting support.'
      ]},
      { id: 'fraud-abuse', title: '12. Fraudulent or abusive orders', body: 'SahiGadget may review repeated failed deliveries, multiple or fake orders, abusive communications, misuse of offers, payment or identity concerns, and other conduct that creates a reasonable risk of fraud or operational abuse. Actions will be taken subject to applicable law and the circumstances of the case.' },
      { id: 'intellectual-property', title: '13. Intellectual property', body: 'The SahiGadget name, branding, written content, images, design elements, and website materials belong to SahiGadget or their respective rights holders. They may not be copied, republished, or commercially reused without permission, except where permitted by law.' },
      { id: 'availability-errors', title: '14. Website availability and corrections', body: 'SahiGadget works to keep the website available and information useful, but pages, features, and data may occasionally be unavailable, delayed, or corrected. SahiGadget may update information, fix errors, or temporarily suspend a feature where reasonably necessary.' },
      { id: 'liability', title: '15. Limitation of liability', body: 'To the extent legally permissible, SahiGadget is not responsible for losses caused by inaccurate customer information, customer unavailability, misuse of a product, events outside reasonable control, or reliance on an obvious website error. Nothing in these terms excludes or limits liability or customer rights that cannot lawfully be excluded.' },
      { id: 'updates-law', title: '16. Policy updates and governing law', paragraphs: [
        'SahiGadget may update these terms when its services, policies, or legal obligations change. The latest version published on the website will apply to future use and orders, subject to applicable law.',
        'These terms are intended to operate under applicable Bangladesh law. Any dispute should first be raised with SahiGadget so the circumstances can be reviewed and an appropriate resolution explored.'
      ]},
      { id: 'contact', title: '17. Contact information', body: 'For questions about these terms, call +880 1601-654316, email helpline.sahigadget@gmail.com, or write to Araihazar, Narayanganj, Bangladesh – 1460.' },
    ]}
    relatedLinks={[{ label: 'Privacy policy', href: '/privacy' }, { label: 'Shipping & delivery', href: '/shipping' }, { label: 'Returns & replacements', href: '/returns' }, { label: 'Contact support', href: '/contact' }]}
  />
}
