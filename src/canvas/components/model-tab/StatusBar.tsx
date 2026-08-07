/**
 * StatusBar — compact horizontal row of clickable status segments.
 *
 * Pre-analysis: "N to verify" + "N fragile" (0 pre-analysis).
 * Post-analysis adds: "N contested", "N fragile", "Npp via EVPI", "N% stability".
 *
 * Each segment scrolls to the relevant section on click.
 */

import { typography } from '../../../styles/typography'

interface StatusBarProps {
  factorsToVerify: number
  fragileEdgeCount: number
  contestedCount: number
  recommendationStability: number | null | undefined
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
  recommendationStability,
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

    // Stability
    if (recommendationStability != null) {
      segments.push({
        key: 'stability',
        dotColour: 'bg-success',
        label: `${Math.round(recommendationStability * 100)}% stability`,
        scrollTarget: 'model-health-section',
      })
    }
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
