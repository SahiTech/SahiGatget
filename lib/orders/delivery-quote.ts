import type { DeliveryZonesQuote, Quote } from '@/lib/orders/schema'

export function buildDeliveryZonesQuote(
  quote: Quote,
  charges: { dhakaCharge: number; outsideDhakaCharge: number },
): DeliveryZonesQuote {
  return {
    productName: quote.productName,
    variantTitle: quote.variantTitle,
    color: quote.color,
    imageUrl: quote.imageUrl,
    sku: quote.sku,
    quantity: quote.quantity,
    unitPrice: quote.unitPrice,
    compareAtPrice: quote.compareAtPrice,
    discountTotal: quote.discountTotal,
    subtotal: quote.subtotal,
    dhakaCharge: charges.dhakaCharge,
    outsideDhakaCharge: charges.outsideDhakaCharge,
    warrantyPolicy: quote.warrantyPolicy,
    available: quote.available,
  }
}
