/**
 * Next.js runs `register` once per server process, before the first request is
 * handled. Environment validation belongs here so a misconfigured deployment
 * fails loudly at boot rather than halfway through someone's registration.
 *
 * Guarded on the runtime: the Edge bundle has no access to the host's full
 * environment, so validating there would report false failures.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { assertEnvironment } = await import('@/lib/env')
  assertEnvironment()
}
