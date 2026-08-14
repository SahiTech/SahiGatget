import type { Metadata } from 'next'

import { PolicyPage } from '@/components/storefront/policy-page'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Shipping & Delivery · SahiGadget',
  description: 'Delivery coverage, charges, order processing, and receiving guidance for SahiGadget customers across Bangladesh.',
}

export default function ShippingPage() {
  return <PolicyPage
    eyebrow="Customer care"
    title="Shipping & Delivery"
    description={`SahiGadget delivers across Bangladesh. The current delivery charge is ৳${siteConfig.delivery.dhakaCharge} inside Dhaka and ৳${siteConfig.delivery.outsideDhakaCharge} outside Dhaka.`}
    sections={[
      { id: 'coverage', title: 'Delivery coverage', body: 'We provide delivery support across Bangladesh. Delivery availability and timing can vary depending on the destination, address details, operational conditions, and the delivery partner serving the area.' },
      { id: 'charges', title: 'Delivery charges', bullets: [`Inside Dhaka: ৳${siteConfig.delivery.dhakaCharge}.`, `Outside Dhaka: ৳${siteConfig.delivery.outsideDhakaCharge}.`, 'Any applicable order-specific delivery information will be communicated during order confirmation.' ] },
      { id: 'processing', title: 'Order processing', paragraphs: [
        'After an order is placed, SahiGadget may review the order details and contact the customer for reasonable Cash on Delivery verification. Processing begins after the order information is sufficiently confirmed.',
        'Processing or delivery may take longer when an order requires clarification, product verification, address correction, or coordination with the customer.'
      ]},
      { id: 'delivery-process', title: 'Delivery process', paragraphs: [
        'The delivery partner will attempt to reach the customer using the contact information provided with the order. Customers should keep their phone available and cooperate with reasonable delivery communication.',
        'Customers should inspect the received package and product as soon as reasonably possible and contact SahiGadget promptly if there is a damaged, defective, or incorrect-product concern.'
      ]},
      { id: 'customer-responsibility', title: 'Customer responsibilities', bullets: [
        'Provide an accurate name, active phone number, address, area, district, and other delivery details.',
        'Remain reachable during the delivery process and cooperate with reasonable verification.',
        'Ensure that someone authorized to receive the order is available at the delivery address.',
        'Inform SahiGadget promptly if the delivery information needs correction before dispatch.'
      ]},
      { id: 'delays', title: 'Delivery delays and delivery attempts', body: 'Delivery timing may vary because of location, courier conditions, weather, holidays, operational disruptions, address problems, customer unavailability, or circumstances outside SahiGadget’s reasonable control. An unsuccessful delivery attempt may require further coordination and can delay fulfillment.' },
      { id: 'support', title: 'Delivery support', body: 'For order or delivery assistance, call +880 1601-654316 or email helpline.sahigadget@gmail.com. Please include your order information and the phone number used for the order when contacting support.' },
    ]}
    relatedLinks={[{ label: 'Track an order', href: '/track-order' }, { label: 'Returns & replacements', href: '/returns' }, { label: 'Warranty & guarantee', href: '/warranty' }, { label: 'Contact support', href: '/contact' }]}
  />
}
