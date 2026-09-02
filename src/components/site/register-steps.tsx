import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/**
 * The progress indicator across the registration steps (§4.9 "progress
 * indicator across steps").
 *
 * An ordered list, not a row of decorated divs: the steps are a sequence and a
 * screen reader should hear them as one. Completed steps carry a tick and the
 * current one carries `aria-current`, so position is announced rather than
 * only coloured — colour alone would fail WCAG 1.4.1 (NFR-09).
 *
 * Steps are not links. A delegate who jumps back to step 1 after their
 * registration row exists would create a second one, so going back is done
 * with the browser's own button, which re-runs the GET and changes nothing.
 */

export const REGISTER_STEPS = [
  'Choose tickets',
  'Your details',
  'Payment',
  'Confirmation',
] as const

export function RegisterSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Registration progress" className="border-b border-ink-200 bg-ink-50">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <ol className="flex flex-wrap gap-x-2 gap-y-3 py-4 sm:gap-x-6">
          {REGISTER_STEPS.map((label, index) => {
            const step = index + 1
            const done = step < current
            const active = step === current

            return (
              <li
                key={label}
                aria-current={active ? 'step' : undefined}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    done && 'bg-forest-600 text-white',
                    active && 'bg-ink-950 text-white',
                    !done && !active && 'bg-ink-200 text-ink-600',
                  )}
                >
                  {done ? <Icon name="check" className="size-4" /> : step}
                </span>

                <span
                  className={cn(
                    'text-sm',
                    active
                      ? 'font-semibold text-ink-950'
                      : done
                        ? 'text-ink-700'
                        : 'text-ink-500',
                  )}
                >
                  {/* The number is on the badge for sighted readers and in the
                      text for everyone else, so "Step 2 of 4" is announced
                      without repeating "2" on screen. */}
                  <span className="sr-only">
                    Step {step} of {REGISTER_STEPS.length}:{' '}
                  </span>
                  {label}
                  {done && <span className="sr-only"> — completed</span>}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
