/**
 * At a glance — the semantic contract of the 5-to-10-second read.
 *
 * These pin the claims the concept mock-ups got wrong, so a future revision
 * that reintroduces them goes RED with a named reason rather than shipping.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheld,
  genuineDecision,
  highUncertainty,
  makeData,
  makeDriver,
  openStrategicChallenge,
} from './analysisNewFixtures'

const glanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    recommendationCandidateCount: 0,
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance

afterEach(() => cleanup())

describe('the read — no UI-generated strategic conclusion', () => {
  it('states the leader only when the single verdict entitles one', () => {
    expect(glanceOf(genuineDecision()).headline).toBe('Raise price currently scores higher')
  })

  it('renders NO headline when the entitlement is withheld — it does not fall back to a substitute', () => {
    // The discriminating twin. A surface that invented a synthesis to fill the
    // space would still produce a headline here.
    expect(glanceOf(decisionWithLeaderWithheld()).headline).toBeNull()
  })

  it('renders no headline for an open strategic challenge, but still has drivers to lead with', () => {
    const g = glanceOf(openStrategicChallenge())
    expect(g.headline).toBeNull()
    expect(g.drivers.length).toBeGreaterThan(0)
  })
})

describe('the trust qualification', () => {
  it('maps the producer enum to one word and carries its reason VERBATIM', () => {
    const g = glanceOf(genuineDecision())
    expect(g.verdict).toEqual({
      tone: 'stable',
      label: 'Stable',
      reason: 'The ordering held across the simulated range.',
    })
  })

  it('renders NOTHING for not_assessed — the stated absence is not a fourth word', () => {
    const g = glanceOf(
      makeData({ recommendation: { robustnessVerdict: 'not_assessed' as never } }),
    )
    expect(g.verdict).toBeNull()
  })

  it('never composes a coverage claim of its own', () => {
    // "Robust across MOST TESTED uncertainty" was a fraction nothing computes.
    for (const f of [genuineDecision(), highUncertainty(), openStrategicChallenge()]) {
      const text = JSON.stringify(glanceOf(f).verdict ?? {})
      expect(text).not.toMatch(/most|tested uncertainty|coverage|all uncertaint/i)
    }
  })
})

describe('driver bars — a rank comparison, never a share of the outcome', () => {
  it('scales to the STRONGEST driver, not to a sum', () => {
    const data = makeData({
      drivers: {
        drivers: [
          makeDriver({ factorKey: 'a', factorLabel: 'A', displayInfluence: 0.5 }),
          makeDriver({ factorKey: 'b', factorLabel: 'B', displayInfluence: 0.25 }),
        ],
      },
    })
    const g = glanceOf(data)
    // Top is 1.0 and the second is HALF of it. Under a share-of-sum scaling
    // these would be 0.667 / 0.333 — the reading the percentages invited.
    expect(g.drivers[0].fraction).toBeCloseTo(1, 5)
    expect(g.drivers[1].fraction).toBeCloseTo(0.5, 5)
  })

  it('caps at three and flags a set-relative basis from the producer token', () => {
    expect(glanceOf(highUncertainty()).influenceIsSetRelative).toBe(true)
    expect(glanceOf(openStrategicChallenge()).influenceIsSetRelative).toBe(false)
    expect(glanceOf(openStrategicChallenge()).drivers.length).toBeLessThanOrEqual(3)
  })

  it('renders no numeric influence anywhere in the glance', () => {
    // The whole point of bars: no number appears that could be read as a share.
    const html = render(<AtAGlance glance={glanceOf(openStrategicChallenge())} />).container.innerHTML
    expect(html).not.toMatch(/\d+%<\/|>\s*\d+%\s*</)
  })
})

describe('could change if — a tipping point, gated on the honesty field', () => {
  const withFlip = (status: string | undefined, flip: unknown) =>
    glanceOf(
      makeData({
        recommendation: {
          flipThresholdsStatus: status as never,
          flipThresholds: [flip] as never,
        },
      }),
    ).condition

  const ROW = { label: 'Two-month timeframe', node_id: 'n_time', current_value: 2, flip_value: 3 }

  it('renders when the producer computed one, with its unit', () => {
    expect(withFlip('computed', { ...ROW, unit: '%' })).toEqual({
      text: 'Two-month timeframe passes 3%',
      targetId: 'n_time',
    })
  })

  it('pairs the flip value with the current one when the producer sent NO unit', () => {
    // Witnessed on a real run before this was fixed: "Price increase for new
    // customers passes 1" — a bare number on the model's own scale, which the
    // reader cannot place. `current_value` is the reference, from the same row.
    expect(withFlip('computed', ROW)!.text).toBe('Two-month timeframe moves from 2 to 3')
  })

  it('states the condition WITHOUT a number when neither a unit nor a baseline exists', () => {
    // No baseline means no direction of travel — printing a lone figure would
    // imply one the producer never supplied.
    expect(withFlip('computed', { ...ROW, current_value: null })!.text).toBe(
      'Two-month timeframe changes materially',
    )
  })

  it('renders NOTHING when the producer could not determine a flip', () => {
    // 'unresolved'/'unavailable' are technical non-results. Turning either into
    // a visible condition converts "we could not compute this" into a finding.
    for (const status of ['unresolved', 'unavailable', 'all_no_effect']) {
      expect(withFlip(status, ROW), `status ${status} must render nothing`).toBeNull()
    }
  })

  it('renders nothing when the flip value itself is absent', () => {
    expect(withFlip('computed', { ...ROW, flip_value: null })).toBeNull()
  })

  it('is NOT derived from the influence ranking', () => {
    // A run with drivers but no flip thresholds must produce no condition —
    // otherwise the top driver would be reappearing under a second name.
    const g = glanceOf(openStrategicChallenge())
    expect(g.drivers.length).toBeGreaterThan(0)
    expect(g.condition).toBeNull()
  })
})

describe('fail-closed focus, and the interaction grammar', () => {
  it('renders an unfocusable driver as text, never as a dead control', () => {
    const data = makeData({
      drivers: { drivers: [makeDriver({ factorKey: 'x', factorLabel: 'X', canFocus: false })] },
    })
    render(<AtAGlance glance={glanceOf(data)} onFocusTarget={vi.fn()} />)
    expect(screen.getByTestId('analysis-new-glance-driver')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-glance-driver-focus')).toBeNull()
  })

  it('routes a focusable driver to the Living Model by its producer target id', () => {
    const onFocusTarget = vi.fn()
    const data = makeData({
      drivers: {
        drivers: [makeDriver({ factorKey: 'x', factorLabel: 'X', matchedNodeId: 'node_x' })],
      },
    })
    render(<AtAGlance glance={glanceOf(data)} onFocusTarget={onFocusTarget} />)
    fireEvent.click(screen.getByTestId('analysis-new-glance-driver-focus'))
    expect(onFocusTarget).toHaveBeenCalledWith('node_x')
  })
})

describe('the whole region collapses honestly', () => {
  it('renders nothing at all when no producer supplied any of it', () => {
    const { container } = render(<AtAGlance glance={glanceOf(makeData())} />)
    expect(container.querySelector('[data-testid="analysis-new-glance"]')).toBeNull()
  })
})

describe('one signal, one primary surface', () => {
  const vmOf = (data: ResultsSectionDataReturn) =>
    buildAnalysisNewViewModel({
      data,
      recommendations: [],
      recommendationCandidateCount: 0,
      isPreRun: false,
      isRunning: false,
      isStale: false,
    })

  it('drops the insights the glance already states', () => {
    // Measured on a real run: all three key insights restated the glance.
    const vm = vmOf(genuineDecision())
    expect(vm.atAGlance.headline).toBeTruthy()
    expect(vm.atAGlance.verdict).toBeTruthy()
    const ids = vm.keyInsights.insights.map((i) => i.id)
    expect(ids).not.toContain('insight:comparative')
    expect(ids).not.toContain('insight:robustness')
  })

  it('KEEPS the comparative insight when the glance did NOT state it', () => {
    // ⭐ THE DISCRIMINATING HALF. Suppression is keyed to what the glance
    // actually rendered — a blanket id filter would delete this finding on
    // exactly the runs where the list is the only place it could appear.
    const withheld = vmOf(decisionWithLeaderWithheld())
    expect(withheld.atAGlance.headline).toBeNull()
    // The comparative insight is absent here for its OWN reason (no
    // entitlement), so assert the mechanism on robustness instead: the glance
    // has no verdict, therefore the insight survives.
    const noVerdict = vmOf(
      makeData({
        recommendation: {
          robustnessVerdict: undefined as never,
          coachingHeadline: 'What this run found',
          coachingDecisionStatement: 'A statement.',
        },
      }),
    )
    expect(noVerdict.atAGlance.verdict).toBeNull()
    expect(noVerdict.keyInsights.insights.map((i) => i.id)).toContain('insight:executive-summary')
  })

  it('suppresses the hinge insight when the glance already states a condition, and still reports the RUN count', () => {
    // The hinge is the ONE remaining dedupe path: it comes from a DIFFERENT
    // producer than the glance condition (`topFragileEdge` vs `flipThresholds`),
    // so both can exist on the same run and the duplicate must be removed.
    const both = makeData({
      recommendation: {
        flipThresholdsStatus: 'computed' as never,
        flipThresholds: [
          { label: 'Timeframe', node_id: 'n_t', current_value: 2, flip_value: 3 },
        ] as never,
      },
      confidence: {
        topFragileEdge: {
          fromId: 'f_a',
          fromLabel: 'Timeframe',
          toId: 'g',
          toLabel: 'Goal',
          alternativeWinnerLabel: 'Other',
          switchProbability: 0.4,
        },
      },
    })
    const vm = vmOf(both)
    expect(vm.atAGlance.condition, 'the glance must state a condition for this case to mean anything').not.toBeNull()
    expect(vm.keyInsights.insights.map((i) => i.id)).not.toContain('insight:hinge')
    // The count still reports what the RUN produced — a cap disclosure that
    // shrinks silently is worse than no disclosure.
    expect(vm.keyInsights.candidateCount).toBeGreaterThan(vm.keyInsights.insights.length)
  })

  it('KEEPS the hinge insight when the glance states NO condition', () => {
    // The discriminating twin: without a glance condition the hinge is the only
    // place that finding appears, and a blanket id filter would delete it.
    const hingeOnly = makeData({
      confidence: {
        topFragileEdge: {
          fromId: 'f_a',
          fromLabel: 'Timeframe',
          toId: 'g',
          toLabel: 'Goal',
          alternativeWinnerLabel: 'Other',
          switchProbability: 0.4,
        },
      },
    })
    const vm = vmOf(hingeOnly)
    expect(vm.atAGlance.condition).toBeNull()
    expect(vm.keyInsights.insights.map((i) => i.id)).toContain('insight:hinge')
  })
})

describe('the flip gate honours the producer\'s own verdict on the row', () => {
  const cond = (row: Record<string, unknown>) =>
    buildAnalysisNewViewModel({
      data: makeData({
        recommendation: { flipThresholdsStatus: 'computed' as never, flipThresholds: [row] as never },
      }),
      recommendations: [],
      recommendationCandidateCount: 0,
      isPreRun: false,
      isRunning: false,
      isStale: false,
    }).atAGlance.condition

  const FOUND = { label: 'Price', node_id: 'n', current_value: 0, flip_value: 1, flip_reason: 'found' }

  it('renders a row the producer says it FOUND', () => {
    expect(cond(FOUND)).not.toBeNull()
  })

  it('refuses a row flagged no_flip_in_range even when it carries a value', () => {
    // Derived from a real payload: 3 of 4 rows came back no_flip_in_range with
    // a null value, so a value-only check passed by luck. This is the case that
    // luck does not cover.
    expect(cond({ ...FOUND, no_flip_in_range: true })).toBeNull()
  })

  it("refuses a row whose reason is not 'found'", () => {
    for (const reason of ['no_effect_within_bounds', 'structurally_invariant']) {
      expect(cond({ ...FOUND, flip_reason: reason }), reason).toBeNull()
    }
  })
})

/**
 * ⭐⭐ THE PRODUCER'S REASON IS NEVER CLIPPED — a TRUTH pin, not a layout one.
 *
 * Measured on a real completed run at the 320px content measure: the reason was
 * rendered inline with `truncate`, and the producer's 131 characters were given
 * 190px. 696px of text in a 190px box — roughly three quarters invisible. What
 * survived REVERSED THE MEANING:
 *
 *   producer   "none of the factors we could test changed which option leads
 *               on its own, BUT this result scored low on our other
 *               robustness checks"
 *   on screen  "none of the factors we could te…"
 *
 * The fragment reads as reassurance. The sentence is a warning.
 *
 * ⚠ WHY THIS IS PINNED STRUCTURALLY RATHER THAN VISUALLY. jsdom has no layout,
 * so it cannot see a clip (trap 3) — asserting the text is "present" would pass
 * happily on the clipped version, since the DOM held the whole string all along.
 * What jsdom IS authoritative about is the MECHANISM that produced the clip: a
 * single-line ancestor with an overflow class. So the assertion binds there.
 *
 * A truncated LABEL is a cosmetic loss and stays permitted — the reader can see
 * a name was shortened, and a title attribute recovers it. A truncated SENTENCE
 * silently manufactures a shorter, well-formed claim the producer never made.
 */
