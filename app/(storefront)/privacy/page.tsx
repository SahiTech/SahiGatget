import type { Metadata } from 'next'

import { PolicyPage } from '@/components/storefront/policy-page'

export const metadata: Metadata = {
  title: 'Privacy Policy · SahiGadget',
  description: 'How SahiGadget uses customer, order, delivery, and website information to operate the store and provide support.',
}

export default function PrivacyPage() {
  return <PolicyPage
    eyebrow="Customer care"
    title="Privacy Policy"
    description="This policy explains the types of information SahiGadget may receive, why it is used, how it supports order operations, and the practical choices available to customers. It is subject to applicable Bangladesh law."
    sections={[
      { id: 'introduction', title: '1. Introduction', body: 'SahiGadget respects customer privacy and uses information for legitimate store operations, including order fulfillment, delivery coordination, customer support, warranty and return handling, fraud prevention, and website functionality. This policy describes the current customer-facing approach and may be updated when services or requirements change.' },
      { id: 'information-collected', title: '2. Information we collect', bullets: [
        'Information a customer provides when placing an order, such as name, phone number, address, area, district, and delivery details.',
        'Order information, including products, quantities, order status, delivery information, and support history relevant to the order.',
        'Information provided when a customer contacts support about delivery, warranty, returns, replacement, or a product issue.',
        'Device, browser, and technical information that may be processed by hosting, security, or website infrastructure when the site is used, where technically collected.'
      ]},
      { id: 'how-used', title: '3. How information is used', bullets: [
        'To process, verify, fulfill, and deliver orders.',
        'To communicate about order status, delivery coordination, support, warranty, returns, or replacements.',
        'To confirm Cash on Delivery order intent and reduce fraudulent, duplicate, abusive, or unverifiable orders.',
        'To maintain website functionality, troubleshoot issues, improve services, and protect the store from misuse.',
        'To maintain business records and respond to applicable legal, compliance, or dispute-resolution needs.'
      ]},
      { id: 'phone-address', title: '4. Phone numbers and delivery addresses', paragraphs: [
        'A phone number is used to communicate about order verification, delivery, customer support, and related service needs. Customers should provide a number they can reasonably receive during the order process.',
        'Delivery address information is used to coordinate delivery and resolve address-related issues. Customers should provide accurate name, phone, address, area, district, and other relevant delivery information.'
      ]},
      { id: 'service-providers', title: '5. Service providers and infrastructure', body: 'SahiGadget uses third-party operational infrastructure for hosting, database, storage, authentication, and website delivery. Customer information may be processed by those providers when necessary for the store to function. Operational delivery or communication partners may also receive information needed to fulfill a specific order. SahiGadget does not claim that data is never processed by third-party infrastructure.' },
      { id: 'security', title: '6. Security', body: 'SahiGadget uses reasonable technical and organizational measures appropriate to the application and its operational needs. No online service can promise absolute security, so customers should avoid sharing unnecessary sensitive information through ordinary support channels.' },
      { id: 'retention', title: '7. Data retention', body: 'Information may be retained for as long as reasonably necessary for order fulfillment, customer service, warranty or return handling, accounting and business records, fraud prevention, legal or compliance obligations, and dispute resolution. Retention can vary by the type of record and the circumstances; this policy does not promise an immediate deletion period for every record.' },
      { id: 'cookies-storage', title: '8. Cookies and local storage', body: 'The website may use browser storage, cookies, or similar technical mechanisms where needed for sessions, preferences, security, or website functionality. The exact behavior may vary by browser and feature. Disabling browser storage can affect login, cart, or other functionality.' },
      { id: 'customer-choices', title: '9. Customer choices and requests', paragraphs: [
        'Customers may contact SahiGadget to ask about an order-related record, correct inaccurate delivery information, or raise a privacy concern. Some information must be retained or used when necessary for order fulfillment, warranty, business records, fraud prevention, legal obligations, or dispute resolution.',
        'To help protect customer information, SahiGadget may request reasonable details to verify the identity of the person making a request.'
      ]},
      { id: 'updates', title: '10. Policy updates', body: 'SahiGadget may update this policy when the website, operational services, or applicable requirements change. The updated policy will be published on this page with its current wording.' },
      { id: 'contact', title: '11. Contact information', body: 'For privacy questions or requests, call +880 1601-654316, email helpline.sahigadget@gmail.com, or write to Araihazar, Narayanganj, Bangladesh – 1460.' },
    ]}
    relatedLinks={[{ label: 'Terms & conditions', href: '/terms' }, { label: 'Contact support', href: '/contact' }, { label: 'Shipping & delivery', href: '/shipping' }, { label: 'Track an order', href: '/track-order' }]}
  />
}
