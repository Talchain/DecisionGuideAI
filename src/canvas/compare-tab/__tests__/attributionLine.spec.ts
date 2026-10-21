/**
 * "Which edit moved which chance" (DL lease and wording, 21 Oct 2026): only where CEE says the pair is attributable (C1)
 * and its input record is complete; the changes in the rows' own words, the movement in the gate's words, and several
 * changes never pinned on one. Bound by option id and by the producer's fields (attribution_case, input_coverage).
 */
import { describe, expect, it } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { inputRowSentence } from '../../../components/results/analysisNew/sections/WhatsChanged'
import type { PairChanceFigures } from '../../runView/runView'
import { attributionLine } from '../attributionLine'
import { runChangeDelta } from './__fixtures__/runChangeArtefact'

const LABELS = new Map([['option_a', 'Option A (a referral programme)'], ['option_b', 'Option B (a price cut)']])
const NODES = new Map([['option_b__on', 'Option B (a price cut) in place'], ['option_a__on', 'Option A (a referral programme) in place'],
  ['goal', 'Weekly orders']])
const effect = (from: string, before: number, after: number) => ({
  entity_kind: 'link', entity_id: `${from}->goal`, link: { from, to: 'goal' }, field: 'effect',
  before: { raw: before, unit: 'orders a week', per: { amount: 1, unit: 'switch' } },
  after: { raw: after, unit: 'orders a week', per: { amount: 1, unit: 'switch' } }, change: 'changed',
})
const C1 = { attribution_case: 'C1_attributable', pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true } }
const viewOf = (o: Partial<RunDelta>) =>
  buildRunDeltaView(runChangeDelta(o), id => LABELS.get(id) ?? null, id => NODES.get(id) ?? null)
const point = (words: string, n: number) => ({ kind: 'point' as const, words, scaleAt: n })
const chances = (rows: PairChanceFigures['rows']): PairChanceFigures => ({ rows, claim: null, chanceWords: null, notCurrent: false })
const BOTH = chances([
  { optionId: 'option_a', label: 'Option A (a referral programme)', earlier: point('about 78%', 78), now: point('about 78%', 78) },
  { optionId: 'option_b', label: 'Option B (a price cut)', earlier: point('about 61%', 61), now: point('about 50%', 50) },
])

describe('attributionLine — which recorded change moved which chance', () => {
  it("C1 + complete + one change → the ruled sentence; only the option whose words moved is named (contrast: A's 78% stays out)", () => {
    const view = viewOf({ ...C1, input_coverage: 'complete', input_changes: [effect('option_b__on', 35, 30)] } as never)
    const line = attributionLine(view, BOTH)
    const change = inputRowSentence(view.inputs!.rows[0])
    expect(line?.text).toBe(`Changed since the earlier run: ${change}. With that change, Option B (a price cut)'s chance of meeting your goal in this model moved from about 61% to about 50%.`)
    expect(change).toContain('35')
    expect(change).toContain('30')
    expect(line?.text).not.toMatch(/Option A|78%|best|winner|recommend|because|caused/i)
  })

  it('several recorded changes → listed, and the movement "with those changes", never pinned on one change', () => {
    const view = viewOf({ ...C1, input_coverage: 'complete', input_changes: [effect('option_b__on', 35, 30), effect('option_a__on', 40, 50)] } as never)
    const moved = chances([
      { optionId: 'option_a', label: 'Option A (a referral programme)', earlier: point('about 69%', 69), now: point('about 78%', 78) },
      { optionId: 'option_b', label: 'Option B (a price cut)', earlier: point('about 61%', 61), now: point('about 50%', 50) },
    ])
    const line = attributionLine(view, moved)!
    expect(line.changes).toHaveLength(2)
    expect(line.text).toContain('With those changes, the chances of meeting your goal in this model moved: Option A (a referral programme) from about 69% to about 78%; Option B (a price cut) from about 61% to about 50%.')
    expect(line.text).not.toMatch(/With that change/)
  })

  it.each([
    ['C2_unpaired (not attributable)', { attribution_case: 'C2_unpaired', input_coverage: 'complete' }],
    ['C3_engine_drift (not attributable)', { attribution_case: 'C3_engine_drift', pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'unequal', n_equal: true }, input_coverage: 'complete' }],
    ['C1 but partial coverage (the rows may not be all that changed)', { ...C1, input_coverage: 'partial' }],
  ])('%s → no line, today\'s lines stand (contrast: the C1 + complete case above)', (_, o) => {
    const view = viewOf({ ...o, input_changes: [effect('option_b__on', 35, 30)] } as never)
    expect(attributionLine(view, BOTH)).toBeNull()
  })

  it('C1 + complete but no recorded change, no option moved, an unnamed mover, or a run that is not current → no line', () => {
    expect(attributionLine(viewOf({ ...C1, input_coverage: 'complete', input_changes: [] } as never), BOTH)).toBeNull()
    const view = viewOf({ ...C1, input_coverage: 'complete', input_changes: [effect('option_b__on', 35, 30)] } as never)
    expect(attributionLine(view, chances([BOTH.rows[0]]))).toBeNull()
    expect(attributionLine(view, chances([{ ...BOTH.rows[1], label: null }]))).toBeNull()
    expect(attributionLine(view, { ...BOTH, notCurrent: true })).toBeNull()
    expect(attributionLine(view, null)).toBeNull()
  })
})
