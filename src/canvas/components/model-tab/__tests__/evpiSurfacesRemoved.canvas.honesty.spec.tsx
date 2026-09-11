/**
 * EVPI display surfaces — REMOVED (canvas side).
 *
 * Companion to `src/components/results/__tests__/evpiSurfacesRemoved.honesty.spec.tsx`.
 * See that file's header for the live measurement that refutes the number.
 *
 * Covers the canvas surfaces the original brief did not name:
 *   · compare-tab Hero  — "resolving could improve confidence by {X}pp"
 *
 * ⚠⚠ NARROWED 2026-09-11 — THE SUBJECTS WERE DELETED, THE RULE WAS NOT RELAXED.
 * This file also pinned three surfaces that no longer exist in any form:
 *   · FactorsSection    — the "Worth Xpp if resolved" chip AND the `EVPI  Xpp` row
 *   · FactorsSection    — the factor-list ORDER, which was EVPI-ranked
 *   · StatusBar         — the `"{X}pp via EVPI"` chip (a SUM of three refuted numbers)
 * `FactorsSection.tsx` and `StatusBar.tsx` were removed with the v1 Model stack
 * (Paul's ruling, 2026-09-11): they sat inside `ModelTabBody`'s
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate and had no other importer. Their
 * cases are gone because the components are gone — a test of a deleted module
 * cannot run, and keeping a stub would be a guard agreeing with itself.
 *
 * ⭐ THE RECORD IS KEPT DELIBERATELY (trap 14b). The figures those cases pinned
 * were REAL: they are what the product once rendered, and the refutation that
 * removed them stands. If an EVPI percentage-point claim is ever reintroduced on
 * a canvas surface, it must come back through a NEW component, and this header
 * is the reason someone will know it was refused once already. The live
 * `compare-tab Hero` case below is unchanged and still pins the same rule.
 *
 * The order and label cases matter because #477 — the commit immediately
 * preceding this one — exists to close "the NON-TEXT channels — order, bar,
 * stroke — that still spoke the default". An EVPI-ordered list under a visible
 * `ranked by EVPI` label reopens that exact class.
 *
 * CLAIM TYPE: rendered text / DOM presence / rendered ORDER within jsdom.
 * NOT a visibility claim.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
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

describe('compare-tab Hero — no pp claim, and the CTA still targets a factor', () => {
  function snapshot(): AnalysisSnapshot {
    return {
      runId: 'r1',
      runNumber: 2,
      timestamp: '2026-07-25T00:00:00Z',
      graphHash: 'h',
      nodeCount: 4,
      edgeCount: 3,
      // ROADMAP 2.835 — the compare Hero names its leader from `leaderVerdict`
      // resolved against `options`; the argmax fields it used to read are gone.
      // Same option, same 62%, stated the way the surface reads it.
      winnerId: 'opt_a',
      options: [
        { id: 'opt_a', label: 'Option A', winProbability: 62 },
        { id: 'opt_b', label: 'Option B', winProbability: 35 },
      ],
      leaderVerdict: {
        leaderId: 'opt_a', separation: 'clear', hasLeadingOption: true,
        gapPp: 27, source: 'producer_near_tie',
      },
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
