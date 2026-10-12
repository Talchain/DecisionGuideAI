/**
 * RunView PR 1: the Run's per-option lines, worded from the Run's one view, are byte-identical to the lines worded from
 * the licence read directly (C3 captured record, scenario 23b1495c, CEE 2334956288d3a87eaece7a5ab3d948b20a5f9dfb).
 * #2747 re-scope: the view quotes a figure only through the chance authority gate, so the Run is held with its matching,
 * current canonical view (whose cells license both figures); without it, the view quotes none.
 */
import { describe, expect, it } from 'vitest'
import { runViewOf } from '../../../../canvas/runView/runView'
import { parseCanonicalAnalysisView } from '../../../../canvas/runView/canonicalAnalysisView'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'

const C3 = {
  code: 'GOAL_CHANCE_LICENSED', form: 'each', severity: 'info', message: 'licensed',
  target: { unit: '£/month', value: 20000, comparator: 'at_least' },
  option_ids: ['keep_pro_at_49', 'raise_pro_to_59'], pct_by_option: { keep_pro_at_49: 0, raise_pro_to_59: 0 },
}
const LABELS: Record<string, string> = { keep_pro_at_49: 'Keep Pro at £49', raise_pro_to_59: 'Raise Pro to £59' }
const labelOf = (id: string) => LABELS[id] ?? null
const REPORT = { run_id: 'run-c3', inference_warnings: [C3] }
const CANONICAL = parseCanonicalAnalysisView({
  schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld',
  run: { run_id: 'run-c3', graph_hash_at_run: null, computed_at: null },
  staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
    limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
  options: C3.option_ids.map(option_id => ({ option_id, cell: { kind: 'figure', display: 'less than 1%' }, main_driver: { kind: 'not_recorded' } })),
})

describe('RunView parity with the direct licence read', () => {
  // #2747 re-scope 2 round 2 (rule C): was "C3: the option lines are byte-identical, and the view's figure words are the
  // lines' figure words"; the lines (`goalChanceOptionLines`) are deleted, so the parity is now the licence itself, and the
  // view's figure words are CEE's served display, verbatim.
  it('C3: the view\'s licence equals the direct read, and its figure words are CEE\'s served display', () => {
    const view = runViewOf(REPORT, CANONICAL)
    expect(view.goalChance).toEqual(readGoalChanceLicence([C3]))
    for (const id of C3.option_ids) {
      const chance = view.chanceOf(id)
      expect(chance.kind).toBe('figure')
      expect(chance.kind === 'figure' ? chance.words : null).toBe('less than 1%')
      expect(labelOf(id)).not.toBeNull()
    }
  })

  it('CONTRAST (the gate): the same Run with no canonical view quotes no figure', () => {
    const view = runViewOf({ ...REPORT })
    for (const id of C3.option_ids) expect(view.chanceOf(id)).toEqual({ kind: 'none' })
  })
})
