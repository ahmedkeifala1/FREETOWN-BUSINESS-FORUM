import { Icon } from '@/components/ui/icon'

export type FaqItem = { q: string; a: string }

/**
 * An FAQ accordion built on `<details>`/`<summary>`.
 *
 * The browser already implements this control: it opens on click and on Enter
 * or Space, it is in the tab order, it announces its expanded state, and — the
 * part a scripted accordion always loses — its contents are findable by the
 * browser's own in-page search, which is how a lot of people use an FAQ. No
 * client JavaScript ships for it.
 *
 * Each item stays independently open. Grouping them by `name` would close one
 * when another opens, which is exactly the wrong behaviour when someone is
 * comparing two answers.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="mt-10 divide-y divide-ink-200 border-y border-ink-200">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-base font-semibold text-ink-950 hover:text-forest-700 sm:text-lg [&::-webkit-details-marker]:hidden">
            {item.q}
            <Icon
              name="chevronDown"
              className="size-5 shrink-0 text-ink-500 transition-transform group-open:rotate-180"
            />
          </summary>

          <p className="max-w-3xl pb-6 leading-relaxed text-ink-700">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  )
}
