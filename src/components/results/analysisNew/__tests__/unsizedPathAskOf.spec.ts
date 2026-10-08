/**
 * D3 (DL 0df0e1, 6 Oct): `unsizedPathAskOf` reads the withhold's `first_ask` (CEE #2635) by kind, under the same gate as
 * the withhold's line (`goal_path_unsized`, or `separation_unavailable` echoing it). It never picks a link itself.
 */
import { describe, expect, it } from 'vitest'
import { unsizedPathAskOf } from '../analysisNewCopy'

const LABELS: Record<string, string> = { a: 'Starter support burden', b: 'Revenue', p: 'Pro plan price', s: 'Strain', g: 'MRR' }
const labelOf = (id: string) => LABELS[id] ?? null
const warning = (first_ask?: unknown) => [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', message: 'm',
  node_ids: ['s', 'g'], links: [{ from: 's', to: 'g' }, { from: 'a', to: 'b' }], ...(first_ask !== undefined ? { first_ask } : {}) }]

describe('unsizedPathAskOf', () => {
  it('reads each kind by identity — never links[0] (here s → g)', () => {
    expect(unsizedPathAskOf('goal_path_unsized', warning({ kind: 'link', from: 'a', to: 'b' }), labelOf))
      .toEqual({ kind: 'link', fromId: 'a', toId: 'b', from: 'Starter support burden', to: 'Revenue' })
    expect(unsizedPathAskOf('goal_path_unsized', warning({ kind: 'gauge', from: 'p', through: 's', to: 'g' }), labelOf))
      .toMatchObject({ kind: 'gauge', fromId: 'p', throughId: 's', toId: 'g' })
    expect(unsizedPathAskOf('goal_path_unsized', warning({ kind: 'goal_level', node_id: 'g' }), labelOf))
      .toEqual({ kind: 'goal_level', nodeId: 'g', goal: 'MRR' })
  })

  it('the gate: another reason → undefined (no withhold); separation_unavailable only when it echoes the warning', () => {
    expect(unsizedPathAskOf('constraint_verdict_withheld', warning({ kind: 'link', from: 'a', to: 'b' }), labelOf)).toBeUndefined()
    expect(unsizedPathAskOf('separation_unavailable', warning({ kind: 'link', from: 'a', to: 'b' }), labelOf)?.kind).toBe('link')
    expect(unsizedPathAskOf('separation_unavailable', [], labelOf)).toBeUndefined()
  })

  it('a withhold whose TYPED ask cannot be read → null: an unlabelled end, an unknown kind (never a substitute)', () => {
    expect(unsizedPathAskOf('goal_path_unsized', warning({ kind: 'link', from: 'a', to: 'zz' }), labelOf)).toBeNull()
    expect(unsizedPathAskOf('goal_path_unsized', warning({ kind: 'riddle' }), labelOf)).toBeNull()
  })

  // ⭐ RE-PINNED (DL #87, 6 Oct, RT-19 fx1): "no first_ask (older CEE) → null" emptied the panel ("No findings need
  // attention") while the chat said "Set them". With NO typed ask, the withhold's own first link is NAMED (CEE's list).
  it('NO typed ask (absent, or null on the wire): the withhold\'s own first link, named, with how many more', () => {
    expect(unsizedPathAskOf('goal_path_unsized', warning(), labelOf))
      .toEqual({ kind: 'withheld_link', fromId: 's', toId: 'g', from: 'Strain', to: 'MRR', more: 1 })
    expect(unsizedPathAskOf('goal_path_unsized', warning(null), labelOf)?.kind).toBe('withheld_link')
    expect(unsizedPathAskOf('goal_path_unsized', [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', links: [] }], labelOf), 'names none → null').toBeNull()
  })
})
