'use client'

import { useActionState } from 'react'

import { Honeypot, SubmitButton } from '@/components/ui/form'
import { subscribeToNewsletter } from '@/lib/actions/newsletter'
import { idleState } from '@/lib/actions/types'
import { cn } from '@/lib/cn'

/**
 * Newsletter signup (§4.2 item 11, §3.5 footer).
 *
 * Used in the dark footer and on light sections, so the palette is a prop
 * rather than baked in. The success message replaces the form entirely — a
 * cleared input with a note beside it reads as "did that work?" on a phone.
 */
export function NewsletterForm({
  className,
  source,
  tone = 'dark',
}: {
  className?: string
  source: string
  tone?: 'dark' | 'light'
}) {
  const [state, formAction] = useActionState(subscribeToNewsletter, idleState)

  if (state.status === 'success') {
    return (
      <p
        role="status"
        className={cn(
          'rounded-lg px-4 py-3 text-sm',
          tone === 'dark'
            ? 'bg-forest-900/60 text-white'
            : 'bg-forest-50 text-forest-900',
          className,
        )}
      >
        {state.message}
      </p>
    )
  }

  const error = state.status === 'error' ? (state.errors?.email ?? state.message) : undefined

  return (
    <form action={formAction} className={cn('relative', className)}>
      <Honeypot />
      <input type="hidden" name="source" value={source} />

      <label htmlFor={`newsletter-email-${source}`} className="sr-only">
        Email address
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`newsletter-email-${source}`}
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `newsletter-error-${source}` : undefined}
          className={cn(
            'min-h-11 w-full flex-1 rounded-lg border px-3.5 py-2.5 text-base',
            tone === 'dark'
              ? 'border-white/20 bg-white/10 text-white placeholder:text-white/40'
              : 'border-ink-300 bg-white text-ink-950 placeholder:text-ink-400',
            error && 'border-red-400',
          )}
        />

        <SubmitButton
          variant={tone === 'dark' ? 'accent' : 'primary'}
          size="md"
          pendingLabel="Signing up…"
        >
          Sign up
        </SubmitButton>
      </div>

      {error && (
        <p
          id={`newsletter-error-${source}`}
          role="alert"
          className={cn(
            'mt-2 text-sm',
            tone === 'dark' ? 'text-red-300' : 'text-red-700',
          )}
        >
          {error}
        </p>
      )}

      <p
        className={cn(
          'mt-2 text-xs',
          tone === 'dark' ? 'text-white/50' : 'text-ink-500',
        )}
      >
        We will never share your address. Unsubscribe in one click.
      </p>
    </form>
  )
}
