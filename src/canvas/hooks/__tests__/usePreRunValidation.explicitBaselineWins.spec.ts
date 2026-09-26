/**
 * A12 — an explicit `is_baseline` from the producer must win over the label
 * regex. The regex was firing unconditionally on every one of these six
 * predicates, so a producer option carrying `is_baseline: false` — "Keep £49
 * with release", "Continue Current Staffing" — was silently exempted from
 * the intervention requirement, the same way a genuine baseline is: the
 * option's own (empty) change set never surfaced as something to fix.
 *
 * `is_baseline: true` is unaffected — the regex already agreed with it, so
 * there is nothing to discriminate there; every case below turns on the
 * regex being WRONG and the explicit flag correcting it.
 */

import { describe, it, expect, vi } from 'vitest'
import { validateBeforeRun } from '../usePreRunValidation'
import type { Node } from '@xyflow/react'
import type { CEEAnalysisReady, CEEOptionV3 } from '../../../adapters/cee/types'

vi.stubGlobal('import', { meta: { env: { DEV: false } } })

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: `Node ${id}`, kind: type, ...data },
  }
}

const NODES: Node[] = [
  makeNode('factor_price', 'factor'),
  makeNode('goal_revenue', 'goal'),
  makeNode('opt_keep', 'option', { label: 'Keep £49 with release' }),
]

function ceeReady(option: Partial<CEEOptionV3> & { id: string; label: string }): CEEAnalysisReady {
  return {
    options: [
      {
        status: 'ready',
        interventions: {},
        ...option,
      },
    ],
    goal_node_id: 'goal_revenue',
  }
}

describe('usePreRunValidation — A12: explicit is_baseline wins over the label regex', () => {
  it('POSITIVE CONTROL: the label really does match the regex on its own', () => {
    // "Keep £49 with release" (and "Continue Current Staffing") both contain
    // BASELINE_KEYWORDS entries ("keep" / "continue") — the regex misfires on
    // real, non-baseline option labels the audit measured.
    const result = validateBeforeRun(
      'goal_revenue',
      NODES,
      [],
      ceeReady({ id: 'opt_keep', label: 'Keep £49 with release' }),
    )
    expect(result.blockers.some((b) => b.code === 'EMPTY_INTERVENTIONS')).toBe(false)
  })

  it('RED/A12: is_baseline:false is NOT dropped — an empty-intervention option the regex misreads still gets EMPTY_INTERVENTIONS', () => {
    const result = validateBeforeRun(
      'goal_revenue',
      NODES,
      [],
      ceeReady({ id: 'opt_keep', label: 'Keep £49 with release', is_baseline: false }),
    )
    const emptyBlockers = result.blockers.filter((b) => b.code === 'EMPTY_INTERVENTIONS')
    expect(emptyBlockers).toHaveLength(1)
    expect(emptyBlockers[0].affectedIds).toContain('opt_keep')
  })

  it('a genuine is_baseline:true option stays exempt (unaffected by the fix)', () => {
    const result = validateBeforeRun(
      'goal_revenue',
      NODES,
      [],
      ceeReady({ id: 'opt_keep', label: 'Keep £49 with release', is_baseline: true }),
    )
    expect(result.blockers.some((b) => b.code === 'EMPTY_INTERVENTIONS')).toBe(false)
  })

  it('an omitted is_baseline still falls back to the regex, exactly as before', () => {
    const result = validateBeforeRun(
      'goal_revenue',
      NODES,
      [],
      ceeReady({ id: 'opt_keep', label: 'Keep £49 with release' }),
    )
    expect(result.blockers.some((b) => b.code === 'EMPTY_INTERVENTIONS')).toBe(false)
  })

  it('RED/A12: the same discrimination holds for the legacy canvas-node fallback path (no CEE data)', () => {
    const nodes: Node[] = [
      makeNode('factor_price', 'factor'),
      makeNode('goal_revenue', 'goal'),
      makeNode('opt_staffing', 'option', {
        label: 'Continue Current Staffing',
        is_baseline: false,
      }),
    ]
    const result = validateBeforeRun('goal_revenue', nodes, [], null)
    const mappingBlockers = result.blockers.filter((b) => b.code === 'OPTIONS_NEED_MAPPING')
    expect(mappingBlockers).toHaveLength(1)
    expect(mappingBlockers[0].affectedIds).toContain('opt_staffing')
  })
})
