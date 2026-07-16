/**
 * Skeleton — the DS §18 loading shimmer, as a component (none existed; every
 * loading state hand-rolled its own placeholder or showed nothing).
 *
 * Text lines, card blocks, node stubs — one primitive, shaped by className.
 * The shimmer honours prefers-reduced-motion via Tailwind's motion-safe
 * gate; the base tone is the canvas-adjacent neutral so it reads as
 * "content coming", not "content broken".
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
      className={`relative block overflow-hidden rounded-md bg-border-default motion-safe:animate-pulse ${className}`}
    />
  )
}
