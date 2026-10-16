const BANGLADESH_MOBILE = /^01[3-9]\d{8}$/

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
}

function toLatinDigits(phone: string) {
  return phone.replace(/[০-৯]/g, (digit) => BENGALI_DIGITS[digit] ?? digit)
}

function digitsOnly(phone: string) {
  return toLatinDigits(phone).replace(/\D/g, '')
}

/** Normalize Bangladesh mobile formats to the canonical local 11-digit form. */
export function normalizePhone(phone: string) {
  const digits = digitsOnly(phone)
  if (digits.startsWith('008801')) return `0${digits.slice(5)}`
  if (digits.startsWith('8801')) return `0${digits.slice(3)}`
  if (digits.startsWith('01')) return digits
  return toLatinDigits(phone).trim()
}

export function isValidBangladeshMobile(phone: string) {
  return BANGLADESH_MOBILE.test(normalizePhone(phone))
}
