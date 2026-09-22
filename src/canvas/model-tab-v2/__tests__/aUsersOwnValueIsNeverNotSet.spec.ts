/**
 * ⛔⛔ A USER'S OWN NUMBER READ "Not set · Olumi: 0.6".
 *
 * Witnessed on served `8151fba5` (22 Sep 2026, guest, canonical pricing saved
 * example): the user set *Bottom-Up Adoption Friction* to 0.6 in the Model tab,
 * CEE applied it (`graph_patch applied`), and after a reload the row read
 * **"Not set · Olumi: 0.6"**, marked "User edited" and "No value set" at once.
 *
 * The node came back as `{value: 0.6, source: "user_override"}` with NO
 * `raw_value` — the known off-the-wire shape for a factor stored on the model
 * scale (`adapters.ts`, the confirm queue's note). `factorValue` read only
 * `raw_value`, so the user's value fell into the path reserved for values
 * nobody has set, and that path attributes its text to Olumi.
 *
 * A user-owned source is the fact that decides it: someone SET this number.
 * An Olumi estimate with the same shape stays an estimate.
 */
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { toModelRows, toRepairQueueItems, type ModelProjectionInput } from '../adapters'

/** Captured from the served store after reload, verbatim apart from the id list. */
const CAPTURED_USER_VALUE = {
  factor_type: 'other',
  source: 'user_override',
  uncertainty_drivers: ['Current seat model limits trial and expansion', 'Onboarding complexity unknown'],
  value: 0.6,
}

function factor(observedState: Record<string, unknown>): Node {
  return {
    id: 'fac_adoption_friction',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Bottom-Up Adoption Friction',
      type: 'factor',
      category: 'controllable',
      observedState,
      observed_state: observedState,
    },
  }
}

const input = (n: Node): ModelProjectionInput => ({ nodes: [n], edges: [], goalThreshold: null })
const rowOf = (n: Node) => toModelRows(input(n)).find((r) => r.id === 'fac_adoption_friction')!

describe('a value a person set is shown as set, whatever scale it arrived on', () => {
  it('shows the user’s value as the row’s value — not "Not set", not attributed to Olumi', () => {
    const row = rowOf(factor(CAPTURED_USER_VALUE))
    expect(row.primaryValue).toBe('0.6')
    expect(row.estimateText).toBeUndefined()
    expect(row.attention).not.toContain('no-value')
    expect(row.provenanceSource).toBe('user_override')
  })

  it('keeps the same number out of the "no value yet" queue', () => {
    const items = toRepairQueueItems(input(factor(CAPTURED_USER_VALUE)), 'no-value')
    expect(items.map((i) => i.rowId)).not.toContain('fac_adoption_friction')
  })

  it('treats a confirmed value the same way — confirmation is also a person vouching', () => {
    expect(rowOf(factor({ ...CAPTURED_USER_VALUE, source: 'user_confirmed' })).primaryValue).toBe('0.6')
  })

  it('CONTRAST: Olumi’s own estimate in the same shape stays an estimate', () => {
    const row = rowOf(factor({ ...CAPTURED_USER_VALUE, source: 'cee_inference' }))
    expect(row.primaryValue).toBeNull()
    expect(row.attention).toContain('no-value')
  })

  it('CONTRAST: no source at all is not treated as a person’s value', () => {
    const { source: _omit, ...unsourced } = CAPTURED_USER_VALUE
    expect(rowOf(factor(unsourced)).primaryValue).toBeNull()
  })
})
