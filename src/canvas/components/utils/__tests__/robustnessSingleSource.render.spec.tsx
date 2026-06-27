/**
 * Robustness single-source rule — rendered-state + footer↔glyph consistency.
 *
 * Guards the live trust fix (ROBUSTNESS-VERDICT-CONTRACT): the post-analysis
 * AnalysisFooter must derive its verdict ONLY from the display-safe
 * `robustnessVerdict`, never from raw `recommendation_stability` /
 * `ranking_stability`. With no display-safe verdict in the contract today the
 * footer renders the neutral "Robustness unknown" state, in lock-step with the
 * certified glyph (TriageActionCardsBody `checks-robust`) — so the Analysis tab
 * can never show a green "Stable result" beside a neutral "Robustness unknown".
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
import type { RobustnessLevel } from '@/components/results/types'

afterEach(() => cleanup())

// Mirror OutputsDock.tsx's icon map (the caller maps the icon name → component).
const POST_FOOTER_ICONS: Record<string, LucideIcon> = {
  check: CheckCircle,
  warning: AlertTriangle,
  unknown: HelpCircle,
}

/** Render the live footer exactly as OutputsDock does for a given verdict. */
function renderFooter(verdict: RobustnessLevel | null | undefined) {
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
  it('no display-safe verdict (live contract today) → neutral "Robustness unknown", no positive styling', () => {
    const { container } = renderFooter(undefined)
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Robustness unknown')
    expect(footer).not.toHaveTextContent('Stable result')
    // No green/check success styling anywhere in the neutral footer.
    expect(container.querySelector('.text-success')).toBeNull()
    expect(container.querySelector('.lucide-check-circle')).toBeNull()
    expect(container.querySelector('.lucide-help-circle')).not.toBeNull()
  })

  it('raw high recommendation_stability / ranking_stability are NOT inputs — only the verdict is', () => {
    // OutputsDock now passes `recommendation.robustnessVerdict` (undefined in
    // production) — NOT report.robustness.recommendation_stability and NOT the
    // ranking_stability fallback. So however high those raw fields are, the
    // footer that renders is the undefined-verdict (neutral) one above. The
    // helper's signature makes this structural: it accepts only RobustnessLevel.
    const status = derivePostFooterStatus(undefined)
    expect(status).toEqual({ icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' })
    // Sanity: a raw number is not a RobustnessLevel; passing one is a type error
    // at call sites, and at runtime any non-'high' value falls to Sensitive,
    // never the positive "Stable result" path reserved for the verdict 'high'.
    expect(status.label).not.toBe('Stable result')
  })

  it('the ONLY path to a positive green "Stable result" is robustnessVerdict === "high"', () => {
    const { container } = renderFooter('high')
    const footer = screen.getByTestId('results-analysis-footer')
    expect(footer).toHaveTextContent('Stable result')
    // Positive verdict → success styling is allowed (stacked mode applies
    // statusIconClassName to both icon and label).
    expect(container.querySelector('.text-success')).not.toBeNull()
    expect(container.querySelector('.lucide-check-circle')).not.toBeNull()
  })

  it('known non-"high" verdict → warning "Sensitive to assumptions" (no success styling)', () => {
    for (const v of ['moderate', 'low', 'very_low'] as const) {
      const { container } = renderFooter(v)
      const footer = screen.getByTestId('results-analysis-footer')
      expect(footer).toHaveTextContent('Sensitive to assumptions')
      expect(footer).not.toHaveTextContent('Stable result')
      expect(container.querySelector('.text-success')).toBeNull()
      cleanup()
    }
  })
})

describe('footer ↔ certified glyph consistency (single source)', () => {
  // The certified robustness glyph (TriageActionCardsBody.tsx:411-412) is:
  //   robustOk   = robustnessVerdict === 'high'    → positive ("Robust")
  //   robustKnown = robustnessVerdict != null      → else "Sensitive"
  //   neither    = undefined/null                  → "Robustness unknown"
  // The footer MUST agree: positive iff the glyph is positive; otherwise the
  // footer must NOT render a positive "Stable result". This proves the two
  // sibling surfaces can never contradict (e.g. green "Stable result" beside a
  // neutral "Robustness unknown" glyph on the same Analysis tab).
  const ALL: Array<RobustnessLevel | null | undefined> = [
    undefined, null, 'high', 'moderate', 'low', 'very_low',
  ]

  it('footer renders a positive verdict iff the glyph would (verdict === "high")', () => {
    for (const v of ALL) {
      const status = derivePostFooterStatus(v)
      const glyphPositive = v === 'high'
      const footerPositive = status.label === 'Stable result' && status.icon === 'check'
      expect(footerPositive).toBe(glyphPositive)
      if (!glyphPositive) {
        // Glyph neutral/sensitive → footer must not be a positive "Stable result".
        expect(status.label).not.toBe('Stable result')
        expect(status.iconClass).not.toContain('success')
      }
    }
  })

  it('when the glyph is neutral (verdict undefined), the footer is also neutral', () => {
    expect(derivePostFooterStatus(undefined).label).toBe('Robustness unknown')
  })
})
