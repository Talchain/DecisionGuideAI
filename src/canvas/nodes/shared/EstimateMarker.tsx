import { typography } from '../../../styles/typography'

/**
 * EstimateMarker — R6 (Paul, 16 Aug 2026): "placeholder wall collapses to one
 * subtle `est.` marker at rest, detail on hover/inspector."
 *
 * L-48/S17: every factor and outcome carried its own stamp — "Moderate (0.5)",
 * "50% assumed strength", a bare `*`, a sparkle in the header — so the whole
 * model read unfinished, and the SAME gap was encoded three or four times over.
 * This is the one marker they collapse into. Display only: it changes nothing
 * about the value, its provenance, or what the analysis does with it.
 *
 * Deliberately not a button and not focusable — it is a status marker, and the
 * detail behind it is reachable through the node's quick actions and the
 * inspector, which ARE keyboard-reachable. Adding a second tab stop per node
 * would cost more than it gives.
 */
export function EstimateMarker({ title }: { title?: string }) {
  return (
    <span
      className={`${typography.edgeLabel} text-text-light italic`}
      title={title ?? 'Estimated, not yet confirmed — open the details to set or confirm it'}
      data-testid="estimate-marker"
    >
      est.
    </span>
  )
}
