/**
 * THE ANALYSE CONTROL, THROUGH THE SURFACE THE USER ACTUALLY LOADS (P2).
 *
 * `canRunAnalysis` returning an honest sentence proves nothing about what the
 * panel prints. Between the gate and the pixel sits `PanelFooter`'s
 * `vetBlockedReason`, which routes any non-composed string through
 * `guardCeeText` — and that guard's whole job is to REPLACE strings it does not
 * like with `FOOTER_COPY.notReadySubFallback`. A refusal that is true in the
 * gate and degraded in the footer is the same defect wearing the fix's clothes,
 * and it is invisible to every pure-function test of the gate.
 *
 * P1 — the seam tested one beyond the guard: `vetBlockedReason` → `guardCeeText`
 * → the rendered `pre-analysis-v3-footer` subline AND the button's `title`.
 *
 * Trap 3b — this binds to `PanelFooter`, which is the surface the deployed
 * flags mount: the 18 Aug affordance sweep read `data-testid`
 * `pre-analysis-v3-analyse` and `pre-analysis-v3-footer` off the deployed build
 * `1dec0ad6`, so these are the live ids, not a component the deployment skips.
 *
 * Scope (trap 3): PRESENCE and TEXT on the mounted footer. Not layout, not
 * visibility, not above-the-fold — those need a browser.
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { PanelFooter } from '../footer/PanelFooter'
import { FOOTER_COPY } from '../constants'
import { ANALYSIS_HELD_NOTICE } from '../../../utils/analysisHeldOnInjectedModel'

/** The open-gate footer the panel supplies when it has nothing to refuse. */
const openFooter = {
  dot: 'success' as const,
  headline: FOOTER_COPY.ready,
  subline: 'First pass will be provisional until success is defined',
}

function renderFooter(props: Partial<React.ComponentProps<typeof PanelFooter>> = {}) {
  return render(
    <PanelFooter
      footer={openFooter}
      onAnalyse={vi.fn()}
      isAnalysing={false}
      canRun={false}
      {...props}
    />,
  )
}

describe('the refusal the user reads is the refusal the gate emitted', () => {
  it('CONTROL: the held-analysis sentence reaches the footer VERBATIM, not the fallback', () => {
    renderFooter({ blockedReason: ANALYSIS_HELD_NOTICE.starter })

    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent(ANALYSIS_HELD_NOTICE.starter)
    // The absence half — vacuous without the presence assertion above.
    expect(footer).not.toHaveTextContent(FOOTER_COPY.notReadySubFallback)
    // And the sentence the sweep witnessed is gone from this surface entirely.
    expect(footer).not.toHaveTextContent('Draft or save a model first')
  })

  it('the button is DISABLED and its tooltip carries the SAME sentence as the subline', () => {
    renderFooter({ blockedReason: ANALYSIS_HELD_NOTICE.starter })

    const button = screen.getByTestId('pre-analysis-v3-analyse')
    expect(button).toBeDisabled()
    // Two consumers of one authority, in one component: the subline and the
    // title must not be able to say different things about one state.
    expect(button).toHaveAttribute('title', ANALYSIS_HELD_NOTICE.starter)
  })

  it('the template variant survives the guard too — both nouns, one seam', () => {
    renderFooter({ blockedReason: ANALYSIS_HELD_NOTICE.template })
    expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(
      ANALYSIS_HELD_NOTICE.template,
    )
  })

  it('NEGATIVE CONTROL: the degrade path is still alive, so the pins above are not vacuous', () => {
    // Without this, "the sentence renders verbatim" would also pass against a
    // guard that had been deleted. `value of information` is in the guard's
    // extra-terms list with NO approved substitution, so it must degrade.
    renderFooter({ blockedReason: 'The value of information is too low to analyse.' })

    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent(FOOTER_COPY.notReadySubFallback)
    expect(footer).not.toHaveTextContent('value of information')
  })
})

describe('the real journey: the obvious Analyse control works on a live model', () => {
  it('an open gate ENABLES the button and makes no not-ready claim', () => {
    // The founder's other half. A fix for a false refusal that quietly left the
    // control disabled everywhere would satisfy every assertion above.
    renderFooter({ canRun: true, blockedReason: undefined })

    const button = screen.getByTestId('pre-analysis-v3-analyse')
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('title')

    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent(FOOTER_COPY.ready)
    expect(footer).not.toHaveTextContent(FOOTER_COPY.notReady)
    expect(footer).not.toHaveTextContent('Analysis is held')
  })

  it('an open gate ignores an advisory blockedReason rather than printing a refusal', () => {
    // `blockedReason` is documented as advisory while the gate is open. This
    // pins that an open gate cannot be made to state a refusal by a stale
    // tooltip string — the failure mode that made an enabled state read as
    // disabled in the original footer diagnosis.
    renderFooter({ canRun: true, blockedReason: ANALYSIS_HELD_NOTICE.starter })

    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeEnabled()
    expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent(
      ANALYSIS_HELD_NOTICE.starter,
    )
  })
})
