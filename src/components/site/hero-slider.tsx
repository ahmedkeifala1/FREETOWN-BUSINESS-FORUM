'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Icon } from '@/components/ui/icon'
import { Container } from '@/components/ui/layout'
import { cn } from '@/lib/cn'

/**
 * The homepage hero: one story at a time, over a photograph, on a slow rotate.
 *
 * This is the composition of the reference page the secretariat gave us
 * (germanyafrica.com), which opens on its own news rather than on a statement:
 * a full-bleed photograph, a headline laid over it, and a control to move
 * through the rest. The palette, typography and photographs are FBF's own —
 * this is that page's rhythm, not its brand, exactly as the previous hero
 * followed londonbusinessforum.com.
 *
 * **It works with no JavaScript.** Every slide is rendered, stacked in one
 * grid cell; the active one is opaque and the rest are transparent and
 * `inert`. Without JS the first slide simply stays up and its headline is a
 * real link — a hero that needs a script to show anything is a hero that shows
 * nothing on the connection this site is built for (NFR-01).
 *
 * Three things the rotation has to get right, none of them optional:
 *
 *   * **It stops when someone is reading.** Pointer over the block, or
 *     keyboard focus inside it, pauses the timer; leaving resumes it. A
 *     carousel that advances out from under a half-read headline is the single
 *     most complained-about pattern on the web.
 *   * **It never moves for a reader who asked it not to.** The
 *     `prefers-reduced-motion` query is honoured by not starting the timer at
 *     all, rather than by shortening it.
 *   * **It announces changes politely.** The live region is `polite` and the
 *     slides carry their position, so a screen reader is told what changed
 *     without being interrupted mid-sentence.
 *
 * The images are the forum's own photographs from the `forum-gallery`
 * collection, paired with the articles in order. A slide with no photograph
 * left to pair with falls back to the brand ground rather than to a grey box,
 * so a site with more stories than pictures still reads as finished.
 */

export type HeroSlide = {
  id: string
  /** Where the headline links. */
  href: string
  /** Small line above the headline — the category, or the date. */
  eyebrow: string | null
  title: string
  excerpt: string | null
  /** The photograph behind it. Null falls back to the brand ground. */
  imageUrl: string | null
}

/** How long a slide holds before the next one comes up. */
const INTERVAL_MS = 7000

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const regionId = useId()
  const count = slides.length

  const go = useCallback(
    (next: number) => setActive(((next % count) + count) % count),
    [count],
  )

  // The timer is an effect rather than a ref juggled by the handlers, so
  // pausing and resuming is just a dependency change and there is no path
  // where two intervals end up running at once.
  useEffect(() => {
    if (count < 2 || paused) return

    // Asked once, on the client, rather than through a CSS class: the decision
    // here is whether to run a timer at all, which no stylesheet can express.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (still.matches) return

    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % count),
      INTERVAL_MS,
    )

    return () => window.clearInterval(timer)
  }, [count, paused])

  if (count === 0) return null

  return (
    <section
      className="relative isolate overflow-hidden bg-ink-950 text-white"
      aria-roledescription="carousel"
      aria-label="Latest from the forum"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div id={regionId} aria-live="polite" className="grid">
        {slides.map((slide, index) => (
          <Slide
            key={slide.id}
            slide={slide}
            index={index}
            count={count}
            active={index === active}
          />
        ))}
      </div>

      {count > 1 && (
        <Controls
          count={count}
          active={active}
          onGo={go}
          controls={regionId}
        />
      )}
    </section>
  )
}

/**
 * One slide.
 *
 * All of them occupy the same grid cell, so the block is as tall as its
 * tallest headline and nothing jumps as the rotation runs. The inactive ones
 * are hidden from assistive technology and taken out of the tab order with
 * `inert` — opacity alone would leave a screen reader reading six headlines in
 * a row and a keyboard tabbing into a link nobody can see.
 */
