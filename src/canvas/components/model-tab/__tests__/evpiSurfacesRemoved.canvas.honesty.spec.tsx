/**
 * EVPI display surfaces — REMOVED (canvas side).
 *
 * Companion to `src/components/results/__tests__/evpiSurfacesRemoved.honesty.spec.tsx`.
 * See that file's header for the live measurement that refutes the number.
 *
 * Covers the canvas surfaces the original brief did not name:
 *   · FactorsSection    — the "Worth Xpp if resolved" chip AND the `EVPI  Xpp` row
 *   · FactorsSection    — the factor-list ORDER, which was EVPI-ranked
 *   · StatusBar         — the `"{X}pp via EVPI"` chip (a SUM of three refuted numbers)
 *   · compare-tab Hero  — "resolving could improve confidence by {X}pp"
 *
 * The order and label cases matter because #477 — the commit immediately
 * preceding this one — exists to close "the NON-TEXT channels — order, bar,
 * stroke — that still spoke the default". An EVPI-ordered list under a visible
 * `ranked by EVPI` label reopens that exact class.
 *
 * CLAIM TYPE: rendered text / DOM presence / rendered ORDER within jsdom.
 * NOT a visibility claim.
 */

import React from 'react'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { FactorsSection } from '../FactorsSection'
import { StatusBar } from '../StatusBar'
import { Hero } from '../../../compare-tab/Hero'
import type { AnalysisSnapshot } from '../../../compare-tab/types'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) => selector({ updateNode: vi.fn() })),
}))
vi.mock('../../../utils/focusHelpers', () => ({ focusNodeById: vi.fn() }))
vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockStorage = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => mockStorage.get(k) ?? null,
  setItem: (k: string, v: string) => mockStorage.set(k, v),
  removeItem: (k: string) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
  length: 0,
  key: () => null,
})

const PP_TOKEN = /\d+(\.\d+)?\s*pp\b/i

/**
 * Inject a prop the component no longer declares.
 *
 * The removal is only meaningful if a caller that STILL supplies the old prop
 * gets nothing rendered — a test that merely omits it would also pass against a
 * component that still reads it. The cast is deliberate and local to this file.
 */
function withRemovedProp<P>(props: P, removed: Record<string, unknown>): P {
  return { ...props, ...removed } as P
}

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'observable',
      observedState: { value: 0.5, source: 'user' },
    },
  } as unknown as Node
}

// Live `a4b32ee2` factors, with the exact refuted figures PLoT publishes.
const NODES = [
  factorNode('fac_salary_cost', 'Annual Salary Cost'),
  factorNode('fac_team_experience', 'Existing Team Experience Level'),
]
const LIVE_EVPI = new Map([['fac_team_experience', 10.2], ['fac_salary_cost', 6.6]])

describe('FactorsSection — no EVPI text and no EVPI ordering', () => {
  it('POSITIVE CONTROL: both factor cards render', () => {
    render(<FactorsSection factorNodes={NODES} hasAnalysisData isExpanded />)
    expect(screen.getByText('Annual Salary Cost')).toBeInTheDocument()
    expect(screen.getByText('Existing Team Experience Level')).toBeInTheDocument()
  })

  it('renders neither the "Worth Xpp" chip nor the EVPI row, even when handed an evpiMap', () => {
    const { container } = render(
      <FactorsSection
        {...withRemovedProp(
          {
            factorNodes: NODES,
            hasAnalysisData: true,
            isExpanded: true,
            factorInfluence: new Map([['fac_salary_cost', 0.9], ['fac_team_experience', 0.1]]),
          },
          { evpiMap: LIVE_EVPI },
        )}
      />,
    )

    // ⚠ The chip and the metric row are BOTH gated on per-card expansion
    // (`cardExpanded`), which only a click sets. An earlier version of this
    // spec asserted their absence WITHOUT clicking — and a mutant that
    // restored the chip verbatim still passed, because the card was collapsed
    // and nothing could have rendered. Expand first, then assert.
    for (const node of NODES) {
      fireEvent.click(screen.getByTestId(`factor-card-${node.id}`))
    }

    // POSITIVE CONTROL for the expansion itself: content that appears ONLY on
    // an expanded post-analysis card must now be present. Without this, the
    // absence assertions below are unfalsifiable again.
    expect(screen.getAllByText('Influence').length).toBeGreaterThan(0)

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/worth\s+\d/i)
    expect(text).not.toMatch(/would improve confidence by/i)
    expect(text).not.toMatch(/\bEVPI\b/)
    expect(text).not.toMatch(PP_TOKEN)
    expect(text).not.toContain('10.2')
    expect(text).not.toContain('6.6')
    expect(container.querySelector('[data-testid$="-evpi"]')).toBeNull()
  })

  it('orders by influence, not by EVPI, when analysis data is present', () => {
    // EVPI would rank team_experience (10.2) above salary_cost (6.6).
    // Influence here deliberately DISAGREES: salary_cost leads. If the EVPI
    // sort branch were still live, this assertion would invert.
    const { container } = render(
      <FactorsSection
        {...withRemovedProp(
          {
            factorNodes: NODES,
            hasAnalysisData: true,
            isExpanded: true,
            factorInfluence: new Map([['fac_salary_cost', 0.9], ['fac_team_experience', 0.1]]),
          },
          { evpiMap: LIVE_EVPI },
        )}
      />,
    )
    const text = container.textContent ?? ''
    const iSalary = text.indexOf('Annual Salary Cost')
    const iTeam = text.indexOf('Existing Team Experience Level')
    expect(iSalary).toBeGreaterThanOrEqual(0)
    expect(iTeam).toBeGreaterThanOrEqual(0)
    expect(iSalary).toBeLessThan(iTeam)
  })
})

