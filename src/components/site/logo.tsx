import { cn } from '@/lib/cn'

/**
 * FBF wordmark.
 *
 * Drawn in SVG rather than loaded as an image file: it is a few hundred bytes
 * inline, needs no request, and stays sharp at any size. The secretariat will
 * supply an official mark during brand sign-off — this is a placeholder built
 * to the palette in §3.2, and swapping it means changing this one file.
 */
export function Logo({
  className,
  inverted = false,
}: {
  className?: string
  inverted?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        focusable="false"
        className="size-9 shrink-0"
      >
        <rect
          width="40"
          height="40"
          rx="9"
          fill={inverted ? '#ffffff' : '#0F7A3D'}
        />
        {/* Three ascending bars — growth, and the three days of the forum. */}
        <rect
          x="9"
          y="22"
          width="6"
          height="9"
          rx="1.5"
          fill={inverted ? '#0F7A3D' : '#ffffff'}
        />
        <rect
          x="17"
          y="16"
          width="6"
          height="15"
          rx="1.5"
          fill={inverted ? '#1D4F91' : '#C8871B'}
        />
        <rect
          x="25"
          y="9"
          width="6"
          height="22"
          rx="1.5"
          fill={inverted ? '#C8871B' : '#ADE4C4'}
        />
      </svg>

      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight',
            inverted ? 'text-white' : 'text-forest-700',
          )}
        >
          FBF
        </span>
        <span
          className={cn(
            'mt-0.5 hidden text-[0.6875rem] font-medium sm:block',
            inverted ? 'text-white/70' : 'text-ink-600',
          )}
        >
          Freetown Business Forum
        </span>
      </span>
    </span>
  )
}
