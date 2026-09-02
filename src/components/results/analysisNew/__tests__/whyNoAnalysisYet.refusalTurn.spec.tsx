/**
 * ⭐⭐ THE REFUSAL REACHES THE SCREEN ON THE BRANCH THAT WAS SILENT.
 *
 * Its sibling `whyNoAnalysisYet.spec.tsx` feeds this component a HAND-WRITTEN
 * listing and pins how it renders one. That is the right test for the
 * component, and it is structurally incapable of seeing this defect: the
 * listing it renders is the one the test author supplied, so it cannot notice
 * that on a CEE refusal turn the GATE hands it a non-committal sentence
 * instead. **A fixture you wrote yourself is not evidence about the wire.**
 *
 * So this spec composes the listing WITH THE REAL GATE, from the payload the
 * P0 witness captured, and asserts what a refused user reads. Nothing here is
 * a fixture except CEE's own bytes.
 *
 * ⚠ WHAT THIS CANNOT PROVE: jsdom has no layout, so a string can be in the DOM
 * with `offsetParent === null` and be invisible on screen. Presence here is
 * necessary, never sufficient — the visibility claim is settled in a browser
 * and recorded in the PR body, not by this file.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { WhyNoAnalysisYet } from '../sections/WhyNoAnalysisYet'
import { canRunAnalysis } from '../../../../canvas/utils/canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../../../../canvas/utils/composeBlockedReason'
import type { GraphReadiness, ReadinessIssue } from '../../../../canvas/hooks/useGraphReadiness'

const BLOCKER_REASON =
  "This model can't be analysed yet. The values involved are Olumi's own suggestions, not yours — ask Olumi to work them through, or set them yourself."

function issue(n: number, obligation: 'required' | 'offered'): ReadinessIssue {
  return {
    message: `Factor "Factor ${n}" needs a numeric value for option "Option ${n}".`,
    code: 'MISSING_OPTION_VALUE',
    option_id: `opt_${n}`,
    option_label: `Option ${n}`,
    factor_id: `fac_${n}`,
    factor_label: `Factor ${n}`,
    obligation,
  }
}

function sideCar(issues: ReadinessIssue[]): GraphReadiness {
  return {
    readiness_score: 40,
    // ⚠ `needs_work`, not an invented band. `CEE_READINESS_LEVELS` is the
    // three-member CEE vocabulary and a fixture outside it is not a payload
    // this product can receive — the cast that would have hidden that is
    // deliberately absent, so the compiler checks the shape.
    readiness_level: 'needs_work',
    can_run_analysis: false,
    confidence_explanation: 'V3 analysis not ready',
    improvements: [],
    may_run: false,
    blocker_reason: BLOCKER_REASON,
    readiness_issues: issues,
  }
}

/** The deployed Run-analysis chip's refusal shape (CEE `c110c5e3`). */
const REFUSAL_TURN = { status: 'blocked', blockers: [] } as const

function listingFor(issues: ReadinessIssue[]) {
  const result = canRunAnalysis({
    graphHealth: null,
    readiness: sideCar(issues),
    analysisReadiness: REFUSAL_TURN as never,
    mayRun: false,
    hasBlockers: false,
    nodeCount: 12,
    isRunning: false,
  } as never)
  expect(result.allowed).toBe(false)
  return result.blockedListing ?? null
}

afterEach(() => cleanup())

describe('WhyNoAnalysisYet — fed by the real gate on a CEE refusal turn', () => {
  it('shows CEE’s written refusal when every repair is Olumi’s own suggestion', () => {
    const onFocusTarget = vi.fn()
    render(
      <WhyNoAnalysisYet
        listing={listingFor([1, 2, 3, 4, 5].map((n) => issue(n, 'offered')))}
        onFocusTarget={onFocusTarget}
      />,
    )

    expect(screen.getByText(BLOCKER_REASON)).toBeInTheDocument()
    // The defect this replaces, bound by identity so a reworded floor cannot
    // slip past: the panel must no longer send the user to the chat.
    expect(screen.queryByText(BLOCKED_REASON_COPY.unspecified)).not.toBeInTheDocument()
    // INV-P6: offered repairs are SHOWN BY the headline, never DEMANDED as rows.
    expect(screen.getAllByTestId('analysis-new-why-no-analysis-item')).toHaveLength(1)
    // A headline speaks for the whole model, so it must not pretend to route.
    expect(screen.queryAllByTestId('analysis-new-why-no-analysis-route')).toHaveLength(0)
  })

  it('lists every OWED repair as its own row, each routing to its option', () => {
    const onFocusTarget = vi.fn()
    render(
      <WhyNoAnalysisYet
        listing={listingFor([1, 2, 3, 4, 5].map((n) => issue(n, 'required')))}
        onFocusTarget={onFocusTarget}
      />,
    )

    const rows = screen.getAllByTestId('analysis-new-why-no-analysis-item')
    expect(rows).toHaveLength(5)
    for (const n of [1, 2, 3, 4, 5]) {
      // Verbatim — a panel that "improved" the producer's text would pass a
      // looser matcher and must fail this one.
      expect(screen.getByText(issue(n, 'required').message)).toBeInTheDocument()
    }
    const routes = screen.getAllByTestId('analysis-new-why-no-analysis-route')
    expect(routes.map((r) => r.getAttribute('data-target-id'))).toEqual([
      'opt_1',
      'opt_2',
      'opt_3',
      'opt_4',
      'opt_5',
    ])
    routes[2].click()
    expect(onFocusTarget).toHaveBeenCalledWith('opt_3')
  })

  it('renders nothing at all when neither authority has anything to say', () => {
    // The floor case must stay a floor: an empty explanation box on a model the
    // gate cannot explain would be an invented obstacle.
    const { container } = render(
      <WhyNoAnalysisYet listing={{ summary: '', sentences: [] }} onFocusTarget={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
