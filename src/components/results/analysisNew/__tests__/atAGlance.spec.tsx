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

  it('renders when the producer computed one', () => {
    expect(withFlip('computed', ROW)).toEqual({
      text: 'Two-month timeframe passes 3',
      targetId: 'n_time',
    })
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
