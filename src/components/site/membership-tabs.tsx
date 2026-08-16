'use client'

import { useId, useRef, useState } from 'react'

import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

export type MembershipTab = {
  id: string
  slug: string
  name: string
  strapline: string | null
  /** Pre-formatted on the server — money formatting is not the tab's job. */
  price: string
  features: string[]
}

/**
 * Membership presented as tabs, one per tier (§4.2 membership teaser).
 *
 * Four price cards side by side ask the visitor to compare twelve bullet
 * points at once; tabs ask them to read four. The full comparison table still
 * lives on /membership/tiers, which is where someone who genuinely wants to
 * compare is going anyway.
 *
 * Implements the WAI-ARIA tabs pattern: one tab in the tab order, arrows and
 * Home/End to move between them, and the panel labelled by its tab.
 */
export function MembershipTabs({ tabs }: { tabs: MembershipTab[] }) {
  const baseId = useId()
  const [active, setActive] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  if (tabs.length === 0) return null

  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = (index: number) => `${baseId}-panel-${index}`

  function select(index: number) {
    const next = (index + tabs.length) % tabs.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, number | undefined> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: tabs.length - 1,
    }

    const next = keys[event.key]
    if (next === undefined) return

    event.preventDefault()
    select(next)
  }

  const current = tabs[active]

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="Membership tiers"
        // Scrollable rather than wrapped: four tiers on a 360px phone would
        // stack into a block of buttons that no longer reads as a tab strip.
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:justify-center sm:px-0"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={tabId(index)}
            aria-selected={index === active}
            aria-controls={panelId(index)}
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-5 py-2.5 font-display text-sm font-semibold transition-colors',
              index === active
                ? 'bg-forest-700 text-white'
                : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:text-forest-700',
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={panelId(active)}
        aria-labelledby={tabId(active)}
        tabIndex={0}
        className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-200 sm:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="font-display text-4xl font-bold text-forest-700 sm:text-5xl">
              {current.price}
              <span className="ml-1.5 align-middle text-base font-medium text-ink-500">
                / year
              </span>
            </p>

            {current.strapline && (
              <p className="mt-4 max-w-md text-base leading-relaxed text-ink-700">
                {current.strapline}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/membership/apply" variant="accent" size="md">
                Become a member
              </ButtonLink>
              <ButtonLink href="/membership/tiers" variant="outline" size="md">
                Compare all tiers
              </ButtonLink>
            </div>
          </div>

          <ul className="space-y-3.5">
            {current.features.map((feature) => (
              <li key={feature} className="flex gap-3 text-ink-800">
                <Icon
                  name="check"
                  className="mt-1 size-4 shrink-0 text-forest-600"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
