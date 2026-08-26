export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8801')) return `+${digits}`
  if (digits.startsWith('01')) return `+88${digits}`
  return phone.trim()
}
