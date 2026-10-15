/**
 * ⭐ DL (15 Oct, capacity e2e judge item 8): CEE's chance sentence is said ONCE on Results.
 *
 * Served (capacity e2e 2026-10-15T053349Z, UI 2c43f563 · CEE c1e944a4, `capacity/06-run-results.json`): the goal-lens
 * hero row for ‘Add one specialist’ and the range line under the hero BOTH printed the same full sentence below. The row
 * keeps it; the line keeps only the action, as a compact reference to that row. On a lens where the row does not say the
 * sentence, or with no hero row for the option, the line still says it verbatim (nothing is lost).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { GoalChanceRangeLines } from '../GoalChanceRangeLines'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { GALLERY_ENTRIES } from '../fixtures/galleryModels'
import { heroRowSaysFace } from '../AnalysisHeroContainer'
import type { HeroChartModel } from '../heroTypes'

vi.mock('../../../../canvas/utils/focusHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../canvas/utils/focusHelpers')>()),
  focusEdgeById: vi.fn(), focusNodeById: vi.fn(), focusEdgeByEndpoints: vi.fn(), focusByTarget: vi.fn(),
}))

const SERVED_FACE = '‘Add one specialist’: between about 54% and 59% chance of meeting your goal, in this model, using Olumi\'s estimates for 3 relationships (see Check estimates).'
const OPT = 'opt_add_specialist'
const range = (kind: 'link_existence' | 'stated_time') => readGoalChanceRange([{
  code: 'GOAL_CHANCE_RANGE', severity: 'info', message: 'range', option_ids: [OPT],
  range_by_option: { [OPT]: kind === 'stated_time'
    ? { low_pct: 54, high_pct: 59, low_rounding: 'whole', high_rounding: 'whole', kind, basis: 'stated_time', quantity: 'q' }
    : { low_pct: 54, high_pct: 59, low_rounding: 'whole', high_rounding: 'whole', kind, from: 'f1', to: 'g1', among: 'all' } },
}])
const faceOf = (id: string) => (id === OPT ? SERVED_FACE : null)

describe('the chance sentence is said once', () => {
  it('the hero row says it → the line keeps only the action, naming the row’s option; the sentence is not repeated', () => {
    render(<GoalChanceRangeLines range={range('link_existence')} faceOf={faceOf}
      heroSaidLabelOf={(id, face) => (id === OPT && face === SERVED_FACE ? 'Add one specialist' : null)} />)
    const line = screen.getByTestId('goal-chance-range-line')
    expect(line.getAttribute('data-said-in-hero')).toBe('true')
    expect(line.textContent).not.toContain('chance of meeting your goal')
    expect(line.textContent).toContain('‘Add one specialist’:')
    expect(line.textContent).toContain('Confirm or remove it to see where it lands')
  })

  it('CONTROL: no row says it (another lens, or no hero) → the line says CEE’s sentence verbatim, as before', () => {
    render(<GoalChanceRangeLines range={range('link_existence')} faceOf={faceOf} heroSaidLabelOf={() => null} />)
    const line = screen.getByTestId('goal-chance-range-line')
    expect(line.getAttribute('data-said-in-hero')).toBeNull()
    expect(line.textContent).toContain(SERVED_FACE)
  })

  it('a stated-time range has no action, so when the row says the sentence the line is not drawn at all', () => {
    const { container } = render(<GoalChanceRangeLines range={range('stated_time')} faceOf={faceOf}
      heroSaidLabelOf={() => 'Add one specialist'} />)
    expect(container.querySelector('[data-testid="goal-chance-range-line"]')).toBeNull()
  })

  it('the container\u2019s test: only the GOAL lens, only the option\u2019s OWN row, only the EXACT sentence', () => {
    const base = GALLERY_ENTRIES.find((e) => e.id === 'full-prototype')!.model as HeroChartModel
    const row = base.rows[0]!
    const model: HeroChartModel = { ...base, defaultLens: 'goal', rows: [{ ...row, goal: { ...row.goal, readout: SERVED_FACE } }, ...base.rows.slice(1)] }
    expect(heroRowSaysFace(model, null, row.id, SERVED_FACE)).toBe(row.label)
    expect(heroRowSaysFace(model, 'goal', row.id, SERVED_FACE)).toBe(row.label)
    expect(heroRowSaysFace(model, 'outcome', row.id, SERVED_FACE)).toBeNull()
    expect(heroRowSaysFace(model, 'goal', row.id, SERVED_FACE + ' ')).toBeNull()
    expect(heroRowSaysFace(model, 'goal', 'another-option', SERVED_FACE)).toBeNull()
    expect(heroRowSaysFace({ kind: 'empty' } as never, 'goal', row.id, SERVED_FACE)).toBeNull()
  })

  it('the panel reports the lens on screen: its default first, then the one the user picks', () => {
    const entry = GALLERY_ENTRIES.find((e) => e.id === 'full-prototype')!
    const seen = vi.fn()
    render(<AnalysisHeroPanel model={entry.model} rerunDisabled={false} onLensChange={seen} />)
    expect(seen).toHaveBeenLastCalledWith('goal')
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(seen).toHaveBeenLastCalledWith('outcome')
  })
})