describe('StatusBar — no "Xpp via EVPI" chip', () => {
  const BASE = {
    factorsToVerify: 2,
    fragileEdgeCount: 0,
    contestedCount: 3,
    recommendationStability: 0.71,
    hasAnalysisData: true,
  }

  it('POSITIVE CONTROL: the bar still renders its other post-analysis segments', () => {
    render(<StatusBar {...BASE} />)
    const text = screen.getByTestId('model-status-bar').textContent ?? ''
    expect(text).toContain('contested')
    expect(text).toContain('stability')
  })

  it('never sums percentage points into a headline figure', () => {
    render(
      <StatusBar
        {...withRemovedProp(BASE, {
          evpiMap: new Map([['a', 12.3], ['b', 10.2], ['c', 6.6]]),
        })}
      />,
    )
    const bar = screen.getByTestId('model-status-bar')
    const text = bar.textContent ?? ''
    expect(text).not.toMatch(/via EVPI/i)
    expect(text).not.toMatch(PP_TOKEN)
    // 12.3 + 10.2 + 6.6 = 29.1 → the old chip read "29pp via EVPI".
    expect(text).not.toContain('29')
    expect(within(bar).queryByTestId('status-evpi')).toBeNull()
  })
})

describe('compare-tab Hero — no pp claim, and the CTA still targets a factor', () => {
  function snapshot(): AnalysisSnapshot {
    return {
      runId: 'r1',
      runNumber: 2,
      timestamp: '2026-07-25T00:00:00Z',
      graphHash: 'h',
      nodeCount: 4,
      edgeCount: 3,
      winnerId: 'opt_a',
      winnerLabel: 'Option A',
      winnerProbability: 62,
      runnerUpId: 'opt_b',
      runnerUpLabel: 'Option B',
      runnerUpProbability: 35,
      recommendationStability: 0.8,
      stabilityLabel: 'stable',
      fragileEdgeCount: 0,
      evidenceCoverage: '3/5',
      topFactors: [],
      influenceConcentration: 40,
      topCalibrationFactor: 'Existing Team Experience Level',
      topCalibrationFactorId: 'fac_team_experience',
      topElasticity: 67,
      rankFlipRate: 0.1,
      goalProbability: null,
      jointGoalProbability: null,
      inferenceWarnings: [],
      conditionalWinners: [],
      edgeEValues: [],
      seedUsed: 991555,
      responseHash: 'abc',
      editSummary: '',
    } as unknown as AnalysisSnapshot
  }

  it('POSITIVE CONTROL: the improving hero renders its CTA and its influence figure', () => {
    const s = snapshot()
    const { container } = render(<Hero state="improving" snapshots={[s, s]} showExpert={false} onRunAnalysis={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Existing Team Experience Level')
    expect(text).toContain('67% influence')
  })

  it('states influence without asserting a percentage-point value for resolving it', () => {
    const s = snapshot()
    const { container } = render(<Hero state="improving" snapshots={[s, s]} showExpert={false} onRunAnalysis={() => {}} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/resolving could improve confidence/i)
    expect(text).not.toMatch(PP_TOKEN)
  })
})
