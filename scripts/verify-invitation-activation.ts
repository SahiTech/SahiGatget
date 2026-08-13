import assert from 'node:assert/strict'

import {
  INVITATION_OTP_LENGTH,
  isValidInvitationEmail,
  isValidInvitationOtp,
  normalizeInvitationEmail,
  normalizeInvitationOtp,
} from '../lib/auth/invitation-activation.ts'

assert.equal(INVITATION_OTP_LENGTH, 6)
assert.equal(normalizeInvitationEmail('  OWNER@EXAMPLE.COM '), 'owner@example.com')
assert.equal(normalizeInvitationOtp(' 123 456 '), '123456')
assert.equal(isValidInvitationEmail('owner@example.com'), true)
assert.equal(isValidInvitationEmail('owner@example'), false)
assert.equal(isValidInvitationOtp('123456'), true)
assert.equal(isValidInvitationOtp('12345'), false)
assert.equal(isValidInvitationOtp('1234567'), false)
assert.equal(isValidInvitationOtp('12a456'), false)

console.log('Invitation activation validation checks passed.')