function Slide({
  slide,
  index,
  count,
  active,
}: {
  slide: HeroSlide
  index: number
  count: number
  active: boolean
}) {
  return (
    <div
      className={cn(
        'col-start-1 row-start-1 transition-opacity duration-700 motion-reduce:transition-none',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      // `inert` is a boolean attribute; React renders it only when true.
      inert={!active}
    >
      {slide.imageUrl && (
        <>
          {/*
            The photograph is decorative here — the headline over it is the
            content, and describing the picture as well would have a screen
            reader read two things for one slide. Plain `<img>` rather than
            next/image for the reason given in ui/card: an address may be on
            any host, including the blob store, and the optimiser refuses a
            domain not configured ahead of time.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.imageUrl}
            alt=""
            // The first slide is the largest thing above the fold, so it is
            // fetched eagerly and at high priority; the rest can wait until
            // the rotation reaches them.
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          {/*
            A scrim, not a flat tint. The headline sits low-left, so the
            gradient is heaviest there and clears towards the top right, which
            keeps the photograph readable as a photograph while still buying
            the text its contrast (NFR-09).
          */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-tr from-ink-950 via-ink-950/85 to-ink-950/40"
          />
        </>
      )}

      <Container size="wide">
        <div className="flex min-h-112 flex-col justify-end py-16 sm:min-h-128 sm:py-20 lg:min-h-144 lg:max-w-3xl lg:py-28">
          {slide.eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">
              {slide.eyebrow}
            </p>
          )}

          <h2 className="mt-5 font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-4xl lg:text-5xl">
            <Link
              href={slide.href}
              className="transition-colors hover:text-gold-300 focus-visible:text-gold-300"
            >
              {/*
                The whole headline is the hit area, and the stretched link
                below makes the rest of the slide clickable too — a headline
                over a photograph reads as one target, so it should behave as
                one.
              */}
              <span className="absolute inset-0" aria-hidden="true" />
              {slide.title}
            </Link>
          </h2>

          {slide.excerpt && (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              {slide.excerpt}
            </p>
          )}

          <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-400">
            Read more
            <Icon name="arrowRight" className="size-4" />
          </span>
        </div>
      </Container>
    </div>
  )
}

/**
 * Arrows and a counter, bottom right.
 *
 * Buttons rather than links: they change what this block shows and take the
 * reader nowhere, and a control that looks like navigation but is not is how
 * people end up losing their place. The dots are `aria-hidden` because the
 * arrows and the live region already say everything a non-visual reader needs
 * — six identical "go to slide" buttons add noise, not access.
 */
function Controls({
  count,
  active,
  onGo,
  controls,
}: {
  count: number
  active: number
  onGo: (next: number) => void
  controls: string
}) {
  // Keeps focus on the arrow after a click, so pressing it repeatedly walks
  // the carousel instead of moving focus into the slide that just arrived.
  const bar = useRef<HTMLDivElement>(null)

  return (
    <Container size="wide">
      <div
        ref={bar}
        className="relative z-10 flex items-center justify-between gap-6 pb-8 sm:pb-10"
      >
        <div aria-hidden="true" className="flex gap-2">
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-0.5 w-8 transition-colors',
                index === active ? 'bg-gold-400' : 'bg-white/25',
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm tabular-nums text-white/60">
            <span className="text-white">
              {String(active + 1).padStart(2, '0')}
            </span>
            {' / '}
            {String(count).padStart(2, '0')}
          </p>

          <button
            type="button"
            onClick={() => onGo(active - 1)}
            aria-controls={controls}
            aria-label="Previous story"
            className="inline-flex size-11 items-center justify-center border border-white/30 text-white transition hover:border-gold-400 hover:text-gold-400"
          >
            <Icon name="arrowRight" className="size-5 rotate-180" />
          </button>

          <button
            type="button"
            onClick={() => onGo(active + 1)}
            aria-controls={controls}
            aria-label="Next story"
            className="inline-flex size-11 items-center justify-center border border-white/30 text-white transition hover:border-gold-400 hover:text-gold-400"
          >
            <Icon name="arrowRight" className="size-5" />
          </button>
        </div>
      </div>
    </Container>
  )
}
