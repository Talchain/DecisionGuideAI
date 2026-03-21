/**
 * RangeDerivationPill — shows range_derivation_source from PLoT in expert mode.
 *
 * Gated on field presence: renders nothing when source is absent.
 * Uses DS v5 outlined pill style with tier-based colouring:
 * - explicit → success
 * - extracted / inferred_spread → info
 * - inferred_baseline / inferred_value → warning
 * - default → danger
 */

const TIER_COLOURS: Record<string, string> = {
  explicit: 'border-success/30 text-success',
  extracted: 'border-info/30 text-info',
  inferred_spread: 'border-info/30 text-info',
  inferred_baseline: 'border-warning/30 text-warning',
  inferred_value: 'border-warning/30 text-warning',
  default: 'border-danger/30 text-danger',
}

const FALLBACK_COLOUR = 'border-text-light/30 text-text-light'

export function RangeDerivationPill({ source }: { source: string | undefined | null }) {
  if (!source) return null

  const colour = TIER_COLOURS[source] ?? FALLBACK_COLOUR
  const label = source.replace(/_/g, ' ')

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-light text-xs">Range:</span>
      <span
        className={`inline-flex items-center rounded-full border bg-transparent px-2 py-0.5 text-xs font-medium ${colour}`}
      >
        {label}
      </span>
    </div>
  )
}
