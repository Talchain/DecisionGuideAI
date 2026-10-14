/**
 * ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM on the ANALYSIS HERO — CURRENT-READ-v1 row 9 (AIQ #75 5912710392),
 * replayed on Paul's served Run 4276f3f9 (`../../__tests__/helpers/paulRun4276f3f9.ts`).
 *
 * The hero is built by `buildHeroModel` from the product hook's return (`useResultsSectionData`), exactly as
 * `useAnalysisHero` builds it. The gate is read ONCE, in the hook, through `canvas/state/winShareGate`
 * (`data.winSharesWithheld` / `data.winShareWithheldReason`); `buildHeroModel` honours it for every row's
 * `detail.winChance` (the line `HeroOptionRow` renders as `hero-detail-win` / `hero-win-meta`) and for the
 * `comparativeReadout` the leader headline would quote. The panel says why ONCE, in its existing
 * "why no leader was named" slot.
 *
 * Lives in the hero's own directory: `inertness.spec.ts` forbids importing the hero from anywhere else.
 *
 * AIQ's three rows:
 *   1. 4276f3f9 → no row carries a win share; the exploratory reason line once;
 *   2. CONTROL: `{permitted: true}` keeps each row's share (Convertible bridge "80%");
 *   3. CONTROL: `separation_unavailable` hides them too, in that cause's own words.
 *
 * #2747 re-scope 2 (DL ruling (A)): no win share is said on the Results hero in C, PERMITTED or not; `detail.winChance`,
 * `hero-detail-win` and `hero-win-meta` are gone and `comparativeReadout` is always null. Row 2 now pins that absence.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { HeroOptionRow } from '../HeroOptionRow'
import type { HeroChartModel } from '../heroTypes'
import { leaderWithholdCause } from '../../analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE } from '../../../../canvas/state/winShareGate'
import {
  CONVERTIBLE, OTHER_CAUSE_STAMP, PERMITTED_STAMP, SCORED, SERVED_STAMP, resetPaulRun, seedPaulRun,
} from '../../__tests__/helpers/paulRun4276f3f9'

const PANEL_PROPS = { rerunDisabled: false, focusPanelMounted: false } as const
const OTHER_CAUSE_WORDS = leaderWithholdCause('separation_unavailable')

function heroModel(): HeroChartModel {
  const data = renderHook(() => useResultsSectionData()).result.current
  const model = buildHeroModel(data)
  expect(model.kind, 'precondition: the served Run builds a chart').toBe('chart')
  return model as HeroChartModel
}

/** Each scored row, OPENED, through the real row component: what a person sees when they expand it. */
function renderOpenedRows(model: HeroChartModel) {
  for (const row of model.rows.filter((r) => SCORED.some((o) => o.id === r.id))) {
    render(
      <HeroOptionRow
        row={row} lens="outcome" isLeader={false} isOpen onToggle={() => {}}
        outcomeDomain={null} showOrdinal={false}
      />,
    )
  }
}

afterEach(() => {
  cleanup()
  resetPaulRun()
})

describe('CURRENT-READ row 9 — the hero rows (buildHeroModel → HeroOptionRow)', () => {
  it('⭐ ROW 1 (Paul\'s 4276f3f9): no row carries a win share; the panel says the exploratory reason once', () => {
    seedPaulRun(SERVED_STAMP)
    const model = heroModel()
    for (const o of SCORED) {
      const row = model.rows.find((r) => r.id === o.id)!
      expect(row, `row for ${o.label}`).toBeTruthy()
      // #2747 re-scope 2 (DL ruling (A)): `winChance` left the row detail type; the negative is kept by key.
      expect(row.detail).not.toHaveProperty('winChance')
      expect(row.comparativeReadout ?? null).toBeNull()
    }
    expect(model.designationWithheldReason).toBe(EXPLORATORY_REASON_LINE)

    renderOpenedRows(model)
    expect(screen.queryAllByTestId('hero-detail-win')).toHaveLength(0)
    expect(screen.queryAllByTestId('hero-win-meta')).toHaveLength(0)
    cleanup()

    const { container } = render(<AnalysisHeroPanel model={model} {...PANEL_PROPS} />)
    expect(screen.getByTestId('hero-designation-withheld-reason').textContent).toBe(EXPLORATORY_REASON_LINE)
    expect((container.textContent ?? '').split(EXPLORATORY_REASON_LINE).length - 1).toBe(1)
    expect(container.textContent).not.toMatch(/supported in \d/i)
  })

  // #2747 re-scope 2 (DL ruling (A)): no win share on the hero in C, even on a PERMITTED Run (was: Convertible bridge's
  // "80%" kept, in the opened detail or as persistent meta). The share is still in the data (control); it is not said.
  it('⭐ ROW 2 — CONTROL: a PERMITTED Run says no share either (Convertible bridge 80% not said) and no reason line', () => {
    seedPaulRun(PERMITTED_STAMP)
    const data = renderHook(() => useResultsSectionData()).result.current
    expect(data.winSharesWithheld).toBe(false)
    expect(data.recommendation.allOptions.find((o) => o.id === CONVERTIBLE)?.winProbability).toBeCloseTo(0.7966, 4) // shown as 80% before C
    const model = heroModel()
    const convertible = model.rows.find((r) => r.id === CONVERTIBLE)!
    expect(convertible.comparativeReadout).toBeNull()
    expect(convertible.detail).not.toHaveProperty('winChance')
    expect(model.rows.map((r) => r.comparativeReadout ?? null).filter((v) => v !== null)).toEqual([])
    expect(model.designationWithheldReason).not.toBe(EXPLORATORY_REASON_LINE)

    renderOpenedRows(model)
    expect(screen.queryAllByTestId('hero-detail-win')).toHaveLength(0)
    expect(screen.queryAllByTestId('hero-win-meta')).toHaveLength(0)
    expect(document.body.textContent).not.toMatch(/supported in \d/i)
    expect(document.body.textContent).not.toContain('80%')
  })

  it('⭐ ROW 3 — CONTROL: a Run withheld for ANOTHER reason hides every share too, in that reason\'s own words', () => {
    seedPaulRun(OTHER_CAUSE_STAMP)
    const model = heroModel()
    for (const o of SCORED) {
      const row = model.rows.find((r) => r.id === o.id)!
      // #2747 re-scope 2 (DL ruling (A)): `winChance` left the row detail type; the negative is kept by key.
      expect(row.detail).not.toHaveProperty('winChance')
      expect(row.comparativeReadout ?? null).toBeNull()
    }
    expect(OTHER_CAUSE_WORDS).not.toBeNull()
    expect(model.designationWithheldReason).toBe(OTHER_CAUSE_WORDS)
  })
})
