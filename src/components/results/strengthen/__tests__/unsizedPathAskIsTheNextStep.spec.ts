/**
 * ⭐ D3 (DL 0df0e1, 6 Oct; Acceptance G1 draft 6, UI 857a0da8 / CEE 231affbe; Integrator 37): when the Run withheld its
 * leader for an unsized path to the goal, the panel's next step IS what that withhold asks first (CEE `first_ask`, read by
 * identity), never an input the panel picks itself. Draft 6's shape: the withhold names "starter support burden →
 * revenue" while CEE's awaited set holds a different factor ("Price-driven customer losses").
 */
import { describe, expect, it } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import type { StrengthenInputs, UnsizedPathAsk } from '../strengthenTypes'

const FACTORS = [
  { factorId: 'price_losses', label: 'Price-driven customer losses', influence: 0.8,
    confidenceDisplay: { show: false, hiddenReason: 'no_display_safe_source' }, canFocus: true },
  { factorId: 'tier_price', label: 'Starter tier price', influence: 0.3,
    confidenceDisplay: { show: false, hiddenReason: 'no_display_safe_source' }, canFocus: true },
]
/** Draft 6: a completed, withheld Run whose awaited set names a DIFFERENT factor than the withhold's link. */
const draft6 = (unsizedPathAsk?: UnsizedPathAsk | null): StrengthenInputs => ({
  analysisComplete: true, hasStatedGoalTarget: true, hasLeadingOption: false, robustness: { status: 'computed', level: 'moderate' },
  fragileEdges: [], flipThresholds: null, factors: FACTORS, biasFindingTypes: [], phase3Items: [],
  materialParametersAwaitingUserIds: ['price_losses'], analysisIdentityIsCurrent: true,
  ...(unsizedPathAsk !== undefined ? { unsizedPathAsk } : {}),
}) as unknown as StrengthenInputs
const LINK: UnsizedPathAsk = { kind: 'link', fromId: 'starter_burden', toId: 'revenue', from: 'Starter support burden', to: 'Revenue' }
const ids = (inputs: StrengthenInputs) => buildRecommendations(inputs).map((r) => r.id)

describe('the unsized-path withhold\'s own ask is the panel\'s next step', () => {
  it('CONTRAST (no withhold): today\'s next input — the factor CEE awaits', () => {
    expect(ids(draft6())).toEqual(['strengthen:next-input:price_losses'])
  })

  it('DRAFT 6: the withhold\'s link, focusing that link; the different factor does not render', () => {
    const recs = buildRecommendations(draft6(LINK))
    expect(recs.map((r) => r.id)).toEqual(['strengthen:unsized-path:link:starter_burden->revenue'])
    expect(recs[0]).toMatchObject({ title: 'Set the strength of the link from ‘Starter support burden’ to ‘Revenue’',
      targetId: 'starter_burden->revenue', action: { kind: 'canvas-focus', label: 'Show me this link' } })
  })

  it('(B) gauge (Integrator 37): the one end-to-end question, focused on its lever\'s link', () => {
    const recs = buildRecommendations(draft6({ kind: 'gauge', fromId: 'price', throughId: 'strain', toId: 'mrr',
      from: 'Pro plan price', through: 'Support capacity strain', to: 'MRR' }))
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ title: 'Set how much ‘Pro plan price’ changes ‘MRR’ through ‘Support capacity strain’',
      targetId: 'price->strain' })
  })

  it('(A) goal level first: the goal, focused', () => {
    const recs = buildRecommendations(draft6({ kind: 'goal_level', nodeId: 'mrr', goal: 'MRR' }))
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ title: 'Give ‘MRR’ today’s level', targetId: 'mrr', action: { label: 'Show me the goal' } })
  })

  it('a withhold whose ask cannot be named (null): NO other input is offered in its place', () => {
    expect(ids(draft6(null))).toEqual([])
  })
})
