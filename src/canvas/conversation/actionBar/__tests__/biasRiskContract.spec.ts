import { describe, expect, it } from 'vitest'

import { parseActionBar } from '../actionBarContract'
import { parseBiasRisk } from '../biasRiskContract'
import { EXAMPLE_BAR, MORE_OPTIONS, REVIEW } from './actionBarContractExample'

const WIDEN = { ...MORE_OPTIONS, offer_key: '238eb45e85c31ecf' }
const ANCHOR = {
  ...REVIEW,
  action_id: 'bias_anchoring',
  label: 'Check estimate',
  press_id: 'act:bias_anchoring',
  offer_key: 'be2a321235e1a126',
}
const CAPTURED = {
  v: 1,
  items: [
    {
      claim_id: 'DSK-B-007',
      name: 'Narrow framing',
      why: 'These options all work through the same lever, which can hide better routes.',
      action_id: 'more_options',
      press_id: 'agent-next-widen',
      offer_key: '238eb45e85c31ecf',
    },
    {
      claim_id: 'DSK-B-001',
      name: 'Anchoring',
      why: 'Olumi’s starting figure for ‘Migration preparation effort’ could pull later estimates towards it.',
      action_id: 'bias_anchoring',
      press_id: 'act:bias_anchoring',
      offer_key: 'be2a321235e1a126',
      science: {
        claim_id: 'DSK-B-001',
        claim_title: 'Anchoring and insufficient adjustment',
        evidence_strength: 'strong',
      },
    },
  ],
}

describe('parseBiasRisk', () => {
  it('binds both captured items to the enabled offers on this bar', () => {
    const view = parseBiasRisk(CAPTURED, [WIDEN, ANCHOR])
    expect(view?.items).toHaveLength(2)
    expect(view?.items[0]).toEqual(expect.objectContaining({ claim_id: 'DSK-B-007', offer: WIDEN }))
    expect(view?.items[1]).toEqual(expect.objectContaining({ claim_id: 'DSK-B-001', offer: ANCHOR }))
  })

  it.each([
    ['offer key', { offer_key: '0000000000000000' }, WIDEN],
    ['press id', { press_id: 'not-this-press' }, WIDEN],
    ['enabled state', {}, { ...WIDEN, enabled: false, why_now: undefined, disabled_reason: 'Unavailable.' }],
  ])('drops an item when its %s does not bind', (_name, itemChange, offer) => {
    expect(parseBiasRisk({ v: 1, items: [{ ...CAPTURED.items[0], ...itemChange }] }, [offer])).toBeUndefined()
  })

  it('rejects an unknown version', () => {
    expect(parseBiasRisk({ ...CAPTURED, v: 2 }, [WIDEN, ANCHOR])).toBeUndefined()
  })

  it('keeps at most the first two items', () => {
    const third = { ...CAPTURED.items[0], claim_id: 'DSK-B-009' }
    expect(parseBiasRisk({ ...CAPTURED, items: [...CAPTURED.items, third] }, [WIDEN, ANCHOR])?.items).toHaveLength(2)
  })

  it('tolerates additive unknown keys', () => {
    const view = parseBiasRisk({ ...CAPTURED, later_envelope_key: true, items: [{ ...CAPTURED.items[0], later_item_key: true }] }, [WIDEN])
    expect(view?.items).toHaveLength(1)
  })

  it('does not add a bias_risk key when the action bar omits it', () => {
    expect(parseActionBar(EXAMPLE_BAR)).not.toHaveProperty('bias_risk')
  })
})
