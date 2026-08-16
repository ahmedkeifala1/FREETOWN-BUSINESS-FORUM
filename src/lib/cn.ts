/**
 * Conditional class names.
 *
 * Deliberately not `clsx` + `tailwind-merge`: those two packages together add
 * roughly 8KB to every page for a convenience this codebase does not need —
 * the variant maps in src/components/ui own their classes and never pass
 * conflicting utilities down. On a 3G budget (NFR-01) that is not a trade
 * worth making.
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}
