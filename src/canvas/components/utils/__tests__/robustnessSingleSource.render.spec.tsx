/**
 * Robustness single-source rule — rendered-state + footer↔glyph consistency.
 *
 * Guards the live trust fix (ROBUSTNESS-VERDICT-CONTRACT): the post-analysis
 * AnalysisFooter must derive its verdict ONLY from the display-safe
 * `robustnessVerdict`, never from raw `recommendation_stability` /
 * `ranking_stability`. The verdict is the producer's own
 * `robustness.display_verdict` (PLoT #202, consumed lane 35 fix 3:
 * 'robust' | 'moderate' | 'fragile' | 'not_assessed'); when the field is
 * absent (older PLoT builds) the footer renders the neutral "Robustness
 * unknown" state, in lock-step with the certified glyph
 * (TriageActionCardsBody `checks-robust`) — so the Analysis tab can never
 * show a green "Stable ranking" beside a neutral "Robustness unknown".
 *
 * These render the ACTUAL presentational AnalysisFooter (the live footer
 * component, env-free) the way OutputsDock wires it (metaPlacement="stacked",
 * POST_FOOTER_ICONS mapping), so the assertions reflect rendered DOM, not just
 * the pure mapping.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { CheckCircle, AlertTriangle, HelpCircle, type LucideIcon } from 'lucide-react'
import { AnalysisFooter } from '../../../shared/AnalysisFooter'
import { derivePostFooterStatus } from '../postAnalysisFooter'
import type { RobustnessDisplayVerdict } from '@/components/results/types'

afterEach(() => cleanup())

// Mirror OutputsDock.tsx's icon map (the caller maps the icon name → component).
const POST_FOOTER_ICONS: Record<string, LucideIcon> = {
  check: CheckCircle,
  warning: AlertTriangle,
  unknown: HelpCircle,
}

/** Render the live footer exactly as OutputsDock does for a given verdict. */
function renderFooter(verdict: RobustnessDisplayVerdict | null | undefined) {
  const status = derivePostFooterStatus(verdict)
  return render(
    <AnalysisFooter
      statusIcon={POST_FOOTER_ICONS[status.icon]}
      statusIconClassName={status.iconClass}
      statusText={status.label}
      metaText="87% stability"
      metaPlacement="stacked"
      actionLabel="Rerun"
      onAction={() => {}}
      testId="results-analysis-footer"
    />,
  )
}

