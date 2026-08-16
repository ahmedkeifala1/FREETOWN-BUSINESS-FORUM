import { Avatar } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Container } from '@/components/ui/layout'
import { initials } from '@/lib/format'

export type HomeTestimonial = {
  id: string
  quote: string
  authorName: string
  authorRole: string | null
  organisation: string
  photoUrl: string | null
}

/**
 * Endorsement band, directly under the hero (§4.2).
 *
 * A scroll-snapping row rather than a scripted carousel. Native scrolling
 * already gives a phone the swipe gesture, a trackpad the horizontal flick and
 * a keyboard the arrow keys, and it works with JavaScript disabled — an
 * auto-advancing carousel would add a client bundle, steal focus and need a
 * pause control to satisfy WCAG 2.2.2. The list is a `ul` so a screen reader
 * announces how many quotes there are before reading the first.
 */
export function Testimonials({ items }: { items: HomeTestimonial[] }) {
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="border-y border-ink-200 bg-ink-50 py-12 sm:py-16"
    >
      <Container size="wide">
        <h2
          id="testimonials-heading"
          className="text-sm font-semibold uppercase tracking-widest text-ink-500"
        >
          What delegates say
        </h2>

        <ul className="-mx-4 mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mt-8 sm:gap-6 lg:mx-0 lg:px-0">
          {items.map((item) => (
            <li
              key={item.id}
              className="w-[85vw] shrink-0 snap-start sm:w-[26rem] lg:w-[32rem]"
            >
              <figure className="flex h-full flex-col rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
                <Icon
                  name="quote"
                  className="size-8 shrink-0 text-gold-400"
                />

                <blockquote className="mt-4 flex-1 font-display text-lg leading-snug text-ink-950 sm:text-xl">
                  {item.quote}
                </blockquote>

                <figcaption className="mt-6 flex items-center gap-3 border-t border-ink-100 pt-5">
                  <Avatar
                    src={item.photoUrl}
                    name={item.authorName}
                    initials={initials(item.authorName)}
                    size="sm"
                  />
                  <div className="text-sm">
                    <p className="font-semibold text-ink-950">
                      {item.authorName}
                    </p>
                    <p className="text-ink-600">
                      {item.authorRole ? `${item.authorRole}, ` : ''}
                      {item.organisation}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
