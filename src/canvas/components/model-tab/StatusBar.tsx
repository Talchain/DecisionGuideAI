/**
 * StatusBar — compact horizontal row of clickable status segments.
 *
 * Pre-analysis: "N to verify" + "N fragile" (0 pre-analysis).
 * Post-analysis adds: "N contested".
 *
 * Each segment scrolls to the relevant section on click.
 *
 * ⛔ TWO SEGMENTS HAVE BEEN REMOVED FROM THIS BAR, BOTH FOR THE SAME REASON:
 * each rendered a number the producer cannot vouch for. See the in-body notes
 * at their former positions. Absence pinned in
 * `__tests__/evpiSurfacesRemoved.canvas.honesty.spec.tsx` (EVPI) and
 * `__tests__/withheldStabilitySurfaces.honesty.spec.tsx` (stability).
 */

import { typography } from '../../../styles/typography'

interface StatusBarProps {
  factorsToVerify: number
  fragileEdgeCount: number
  contestedCount: number
  hasAnalysisData: boolean
}

interface Segment {
  key: string
  dotColour: string
  label: string
  scrollTarget: string
}

function scrollToSection(testId: string) {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function StatusBar({
  factorsToVerify,
  fragileEdgeCount,
  contestedCount,
  hasAnalysisData,
}: StatusBarProps) {
  const segments: Segment[] = []

  // Pre-analysis: factors to verify
  if (factorsToVerify > 0) {
    segments.push({
      key: 'verify',
      dotColour: 'bg-warning',
      label: `${factorsToVerify} to verify`,
      scrollTarget: 'model-factors-section',
    })
  }

  // Fragile edges (available post-analysis, but show if > 0 regardless)
  if (fragileEdgeCount > 0) {
    segments.push({
      key: 'fragile',
      dotColour: 'bg-danger',
      label: `${fragileEdgeCount} fragile`,
      scrollTarget: 'model-relationships-section',
    })
  }

  // Post-analysis only segments
  if (hasAnalysisData) {
    // Contested edges (hide when 0)
    if (contestedCount > 0) {
      segments.push({
        key: 'contested',
        dotColour: 'bg-info',
        label: `${contestedCount} contested`,
        scrollTarget: 'model-relationships-section',
      })
    }

    // ⛔ REMOVED: the `"{X}pp via EVPI"` segment, which SUMMED the top three
    // `evpi_percentage_points` values into a single headline figure. Each
    // addend is refuted — ISL measured 0.0pp for the factors PLoT scored at
    // 12.3 / 10.2 / 6.6 in the same payload — so the sum inherited every
    // defect and compounded them. Do not reinstate.

    // ⛔ REMOVED (ROADMAP 2.1273): the `"{N}% stability"` segment, derived from
    // `robustness.recommendation_stability`.
    //
    // PLoT WITHHOLDS that field deliberately (`src/routes/v2/run.ts` at PLoT
    // `8bf54150`) because ISL derives it as `option_wins[winner] / n_samples` —
    // the leading option's `win_probability` RELABELLED, carrying zero
    // independent information. Printing it as "stability" showed one quantity
    // twice: honestly as "came out ahead in N% of simulated scenarios", and
    // again under a name implying an independent robustness measurement.
    //
    // On a fresh run the field is absent, so this segment was already dark
    // (wire-witnessed 2026-08-17: `enrichment.robustness` carries 11 keys and
    // `recommendation_stability` is not one of them). The reason it is DELETED
    // rather than left to its null-guard is a legacy HYDRATED payload: a
    // `scenarios.analysis` row written before the withdrawal still carries the
    // value, `adapters/plot/v2/responseMapper.ts` passes it through verbatim,
    // and this segment would then render the withdrawn statistic to a
    // signed-in user. A null-check cannot defend against a value that is
    // present; only not reading it can.
    //
    // Same treatment, same reasoning, as `utils/postAnalysisFooter.ts`'s F7
    // removal of its own "{N}% stability" segment. REINSTATEMENT TRIGGER: PLoT
    // supplies a genuine numeric robustness/stability field that is distinct
    // from the leader's win probability. Until then, do not reinstate.
  }

  if (segments.length === 0) return null

  return (
    <div
      className="flex flex-wrap gap-x-6 gap-y-1.5 bg-panel-hover rounded-lg px-3 py-2 mb-3"
      data-testid="model-status-bar"
    >
      {segments.map(seg => (
        <button
          key={seg.key}
          type="button"
          onClick={() => scrollToSection(seg.scrollTarget)}
          className={`inline-flex items-center gap-1.5 ${typography.panelMeta} text-text-body hover:text-info transition-colors`}
          data-testid={`status-${seg.key}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${seg.dotColour} shrink-0`} aria-hidden="true" />
          {seg.label}
        </button>
      ))}
    </div>
  )
}