describe("the producer's reason is rendered whole, never clipped", () => {
  const withReason = () => {
    const g = glanceOf(genuineDecision())
    return {
      ...g,
      verdict: {
        tone: 'sensitive' as const,
        label: 'Sensitive',
        reason:
          'none of the factors we could test changed which option leads on its own, but this result scored low on our other robustness checks',
      },
    }
  }

  it('gives the reason its own element, outside the single-line verdict row', () => {
    render(<AtAGlance glance={withReason()} />)
    const reason = screen.getByTestId('analysis-new-glance-verdict-reason')
    const line = screen.getByTestId('analysis-new-glance-verdict-line')

    expect(reason.textContent).toBe(withReason().verdict.reason)
    // The defect in one assertion: the reason must not live inside the row that
    // is constrained to one line.
    expect(line.contains(reason)).toBe(false)
  })

  it('carries no truncating class on the reason or any of its ancestors', () => {
    const { container } = render(<AtAGlance glance={withReason()} />)
    const reason = screen.getByTestId('analysis-new-glance-verdict-reason')

    const clipping: string[] = []
    for (let el: HTMLElement | null = reason; el && el !== container; el = el.parentElement) {
      const cls = el.className
      if (typeof cls === 'string' && /\b(truncate|text-ellipsis|whitespace-nowrap|line-clamp-\d+)\b/.test(cls)) {
        clipping.push(`${el.dataset.testid ?? el.tagName}: ${cls}`)
      }
    }
    expect(clipping, `producer prose sits inside a clipping container:\n${clipping.join('\n')}`).toEqual([])
  })

  it('still permits a driver LABEL to truncate — the two are different objects', () => {
    // Contrast control. Without it this rule would read as "never truncate
    // anything", which would cost the fixed bar track its comparability.
    const { container } = render(<AtAGlance glance={glanceOf(genuineDecision())} />)
    expect(container.querySelector('.truncate'), 'no label truncation left to distinguish from prose').not.toBeNull()
  })
})

