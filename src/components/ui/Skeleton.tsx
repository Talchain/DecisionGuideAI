/**
 * Skeleton — the DS §18 loading shimmer, as a component (none existed; every
 * loading state hand-rolled its own placeholder or showed nothing).
 *
 * Text lines, card blocks, node stubs — one primitive, shaped by className.
 * The shimmer honours prefers-reduced-motion via Tailwind's motion-safe
 * gate; the base tone is the canvas-adjacent neutral so it reads as
 * "content coming", not "content broken".
 *
 * F9 correction: the original class was `bg-border-default`, which does NOT
 * exist in the Tailwind palette (the `border` colour group only defines
 * `emphasis`), so every Skeleton rendered TRANSPARENT — verified live in a
 * real browser (computed background rgba(0,0,0,0)). The real token for
 * var(--border-default) is `panel.border`, i.e. `bg-panel-border`.
 */
export interface SkeletonProps {
  className?: string
  /** Accessible loading hint for the region (defaults to decorative). */
  label?: string
}

export function Skeleton({ className = '', label }: SkeletonProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`relative block overflow-hidden rounded-md bg-panel-border motion-safe:animate-pulse ${className}`}
    />
  )
}
