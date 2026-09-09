/**
 * `useModelEditAuthority` — the two LOCAL COMMITS, at the authority itself.
 *
 * ⚠ WHY THIS FILE EXISTS: A SURVIVING MUTANT SAID IT HAD TO (18 Aug 2026).
 *
 * The surface tests in `model-tab-v2/__tests__/rehomedLocalCommits.spec.tsx`
 * drive these operations through the mounted panel, which is the right place to
 * pin what a USER gets. But the panel only ever calls them in the states its own
 * predicates allow — so a mutation that DELETED the authority's value guard
 * (`M2`, "confirm drops value guard") SURVIVED the entire battery: the UI never
 * offers Confirm without a value, so nothing reached the guard.
 *
 * A survivor is a claim in both directions and must be DEMONSTRATED, never
 * asserted (trap 13c). The demonstration is that these guards are genuinely
 * uncovered — the affordance predicate hides them — and the honest response is
 * to test them where they live rather than to declare the mutant equivalent.
 *
 * ⚠ AND THEY ARE NOT REDUNDANT WITH THE UI PREDICATES. The UI predicate decides
 * whether to OFFER a gesture; these decide whether to HONOUR one. They answer
 * different questions (trap 21) and the second is what protects the model when a
 * future caller — the repair queues' "Apply all shown", a keyboard path, a batch
 * — reaches the authority without the row's predicate in front of it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => undefined }
})

import { useModelEditAuthority } from '../useModelEditAuthority'
import { useCanvasStore } from '../../store'

const FACTOR = 'fac_cost'
const VALUELESS_FACTOR = 'fac_unknown'
const OPTION = 'opt_premium'
const GOAL = 'goal_arr'
const VALUED_NON_FACTOR = 'risk_supplier'

function seed() {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: FACTOR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Cost',
            kind: 'factor',
            observedState: { value: 0.5, raw_value: 15000, cap: 30000, source: 'cee_inference' },
          },
        },
        {
          id: VALUELESS_FACTOR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { label: 'Churn', kind: 'factor' },
        },
        {
          id: OPTION,
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Premium', kind: 'option', interventions: { [FACTOR]: 0.2 } },
        },
        { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'ARR', kind: 'goal' } },
        /*
         * ⚠ A NON-FACTOR THAT DOES CARRY AN OBSERVED VALUE — and it exists for
         * one reason: WITHOUT IT THE KIND GUARD IS UNTESTED.
         *
         * The first cut of this spec proved "refuses a node that is not a
         * factor" using the GOAL, which has no observed state — so the VALUE
         * guard refused it and the KIND guard was never consulted. A mutant
         * deleting the kind check SURVIVED the whole battery while that test
         * stayed green: a guard passing because its NEIGHBOUR fired (trap 13b).
         * Only a node that clears every other guard can discriminate this one.
         */
        {
          id: VALUED_NON_FACTOR,
          type: 'risk',
          position: { x: 0, y: 0 },
          data: {
            label: 'Supplier failure',
            kind: 'risk',
            observedState: { value: 0.3, source: 'cee_inference' },
          },
        },
      ],
      edges: [],
    } as never,
    false,
  )
}

const authorityFor = (id: string | null) => renderHook(() => useModelEditAuthority(id)).result

function nodeData(id: string): Record<string, unknown> {
  return (useCanvasStore.getState().nodes.find(n => n.id === id)?.data ?? {}) as Record<string, unknown>
}
const sourceOf = (id: string) =>
  (nodeData(id).observedState as Record<string, unknown> | undefined)?.source
const interventionsOf = (id: string) =>
  (nodeData(id).interventions ?? {}) as Record<string, unknown>

beforeEach(() => seed())

describe('proposeFactorConfirmation — honours only what it can honour', () => {
  it('POSITIVE CONTROL: it does commit on the case it is FOR, so the refusals below discriminate', () => {
    expect(authorityFor(FACTOR).current.proposeFactorConfirmation()).toBe('committed')
    expect(sourceOf(FACTOR)).toBe('user_confirmed')
  })

  it('refuses a factor with NO value — you cannot ratify a number that is not there (P5)', () => {
    expect(authorityFor(VALUELESS_FACTOR).current.proposeFactorConfirmation()).toBe('not_encodable')
    // ⚠ AND NOTHING WAS WRITTEN. The outcome alone would pass on a half-commit.
    expect(sourceOf(VALUELESS_FACTOR)).toBeUndefined()
  })

  it('refuses a node that is not a factor — the goal, which also has no value', () => {
    expect(authorityFor(GOAL).current.proposeFactorConfirmation()).toBe('not_encodable')
    expect(sourceOf(GOAL)).toBeUndefined()
  })

  it('⭐ refuses a NON-FACTOR THAT DOES HAVE A VALUE — the kind guard, discriminated', () => {
    // This case clears every other guard: the node exists, and it carries a
    // finite observed value. Only the kind check can refuse it, so this is the
    // one fixture that can tell a live kind guard from a deleted one. Proven by
    // mutation: deleting the check leaves the test above GREEN and this one RED.
    expect(authorityFor(VALUED_NON_FACTOR).current.proposeFactorConfirmation()).toBe(
      'not_encodable',
    )
    expect(sourceOf(VALUED_NON_FACTOR)).toBe('cee_inference')
    expect(sourceOf(VALUED_NON_FACTOR)).not.toBe('user_confirmed')
  })

  it('refuses when no node is active, and when the id names nothing', () => {
    expect(authorityFor(null).current.proposeFactorConfirmation()).toBe('not_encodable')
    expect(authorityFor('nope').current.proposeFactorConfirmation()).toBe('not_encodable')
  })
})

describe('proposeOptionIntervention — honours only what it can honour', () => {
  it('POSITIVE CONTROL: it does commit on the case it is FOR', () => {
    expect(authorityFor(OPTION).current.proposeOptionIntervention(FACTOR, 0.75)).toBe('committed')
    expect(interventionsOf(OPTION)[FACTOR]).toBe(0.75)
  })

  it('refuses a factor that is NOT IN THE MODEL — the entry would surface as a raw id', () => {
    expect(authorityFor(OPTION).current.proposeOptionIntervention('fac_deleted', 0.5)).toBe(
      'not_encodable',
    )
    expect(Object.keys(interventionsOf(OPTION))).not.toContain('fac_deleted')
    // The pre-existing entry is untouched — the refusal is a no-op, not a reset.
    expect(interventionsOf(OPTION)[FACTOR]).toBe(0.2)
  })

  it('refuses when the ACTIVE node is not an option — interventions belong to options', () => {
    expect(authorityFor(FACTOR).current.proposeOptionIntervention(FACTOR, 0.5)).toBe('not_encodable')
    expect(nodeData(FACTOR).interventions).toBeUndefined()
  })

  it('refuses a non-finite value and an empty factor id', () => {
    const a = authorityFor(OPTION).current
    expect(a.proposeOptionIntervention(FACTOR, Number.NaN)).toBe('not_encodable')
    expect(a.proposeOptionIntervention(FACTOR, Number.POSITIVE_INFINITY)).toBe('not_encodable')
    expect(a.proposeOptionIntervention('   ', 0.5)).toBe('not_encodable')
    expect(interventionsOf(OPTION)[FACTOR]).toBe(0.2)
  })
})
