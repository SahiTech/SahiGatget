import type { Metadata } from 'next'

import { PolicyPage } from '@/components/storefront/policy-page'

export const metadata: Metadata = {
  title: 'Returns & Replacements · SahiGadget',
  description: 'How to report damaged, defective, or incorrect products to SahiGadget for verification and replacement support.',
}

export default function ReturnsPage() {
  return <PolicyPage
    eyebrow="Customer care"
    title="Returns & Replacements"
    description="If a product arrives damaged, defective, or incorrect, report the issue within 7 days so SahiGadget can review the order and provide appropriate replacement support where applicable."
    sections={[
      { id: 'reporting-period', title: 'Report the issue within 7 days', body: 'Damaged, defective, or incorrect products should be reported to SahiGadget within 7 days of receiving the order. Early reporting helps us verify the product, delivery, and order information while the issue is still identifiable.' },
      { id: 'how-to-report', title: 'How to report a concern', bullets: [
        'Contact support with your name, phone number, order information, and a clear description of the issue.',
        'Provide clear photos or videos when requested, including the product, packaging, label, and visible issue.',
        'Keep the product, accessories, packaging, and purchase information available until the review is complete.',
        'Do not send a product back unless SahiGadget provides or confirms the next step.'
      ]},
      { id: 'verification', title: 'Verification before approval', paragraphs: [
        'SahiGadget may verify the order identity, product variant, serial number or IMEI where applicable, delivery condition, and the reported issue. The product may be inspected before replacement support is approved.',
        'Submitting a complaint starts a review; it does not automatically guarantee a replacement, refund, or free return shipping.'
      ]},
      { id: 'eligible-issues', title: 'Issues that may qualify', body: 'A verified damaged, defective, or incorrect product may qualify for replacement support where the issue is reported within the stated period and the product is eligible. The available resolution depends on the circumstances of the claim and product availability.' },
      { id: 'excluded-issues', title: 'Issues that may be excluded', body: 'Where applicable to the product, support may exclude damage caused by misuse, accident, liquid exposure, unauthorized repair or modification, improper installation, alteration, normal wear, or failure to follow product instructions. Manufacturer-specific terms may also apply. SahiGadget will assess claims fairly and subject to applicable law.' },
      { id: 'replacement', title: 'Replacement outcome', paragraphs: [
        'Replacement depends on successful verification and availability of the same or an appropriate eligible product. If the requested product is unavailable, SahiGadget will explain the available next step based on the circumstances and applicable policy.',
        'No automatic refund timeline or unconditional replacement promise is made by this policy. Any resolution will be communicated after reasonable review.'
      ]},
      { id: 'contact', title: 'Contact support', body: 'Call +880 1601-654316 or email helpline.sahigadget@gmail.com with your order details. Please report the concern as soon as possible within the 7-day period.' },
    ]}
    relatedLinks={[{ label: 'Warranty & guarantee', href: '/warranty' }, { label: 'Shipping & delivery', href: '/shipping' }, { label: 'Terms & conditions', href: '/terms' }, { label: 'Contact support', href: '/contact' }]}
  />
}
