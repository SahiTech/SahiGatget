export const siteConfig = {
  name: "SahiGadget",
  tagline: "সঠিক দাম, সঠিক গ্যাজেট",
  brandPromise: "আসল পণ্য • দ্রুত ডেলিভারি • সারা দেশে সেবা",
  url: "https://sahigadget.shop",
  established: 2019,
  location: {
    address: "Araihazar, Narayanganj, Bangladesh – 1460",
    city: "Narayanganj",
    country: "Bangladesh",
  },
  contact: {
    phone: "+880 1601-654316",
    publicEmail: "www.sahigadget.com@gmail.com",
    adminEmail: "helpline.sahitech@gmail.com",
    facebook: "https://www.facebook.com/sahigadgetbd",
  },
  delivery: {
    dhakaCharge: 80,
    outsideDhakaCharge: 130,
  },
  warranty: {
    guaranteeDays: 7,
    serviceWarrantyYears: 1,
    defaultPolicy: "7 Days Guarantee & 1 Year Service Warranty. Manufacturer warranty terms apply where applicable.",
  },
  currency: {
    code: "BDT",
    symbol: "৳",
  },
}

export type SiteConfig = typeof siteConfig
