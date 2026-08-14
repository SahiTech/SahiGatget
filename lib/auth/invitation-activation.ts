export const INVITATION_OTP_LENGTH = 6

export function normalizeInvitationEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeInvitationOtp(value: string) {
  return value.replace(/\s+/g, '')
}

export function isValidInvitationEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isValidInvitationOtp(value: string) {
  return new RegExp(`^\\d{${INVITATION_OTP_LENGTH}}$`).test(value)
}

export function invitationActivationError(message?: string) {
  const normalized = message?.toLowerCase() ?? ''

  if (normalized.includes('token') || normalized.includes('otp') || normalized.includes('expired')) {
    return 'This activation code is invalid, expired, or has already been used. Request a new invitation from the account owner.'
  }

  if (normalized.includes('email')) {
    return 'Enter the email address that received the invitation and the six-digit activation code from that email.'
  }

  return 'We could not complete this activation. Check the email address and code, then try again.'
}
