import type { Metadata } from 'next'

import { PolicyPage } from '@/components/storefront/policy-page'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Warranty & Guarantee · SahiGadget',
  description: 'Understand SahiGadget’s 7-day guarantee, 1-year service warranty, and applicable manufacturer terms.',
}

export default function WarrantyPage() {
  return <PolicyPage
    eyebrow="Customer care"
    title="Warranty & Guarantee"
    description={`SahiGadget provides a standard ${siteConfig.warranty.guaranteeDays}-day guarantee and a ${siteConfig.warranty.serviceWarrantyYears}-year service warranty, subject to verification, product condition, and applicable product or manufacturer terms.`}
    sections={[
      { id: 'overview', title: 'Our warranty framework', paragraphs: [
        `Our standard customer-care framework includes a ${siteConfig.warranty.guaranteeDays}-day guarantee and a ${siteConfig.warranty.serviceWarrantyYears}-year service warranty. These are different forms of support and do not mean that every issue is covered for the same period.`,
        'Manufacturer warranty or service terms may apply where relevant to a particular product. Where manufacturer-specific terms apply, those terms may determine the available service, process, exclusions, and coverage.'
      ]},
      { id: 'seven-day-guarantee', title: '7-day guarantee', paragraphs: [
        'The 7-day guarantee is intended for eligible product issues reported promptly after delivery. A customer should contact SahiGadget within 7 days of receiving the product so the order and issue can be reviewed.',
        'A complaint is not an automatic approval. SahiGadget may request photographs, videos, packaging details, order information, and other reasonable evidence before deciding the appropriate support.'
      ]},
      { id: 'service-warranty', title: '1-year service warranty', paragraphs: [
        'The 1-year service warranty is a service-support period for eligible issues, subject to product eligibility, verification, product condition, and applicable service or manufacturer terms.',
        'Service support may involve inspection, troubleshooting, repair coordination, or another appropriate resolution based on the circumstances of the issue. It is not an unconditional promise of replacement or refund.'
      ]},
      { id: 'manufacturer-terms', title: 'Manufacturer warranty and terms', body: 'Some products may be covered by manufacturer-specific warranty or service arrangements. Manufacturer terms may differ by product and may take priority where applicable. Customers should retain product documentation and follow any required manufacturer process when requested.' },
      { id: 'eligibility', title: 'Verification and eligibility', bullets: [
        'Proof of purchase or order verification may be required.',
        'The product, serial number, IMEI, variant, or other identifying information may be checked where applicable.',
        'The product may be inspected before service, replacement, or other support is approved.',
        'Support depends on the product being eligible and the issue being reasonably verified.'
      ]},
      { id: 'exclusions', title: 'Situations that may not be covered', body: 'Where applicable to the product or service, coverage may exclude physical damage, liquid damage, misuse, accident, unauthorized repair or modification, improper installation, alteration, normal wear, or damage caused by failure to follow product instructions. Manufacturer-specific exclusions may also apply. SahiGadget will assess the circumstances fairly and subject to applicable law.' },
      { id: 'how-to-request', title: 'How to request support', paragraphs: [
        'Contact customer support with your name, phone number, order information, product details, and a clear description of the issue. Please keep the product, accessories, packaging, and purchase information available until the review is complete.',
        'For support, call +880 1601-654316 or email helpline.sahigadget@gmail.com.'
      ]},
    ]}
    relatedLinks={[{ label: 'Returns & replacements', href: '/returns' }, { label: 'Shipping & delivery', href: '/shipping' }, { label: 'Contact support', href: '/contact' }, { label: 'Track an order', href: '/track-order' }]}
  />
}
