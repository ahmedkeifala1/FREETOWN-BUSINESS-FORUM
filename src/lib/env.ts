/**
 * Environment validation (SDR §14, §15).
 *
 * Run once at start-up from src/instrumentation.ts. The point is *when* the
 * failure happens: a missing Orange Money key must stop the process from
 * booting, not surface as "Orange Money is not configured" after a delegate
 * has filled in the registration form and pressed Pay. Anything checked here
 * is therefore checked eagerly, even though each consumer also guards itself.
 *
 * Only names and emptiness are inspected — no secret value is logged or
 * included in an error message, which is also why this module does not import
 * `server-only`: it holds nothing worth withholding from a client bundle, and
 * instrumentation.ts loads it outside the React Server Component graph.
 */

const PAYMENT_MODES = ['sandbox', 'live'] as const
const TRANSPORT_MODES = ['log', 'http'] as const

/** Credentials each gateway needs before PAYMENTS_MODE=live can work. */
const LIVE_PAYMENT_VARS: Record<string, readonly string[]> = {
  'Orange Money': [
    'ORANGE_MONEY_BASE_URL',
    'ORANGE_MONEY_MERCHANT_ID',
    'ORANGE_MONEY_API_KEY',
    'ORANGE_MONEY_WEBHOOK_SECRET',
  ],
  Afrimoney: [
    'AFRIMONEY_BASE_URL',
    'AFRIMONEY_MERCHANT_ID',
    'AFRIMONEY_API_KEY',
    'AFRIMONEY_WEBHOOK_SECRET',
  ],
  // No publishable key: the card flow is a server-to-server checkout session
  // followed by a redirect, so nothing PSP-related runs in the browser.
  'Card payments': [
    'CARD_PSP_BASE_URL',
    'CARD_PSP_SECRET_KEY',
    'CARD_PSP_WEBHOOK_SECRET',
  ],
}

function isBlank(name: string): boolean {
  return !process.env[name]?.trim()
}

function oneOf<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): { value: T; problem?: string } {
  const raw = process.env[name]?.trim()
  if (!raw) return { value: fallback }
  if ((allowed as readonly string[]).includes(raw)) return { value: raw as T }
  return {
    value: fallback,
    problem: `${name} is "${raw}" — expected one of ${allowed
      .map((option) => `"${option}"`)
      .join(', ')}.`,
  }
}

/**
 * Every problem at once rather than the first one. Fixing a deployment's
 * configuration should take one restart, not one per missing variable.
 */
export function collectEnvironmentProblems(): string[] {
  const problems: string[] = []

  for (const name of ['DATABASE_URL', 'TICKET_SECRET', 'NEXT_PUBLIC_SITE_URL']) {
    if (isBlank(name)) problems.push(`${name} is not set.`)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl && !URL.canParse(siteUrl)) {
    problems.push(
      'NEXT_PUBLIC_SITE_URL must be an absolute URL, e.g. https://fbf.sl.',
    )
  }

  const payments = oneOf('PAYMENTS_MODE', PAYMENT_MODES, 'sandbox')
  if (payments.problem) problems.push(payments.problem)

  if (payments.value === 'live') {
    for (const [gateway, names] of Object.entries(LIVE_PAYMENT_VARS)) {
      const absent = names.filter(isBlank)
      if (absent.length > 0) {
        problems.push(
          `PAYMENTS_MODE=live requires ${absent.join(', ')} for ${gateway}.`,
        )
      }
    }
  }

  const mail = oneOf('MAIL_MODE', TRANSPORT_MODES, 'log')
  if (mail.problem) problems.push(mail.problem)
  if (mail.value === 'http') {
    const absent = ['MAIL_API_URL', 'MAIL_API_KEY'].filter(isBlank)
    if (absent.length > 0) {
      problems.push(`MAIL_MODE=http requires ${absent.join(', ')}.`)
    }
  }

  const sms = oneOf('SMS_MODE', TRANSPORT_MODES, 'log')
  if (sms.problem) problems.push(sms.problem)
  if (sms.value === 'http') {
    const absent = ['SMS_GATEWAY_URL', 'SMS_GATEWAY_KEY'].filter(isBlank)
    if (absent.length > 0) {
      problems.push(`SMS_MODE=http requires ${absent.join(', ')}.`)
    }
  }

  return problems
}

/**
 * Suspicions rather than certainties, which is why these are warnings and not
 * problems: `next start` runs with NODE_ENV=production locally too, and a
 * heuristic on the shape of a value must not be what stops a server booting.
 */
export function collectEnvironmentWarnings(): string[] {
  const warnings: string[] = []

  // A dev placeholder here is convenient locally and a live vulnerability in
  // production: TICKET_SECRET is the only thing standing between a scanner and
  // a forged e-ticket.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.TICKET_SECRET?.startsWith('dev-only')
  ) {
    warnings.push(
      'TICKET_SECRET is still the development placeholder — e-tickets can be forged. Generate one with: openssl rand -base64 48',
    )
  }

  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.PAYMENTS_MODE ?? 'sandbox') !== 'live'
  ) {
    warnings.push(
      'PAYMENTS_MODE is not "live" — payments are simulated and no money is collected.',
    )
  }

  return warnings
}

export function assertEnvironment(): void {
  for (const warning of collectEnvironmentWarnings()) {
    console.warn(`[env] ${warning}`)
  }

  const problems = collectEnvironmentProblems()
  if (problems.length === 0) return

  throw new Error(
    `Invalid environment configuration:\n${problems
      .map((problem) => `  • ${problem}`)
      .join('\n')}\nSee .env.example for the full list of variables.`,
  )
}
