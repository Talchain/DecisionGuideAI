import { describe, expect, it } from 'vitest'
import { parseCanonicalAnalysisView, type CanonicalAnalysisView } from '../canonicalAnalysisView'
import { runViewOf } from '../runView'
import read from './fixtures/capacity-view-only-read.json'

// The capacity board's served READ: `canonical_analysis_view` and no `analysis_result`. Served with no Run identity.
const ctx = { goalChanceHeroSays: true, labelOf: () => null }
const parsed = (body: unknown): CanonicalAnalysisView => {
  const view = parseCanonicalAnalysisView(body)
  expect(view).not.toBeNull()
  return view!
}
const served = read.canonical_analysis_view
const boundRun = { run_id: 'run-capacity-1', graph_hash_at_run: read.graph_hash, computed_at: '2026-10-23T08:00:00Z' }
const currentStaleness = { ...served.staleness, stale: false, limitation: 'Hash equality cannot detect brief, framing or stage changes.' }
const KEEP_FACE = '‘Keep current staffing’: less than 1% chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread and ‘Additional capacity with no additional specialists’ follows Olumi’s assumed relationship.'
const ADD_FACE = '‘Add one specialist’: about 50% chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now, in this model, if ‘Weekly capacity per additional specialist’ follows Olumi’s provisional conversion of your range, 10 ticket / week / specialist to 30 ticket / week / specialist, into a bell-shaped spread and ‘Additional capacity with no additional specialists’ follows Olumi’s assumed relationship.'
const CHANCE_WORDS = 'chance of ‘Total weekly support capacity’ being at least 100 ticket / week at 1 week from now'

describe('runViewOf: a held canonical view with no report (view-only board read)', () => {
  it('row 1: a bound, current view renders each option’s served cell and the goal_chance headline', () => {
    const view = runViewOf(null, parsed({ ...served, run: boundRun, staleness: currentStaleness }))
    expect(view.boundToCurrentCanonical()).toBe(true)
    expect(view.servedCellOf('keep_current_staffing')).toEqual({ kind: 'figure', display: 'less than 1%', face: KEEP_FACE })
    expect(view.servedCellOf('add_one_specialist')).toEqual({ kind: 'figure', display: 'about 50%', face: ADD_FACE })
    expect(view.chanceCellOf('keep_current_staffing', ctx)).toEqual({ kind: 'figure', text: KEEP_FACE })
    expect(view.chanceCellOf('add_one_specialist', ctx)).toEqual({ kind: 'figure', text: ADD_FACE })
    expect(view.goalChanceDetail()?.chance_words).toBe(CHANCE_WORDS)
    // No licence without a report: the numeric gate stays shut; the cell is CEE's words only.
    expect(view.chanceFigureOf('add_one_specialist')).toBeNull()
  })

  it('row 2a: the served view (no Run identity, currentness unknown) binds to nothing, never current', () => {
    const view = runViewOf(null, parsed(served))
    expect(served.run).toBeNull()
    expect(view.boundToCurrentCanonical()).toBe(false)
    expect(view.servedCellOf('add_one_specialist')).toBeNull()
    expect(view.chanceCellOf('add_one_specialist', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.goalChanceDetail()).toBeNull()
  })

  it.each([
    ['no run id', { ...boundRun, run_id: null }],
    ['no graph hash', { ...boundRun, graph_hash_at_run: null }],
  ])('row 2b: a Run with %s binds to nothing, even where CEE says stale: false', (_label, run) => {
    const view = runViewOf(null, parsed({ ...served, run, staleness: currentStaleness }))
    expect(view.boundToCurrentCanonical()).toBe(false)
    expect(view.servedCellOf('keep_current_staffing')).toBeNull()
    expect(view.chanceCellOf('keep_current_staffing', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.goalChanceDetail()).toBeNull()
  })

  it('row 2c: a bound Run that no longer matches the selected graph (stale) says CEE’s stale face, never the figure', () => {
    const view = runViewOf(null, parsed({ ...served, run: boundRun,
      staleness: { ...currentStaleness, stale: true, reason: 'graph_changed' },
      face_when_stale: 'These results are from an earlier version of the model. Run the analysis again.' }))
    expect(view.boundToCurrentCanonical()).toBe(false)
    expect(view.chancesNotCurrent()).toBe(true)
    expect(view.servedCellOf('add_one_specialist')).toBeNull()
    expect(view.chanceCellOf('add_one_specialist', ctx)).toEqual({ kind: 'withheld',
      text: 'These results are from an earlier version of the model. Run the analysis again.' })
    expect(view.goalChanceDetail()).toBeNull()
  })

  it('row 3: no view and no report stays the empty view', () => {
    const view = runViewOf(null, null)
    expect(view.boundToCurrentCanonical()).toBe(false)
    expect(view.servedCellOf('add_one_specialist')).toBeNull()
    expect(view.chanceCellOf('add_one_specialist', ctx)).toEqual({ kind: 'none', text: null })
    expect(view.goalChanceDetail()).toBeNull()
  })
})
