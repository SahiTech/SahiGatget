const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sahi-gatget.vercel.app";
const IS_PROD = SITE_URL.includes("sahigadget.shop");

export const siteConfig = {
  name: "SahiGadget",
  tagline: "সঠিক দাম, সঠিক গ্যাজেট",
  brandPromise: "আসল পণ্য • দ্রুত ডেলিভারি • সারা দেশে সেবা",
  url: SITE_URL,
  established: 2019,
  location: {
    address: "Araihazar, Narayanganj, Bangladesh – 1460",
    city: "Narayanganj",
    country: "Bangladesh",
  },
  contact: {
    phone: "+880 1601-654316",
    publicEmail: IS_PROD ? "helpline.sahigadget@gmail.com" : "www.sahigadget.com@gmail.com",
    adminEmail: IS_PROD ? "hello@sahigadget.shop" : "helpline.sahitech@gmail.com",
    supportEmail: "helpline.sahigadget@gmail.com",
    businessEmail: "hello@sahigadget.shop",
    facebook: "https://www.facebook.com/sahigadgetbd",
  },
  email: {
    sender: "orders@mail.sahigadget.shop",
    replyTo: "helpline.sahigadget@gmail.com",
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