describe('AnalysisFooter — raw stability cannot render a positive robustness verdict', () => {
  it('no display-safe verdict (older PLoT builds) → neutral "Robustness unknown", no positive styling', () => {
    const { container } = renderFooter(undefined)
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Robustness unknown')
    expect(footer).not.toHaveTextContent('Stable ranking')
    // No green/check success styling anywhere in the neutral footer.
    expect(container.querySelector('.text-success')).toBeNull()
    expect(container.querySelector('.lucide-check-circle')).toBeNull()
    expect(container.querySelector('.lucide-help-circle')).not.toBeNull()
  })

  it('raw high recommendation_stability / ranking_stability are NOT inputs — only the verdict is', () => {
    // OutputsDock passes `recommendation.robustnessVerdict` (the normalised
    // producer display_verdict) — NOT report.robustness.recommendation_stability
    // and NOT the ranking_stability fallback. So however high those raw fields
    // are, an absent verdict renders the neutral footer above. The helper's
    // signature makes this structural: it accepts only RobustnessDisplayVerdict.
    const status = derivePostFooterStatus(undefined)
    expect(status).toEqual({ icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' })
    expect(status.label).not.toBe('Stable ranking')
  })

  it('the ONLY path to a positive green "Stable ranking" is robustnessVerdict === "robust"', () => {
    const { container } = renderFooter('robust')
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Stable ranking')
    // Positive verdict → success styling is allowed (stacked mode applies
    // statusIconClassName to both icon and label).
    expect(container.querySelector('.text-success')).not.toBeNull()
    expect(container.querySelector('.lucide-check-circle')).not.toBeNull()
  })

  it('sensitive producer verdicts → warning "Ranking sensitive to assumptions" (no success styling)', () => {
    for (const v of ['moderate', 'fragile'] as const) {
      const { container } = renderFooter(v)
      const footer = screen.getByTestId('results-analysis-footer')
      expect(footer).toHaveTextContent('Ranking sensitive to assumptions')
      expect(footer).not.toHaveTextContent('Stable ranking')
      expect(container.querySelector('.text-success')).toBeNull()
      cleanup()
    }
  })

  it('not_assessed → neutral "Robustness not assessed" (a stated absence is never a sensitivity claim)', () => {
    const { container } = renderFooter('not_assessed')
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Robustness not assessed')
    expect(footer).not.toHaveTextContent('Stable ranking')
    expect(footer).not.toHaveTextContent('Ranking sensitive to assumptions')
    expect(container.querySelector('.text-success')).toBeNull()
    expect(container.querySelector('.lucide-help-circle')).not.toBeNull()
  })

  it('runtime-safe: a raw stability NUMBER that slips through at runtime → neutral footer, no verdict styling', () => {
    // Defense-in-depth (rendered): even if 0.87 reached the wired helper at
    // runtime, the footer must render neutral "Robustness unknown" — never a
    // green "Stable ranking" nor an amber "Ranking sensitive to assumptions" from an
    // uncertified raw value.
    const { container } = renderFooter(0.87 as unknown as RobustnessDisplayVerdict)
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Robustness unknown')
    expect(footer).not.toHaveTextContent('Stable ranking')
    expect(footer).not.toHaveTextContent('Ranking sensitive to assumptions')
    expect(container.querySelector('.text-success')).toBeNull()
    expect(container.querySelector('.lucide-check-circle')).toBeNull()
    expect(container.querySelector('.lucide-help-circle')).not.toBeNull()
  })

  it('runtime-safe: the retired pre-#202 "high" token no longer unlocks the positive verdict', () => {
    const { container } = renderFooter('high' as unknown as RobustnessDisplayVerdict)
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Robustness unknown')
    expect(footer).not.toHaveTextContent('Stable ranking')
    expect(container.querySelector('.text-success')).toBeNull()
  })
})

describe('footer ↔ certified glyph consistency (single source)', () => {
  // The certified robustness glyph (TriageActionCardsBody T1ChecksFooter) is:
  //   robustOk    = robustnessVerdict === 'robust'                → positive ("Robust")
  //   robustKnown = 'robust' | 'moderate' | 'fragile'             → else "Sensitive"
  //   not_assessed                                                → "Robustness not assessed"
  //   undefined/null                                              → "Robustness unknown"
  // The footer MUST agree: positive iff the glyph is positive; otherwise the
  // footer must NOT render a positive "Stable ranking". This proves the two
  // sibling surfaces can never contradict (e.g. green "Stable ranking" beside a
  // neutral "Robustness unknown" glyph on the same Analysis tab).
  const ALL: Array<RobustnessDisplayVerdict | null | undefined> = [
    undefined, null, 'robust', 'moderate', 'fragile', 'not_assessed',
  ]

  it('footer renders a positive verdict iff the glyph would (verdict === "robust")', () => {
    for (const v of ALL) {
      const status = derivePostFooterStatus(v)
      const glyphPositive = v === 'robust'
      const footerPositive = status.label === 'Stable ranking' && status.icon === 'check'
      expect(footerPositive).toBe(glyphPositive)
      if (!glyphPositive) {
        // Glyph neutral/sensitive → footer must not be a positive "Stable ranking".
        expect(status.label).not.toBe('Stable ranking')
        expect(status.iconClass).not.toContain('success')
      }
    }
  })

  it('when the glyph is neutral (verdict undefined), the footer is also neutral', () => {
    expect(derivePostFooterStatus(undefined).label).toBe('Robustness unknown')
  })
})
