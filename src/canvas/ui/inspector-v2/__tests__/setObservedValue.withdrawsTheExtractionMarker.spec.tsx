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

function nodeData(): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === NODE_ID)
  expect(n).toBeTruthy()
  return n!.data as Record<string, unknown>
}

describe('setObservedValue withdraws the producer’s extraction marker', () => {
  beforeEach(seed)

  it('⭐ clears extractionType — RED at pristine, where the spread preserved it', () => {
    // PRECONDITION pinned in-test (trap 13b): the node really does carry the
    // producer's marker first, so a later clear is the setter's doing and
    // not the fixture's.
    expect(observed().extractionType).toBe('inferred')

    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8)
    })

    // `null`, not `undefined` (independent review, PR #2046 Blocking 2):
    // `undefined` does not survive a JSON round trip (autosave, boot
    // restore), which read a withdrawn-but-serialised marker as though it had
    // never been written at all. See
    // `valueSourceMark.withdrawalSurvivesSerialisation.spec.ts`.
    expect(observed().extractionType).toBeNull()
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
    expect(observed().extractionType).toBeNull()
  })

  /**
   * ⭐⭐ THE SECOND STORAGE LOCATION — and this case is why the fix is two lines.
   *
   * `extractionType` has TWO homes and both are live on a real board (deployed
   * `b6673341`, usage-based-billing starter): the CEE-derived
   * `observedState.extractionType`, and `data.extractionType`, which is what
   * `setExtractionType` (`useInspectorMutations.ts:806`) writes and what
   * `fac_vendor_cost` on that starter actually carries.
   * `usePreAnalysisData.ts:763-766` enumerates the pair in prose.
   *
   * ⚠⚠ SCOPE, STATED EXACTLY. On THIS branch `FactorNode` still reads only the
   * nested spelling, so the top-level clear changes nothing a user can see YET.
   * It becomes load-bearing the moment #1811 lands, because that PR widens the
   * reader to `factorValueIsUnconfirmedEstimate`, which returns true on EITHER
   * spelling. Each PR is correct alone and the PAIR is not — the #1096/#1097
   * split-predicate shape. Closing it in the WRITER makes the two safe in
   * either merge order, which is why it is here and not there.
   *
   * The assertion is on the field rather than through the reader because the
   * reader does not exist on this branch; the binding is restored when #1811
   * lands and its own specs cover it.
   */
  it('⭐ clears the TOP-LEVEL data.extractionType too — the spelling a real starter carries', () => {
    // A factor shaped like `fac_vendor_cost`: the marker lives at data level,
    // NOT inside observedState.
    useCanvasStore.setState(
      {
        nodes: [
          {
            id: NODE_ID,
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Vendor Licensing Cost',
              kind: 'factor',
              extractionType: 'inferred',
              observedState: { value: null, source: 'cee_inference' },
            },
          },
        ],
        edges: [],
      } as never,
      false,
    )
    // PRECONDITION pinned in-test (trap 13b): the marker really is at the top
    // level and really is absent from observedState, so a later clear is
    // the setter's doing and not the fixture's shape.
    expect(nodeData().extractionType).toBe('inferred')
    expect((nodeData().observedState as Record<string, unknown>).extractionType).toBeUndefined()

    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8)
    })

    // `null`, not `undefined` — see the earlier test's comment.
    expect(nodeData().extractionType).toBeNull()
  })

  it('CONTRAST — the top-level clear does not disturb a neighbouring data field', () => {
    // Discriminates "the setter clears extractionType" from "the setter wipes
    // the data object": `category` must survive untouched.
    useCanvasStore.setState(
      {
        nodes: [
          {
            id: NODE_ID,
            type: 'factor',
            position: { x: 0, y: 0 },
            data: {
              label: 'Vendor Licensing Cost',
              kind: 'factor',
              extractionType: 'inferred',
              category: 'external',
              observedState: { value: null },
            },
          },
        ],
        edges: [],
      } as never,
      false,
    )
    const { result } = renderHook(() => useNodeMutations(NODE_ID))
    act(() => {
      result.current.setObservedValue(0.8, 0.8)
    })
    expect(nodeData().extractionType).toBeNull()
    expect(nodeData().category).toBe('external')
  })
})