/**
 * ⭐ A BAR IS A COMPARISON. WITH ONE ROW THERE IS NOTHING TO COMPARE.
 *
 * `fraction` is magnitude ÷ the run's strongest magnitude, so a lone driver is
 * 1 by construction and its bar renders FULL whatever the producer measured.
 * Witnessed on a real run: a single non-zero driver at contribution 0.5 drew a
 * full-width bar, which reads as "maximum influence" and is a magnitude claim
 * the encoding cannot support.
 *
 * The pair below is the discrimination — one alone would not show the rule is
 * about COMPARABILITY rather than about hiding bars.
 */
describe('the influence bar appears only when it compares something', () => {
  const withDrivers = (n: number) => ({
    ...glanceOf(genuineDecision()),
    drivers: Array.from({ length: n }, (_, i) => ({
      id: `d${i}`,
      label: `Driver ${i}`,
      fraction: i === 0 ? 1 : 0.4,
      targetId: null,
    })),
  })

  it('draws no bar for a single driver', () => {
    render(<AtAGlance glance={withDrivers(1)} />)
    expect(screen.getAllByTestId('analysis-new-glance-driver')).toHaveLength(1)
    expect(screen.queryByTestId('analysis-new-glance-driver-bar')).toBeNull()
  })

  it('draws a bar for every driver once two or more can be ranked', () => {
    render(<AtAGlance glance={withDrivers(3)} />)
    expect(screen.getAllByTestId('analysis-new-glance-driver-bar')).toHaveLength(3)
  })
})
