import Image from 'next/image'

import { cn } from '@/lib/cn'

/**
 * FBF logo.
 *
 * The official mark supplied by the secretariat, replacing the SVG wordmark
 * that stood in for it during build. It ships as a raster file because that is
 * the only form we have — the source artwork is `public/FBF Logo.jpeg`, a
 * square social-media crop. A vector original would let this go back to inline
 * SVG; until one arrives the file is the single point of change.
 *
 * `public/brand/fbf-logo.png` is that crop with the matte lifted off into real
 * alpha. The JPEG's ground is a noisy blue-grey that drifts across the frame
 * rather than a flat white, so it is estimated before it is removed — a wide
 * maximum filter finds the lightest thing in each neighbourhood, a blur smooths
 * that into a field, and dividing by it lands the ground on white; from there
 * every pixel is ink over white and the coverage un-premultiplies back out.
 * Composited onto white again it is faithful to the original.
 *
 * The wordmark is set in white, not the brand green and navy it carries in the
 * artwork. Both call sites — header and footer — sit on `ink-950`, where navy
 * type on near-black is unreadable; white is the secretariat's own answer to
 * that ground. `public/brand/fbf-logo-on-dark.png` is the alpha crop with every
 * pixel right of the emblem (x >= 146, the empty column between the two)
 * repainted white at its original coverage, so the letterforms and their
 * antialiasing survive the recolour intact. The emblem keeps its green and
 * navy: they are the mark, and they carry onto the dark ground unaltered
 * rather than being tinted to gain contrast against it.
 *
 * That pass also drops the matte lift's residue — sub-threshold black pixels
 * spread across the whole frame, invisible as grey haze on white but a lit
 * rectangle once the wordmark half is white. A pixel survives only if a solid
 * stroke sits within two pixels of it, which keeps real antialiasing and
 * discards the field.
 *
 * `fbf-logo.png` stays as the faithful full-colour crop; nothing renders it
 * today, and a light-ground placement would be what brings it back.
 *
 * Two things the supplied file cannot give us. The emblem's outer arc is
 * clipped where it meets the left edge of the square, and at 543px across
 * there is only just enough resolution for the header mark on a 3x screen.
 * Both want the same fix: the uncropped original.
 *
 * `priority` is the caller's call: the header logo is the largest thing above
 * the fold and should not be lazy-loaded, the footer copy of it should.
 *
 * `size="header"` is the taller mark the header bar wants from `xl` up, where
 * the bar itself grows to the height of the reference site's (see
 * `site/header`).
 */
export function Logo({
  className,
  priority = false,
  size = 'default',
}: {
  className?: string
  priority?: boolean
  size?: 'default' | 'header'
}) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <Image
        src="/brand/fbf-logo-on-dark.png"
        alt="Freetown Business Forum"
        width={543}
        height={204}
        priority={priority}
        // Taller than the plated mark it replaces, which stood 44px on an 80px
        // bar once its padding was counted. The padding is gone, so the mark
        // itself has to carry that height or it floats in the bar.
        className={cn('h-10 w-auto sm:h-11', size === 'header' && 'xl:h-14')}
      />
    </span>
  )
}
