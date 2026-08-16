import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import QRCode from 'qrcode'

/**
 * QR e-tickets (FR-05).
 *
 * The QR encodes `FBF1.<ticketCode>.<signature>`, where the signature is an
 * HMAC over the ticket code using TICKET_SECRET. Check-in therefore verifies
 * the signature *before* hitting the database, so a forged or mistyped code is
 * rejected without a lookup, and a screenshot of someone else's ticket cannot
 * be edited into a valid one.
 *
 * The QR carries no personal data — only the opaque code — so a photographed
 * ticket leaks nothing about the delegate.
 */

const TICKET_PREFIX = 'FBF1'
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I/L/O/0/1

function ticketSecret(): string {
  const secret = process.env.TICKET_SECRET
  if (!secret) {
    throw new Error(
      'TICKET_SECRET is not set — e-tickets cannot be signed or verified.',
    )
  }
  return secret
}

/**
 * Human-readable ticket code, e.g. `FBF-7K2M-9QXA`. Ambiguous characters are
 * excluded so a delegate reading it aloud at a busy registration desk is not
 * misheard.
 */
export function generateTicketCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return `FBF-${out.slice(0, 4)}-${out.slice(4)}`
}

function sign(ticketCode: string): string {
  return createHmac('sha256', ticketSecret())
    .update(ticketCode)
    .digest('base64url')
    .slice(0, 22)
}

export function buildQrPayload(ticketCode: string): string {
  return `${TICKET_PREFIX}.${ticketCode}.${sign(ticketCode)}`
}

/** Verify a scanned payload. Returns the ticket code, or null if invalid. */
export function verifyQrPayload(payload: string): string | null {
  const parts = payload.trim().split('.')
  if (parts.length !== 3) return null

  const [prefix, ticketCode, signature] = parts
  if (prefix !== TICKET_PREFIX) return null

  const expected = sign(ticketCode)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  return ticketCode
}

/**
 * Render the QR as an SVG data URI.
 *
 * SVG rather than PNG: it is a fraction of the bytes on a 3G connection
 * (NFR-01), and stays crisp when a delegate zooms in to help a scanner.
 */
export async function renderQrDataUri(payload: string): Promise<string> {
  const svg = await QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  })
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Raw SVG markup, for embedding directly in a page or an email. */
export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  })
}
