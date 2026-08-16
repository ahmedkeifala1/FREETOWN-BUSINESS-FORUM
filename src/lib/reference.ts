import { randomBytes } from 'node:crypto'

/**
 * Human-quotable reference numbers.
 *
 * Every customer-facing record gets one: a delegate reads it down the phone to
 * the secretariat, finance matches it against a bank statement. They are
 * prefixed by type so a reference is self-describing, and the random suffix
 * avoids exposing a sequential count of how many registrations exist.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomPart(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

function yearPart(): string {
  return String(new Date().getFullYear()).slice(-2)
}

/** e.g. `REG-26-K7M2QP` */
export function registrationReference(): string {
  return `REG-${yearPart()}-${randomPart(6)}`
}

/** e.g. `PAY-26-K7M2QP` */
export function paymentReference(): string {
  return `PAY-${yearPart()}-${randomPart(6)}`
}

/** e.g. `APP-26-K7M2QP` */
export function applicationReference(): string {
  return `APP-${yearPart()}-${randomPart(6)}`
}

/** e.g. `FBF-M-26-K7M2` — printed on membership certificates. */
export function memberNumber(): string {
  return `FBF-M-${yearPart()}-${randomPart(4)}`
}

/**
 * Invoice numbers are sequential within a year for accounting continuity, so
 * this takes the current count rather than generating randomness.
 * e.g. `INV-2026-000042`
 */
export function invoiceNumber(sequence: number): string {
  return `INV-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`
}
