export type InvoiceDocumentItem = {
  id: string
  sku: string
  productName: string
  variantTitle: string
  imei: string | null
  imei2: string | null
  serialNumber: string | null
  unitPrice: number
  compareAtPrice: number | null
  discountAmount: number
  quantity: number
  lineTotal: number
  warrantyPolicy: string | null
}

export type InvoiceDocument = {
  id: string
  invoiceNumber: string
  orderId: string
  orderNumber: string
  verificationToken: string | null
  issuedAt: string
  orderDate: string
  orderStatus: string
  paymentMethod: string
  paymentStatus: string
  customer: {
    name: string
    phone: string
    email: string | null
  }
  delivery: {
    address: string
    division: string
    district: string
    area: string
    postalCode: string | null
  }
  financials: {
    subtotal: number
    discountTotal: number
    deliveryCharge: number
    grandTotal: number
  }
  warrantyPolicy: string | null
  returnRefundPolicy: string | null
  storeProfile: {
    businessName: string
    established: number | null
    tagline: string
    brandPromise: string
    location: string
    phone: string
    publicEmail: string
    currency: string
  }
  items: InvoiceDocumentItem[]
}

export type InvoiceAccess = 'admin' | 'guest'
