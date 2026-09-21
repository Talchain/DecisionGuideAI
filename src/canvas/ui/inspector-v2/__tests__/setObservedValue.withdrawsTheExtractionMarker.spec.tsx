/**
 * `setObservedValue` must withdraw the stale extraction marker, not spread it.
 *
 * THE DEFECT, measured on deployed `fd992149`. CEE writes
 * `extractionType: 'inferred'` beside `source: 'cee_inference'`
 * (`observedStateHelpers.ts:186-187`), and `FactorNode.tsx:199` reads THAT
 * field — not `source` — to decide whether to print the `est.` marker. The
 * setter replaced the value, the raw value and both `display_value`s, then
 * spread `...existing` over everything else, so the stale `'inferred'` survived
 * a user's edit indefinitely: the person typed a number and the card went on
 * labelling it Olumi's estimate.
 *
 * Live census on a starter board: **5 of 5 valued factors carry
 * `extractionType: 'inferred'`** (contrast control — the same 5 carry
 * `source`). Every factor anyone could edit was affected.
 *
 * ⚠ CLEARED, NOT RE-AUTHORED — the same ruling `display_value` is already under
 * in this setter: the field is the SERVER's to write, so setting `'explicit'`
 * here would be the client asserting an extraction it never performed.
 *
 * ⚠ NOT RECEIPT-GATED, and 2.304 is untouched. Withdrawing a statement that is
 * now FALSE is a different act from asserting a new one, and a refusal restores
 * it anyway — `revertOptimisticFactorEdit` puts back the whole captured
 * `observedState`, including the absence of keys that were absent.
 *
 * Companion: `canvas/nodes/__tests__/FactorNode.anEditedValueIsNotAnEstimate.spec.tsx`
 * pins that the rendered marker follows this field. That one is green at both
 * heads by construction; THIS file is the one that REDs at pristine.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNodeMutations } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

const NODE_ID = 'fac_eng_capacity'

/** The live shape, exactly as the deployed board carries it. */
const CEE_ESTIMATE = {
  value: 0.62,
  raw_value: 0.62,
  source: 'cee_inference',
  extractionType: 'inferred',
  display_value: '0.62 scale',
}

function seed() {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: NODE_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Engineering Capacity',
            kind: 'factor',
            display_value: '0.62 scale',
            observedState: { ...CEE_ESTIMATE },
          },
        },
      ],
      edges: [],
    } as never,
    false,
  )
}

function observed(): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === NODE_ID)
  expect(n).toBeTruthy()
  return (n!.data as { observedState: Record<string, unknown> }).observedState
}

describe('setObservedValue withdraws the producer’s extraction marker', () => {
  beforeEach(seed)

  it('⭐ clears extractionType — RED at pristine, where the spread preserved it', () => {
    // PRECONDITION pinned in-test (trap 13b): the node really does carry the
    // producer's marker first, so a later `undefined` is the setter's doing and
    // not the fixture's.
    expect(observed().extractionType).toBe('inferred')

    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8)
    })

    expect(observed().extractionType).toBeUndefined()
  })

  it('and the rest of the setter’s contract is unchanged', () => {
    // Without this, the assertion above could pass because the setter stopped
    // writing anything at all.
    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8)
    })

    const o = observed()
    expect(o.value).toBe(0.8)
    expect(o.raw_value).toBe(0.8)
    expect(o.display_value).toBeUndefined()
    // The producer's own source stamp is NOT touched here — that is the
    // receipt-gated path's job (ROADMAP 2.304), and conflating the two is how
    // an optimistic authorship claim gets written by accident.
    expect(o.source).toBe('cee_inference')
  })

  it('CONTRAST — a caller that passes a source still gets it, so the spread is not simply dropped', () => {
    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8, { source: 'user_override' })
    })
    expect(observed().source).toBe('user_override')
    expect(observed().extractionType).toBeUndefined()
  })
})
