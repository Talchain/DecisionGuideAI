/**
 * The 'sent' settlement reads the MODEL, not React's render state.
 *
 * `onSendSettled('sent')` fires in a microtask after `sendTurn` has processed the
 * reply. React may not yet have re-rendered the row (so the pending-clearing
 * effect has not run), which is exactly when this check decides: if the store
 * already holds the sent number, the receipt landed and nothing is said; if it
 * does not, CEE answered without applying it. The panel spec cannot reach this
 * ordering (its `act` flushes the effect first), so it is pinned here with the
 * authority seam captured and the store written WITHOUT a React flush.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

let captured: ((s: 'sent' | 'queued' | 'blocked' | 'refused' | 'unverified') => void) | null = null
vi.mock('../../../../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeOptionIntervention: (_f: string, _v: number, opts?: { onSendSettled?: (s: never) => void }) => {
      captured = (opts?.onSendSettled ?? null) as never
      return 'dispatched'
    },
  }),
}))

import { useOptionInterventionCommit, OPTION_INTERVENTION_NOT_APPLIED } from '../useOptionInterventionCommit'
import { useCanvasStore } from '../../../../store'

const OPTION_ID = 'opt_hybrid'
const FACTOR_ID = 'fac_usage_exposure'

function seed(value: number) {
  useCanvasStore.setState({
    nodes: [
      { id: OPTION_ID, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'H', interventions: { [FACTOR_ID]: value } } } as unknown as Node,
    ],
  } as never, false)
}

function storeHolds(value: unknown) {
  // Deliberately NOT inside act(): the reply was processed, React has not flushed.
  useCanvasStore.setState({
    nodes: useCanvasStore.getState().nodes.map(n =>
      n.id === OPTION_ID ? { ...n, data: { ...n.data, interventions: { [FACTOR_ID]: value } } } : n,
    ),
  } as never)
}

beforeEach(() => {
  captured = null
  seed(0.2)
})

describe("'sent' is decided by what the model holds at settle time", () => {
  it('the receipt landed before React re-rendered → no notice', () => {
    const { result } = renderHook(() => useOptionInterventionCommit(OPTION_ID))
    act(() => { result.current.commit(FACTOR_ID, 0.8) })
    storeHolds({ value: 0.8, source: 'user_specified' })
    act(() => { captured!('sent') })
    expect(result.current.notice).toBeNull()
  })

  it('the model does not hold the number → withdrawn, and not saved is said', () => {
    const { result } = renderHook(() => useOptionInterventionCommit(OPTION_ID))
    act(() => { result.current.commit(FACTOR_ID, 0.8) })
    act(() => { captured!('sent') })
    expect(result.current.pending).toBeNull()
    expect(result.current.notice).toBe(OPTION_INTERVENTION_NOT_APPLIED)
  })

  it('CONTROL: a different number in the model does not count as this send landing', () => {
    const { result } = renderHook(() => useOptionInterventionCommit(OPTION_ID))
    act(() => { result.current.commit(FACTOR_ID, 0.8) })
    storeHolds(0.7)
    act(() => { captured!('sent') })
    expect(result.current.notice).toBe(OPTION_INTERVENTION_NOT_APPLIED)
  })
})
