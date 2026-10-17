/**
 * DESIGN-GAP-AUDIT row 37 — the edit-state words on the CARD's value editor.
 *
 * A `dispatched` commit is not a settled one. The card is settled on the send
 * itself (`proposeFactorValue`'s `opts.onSendSettled`, classified by
 * `settleSystemEventSend`), never guessed from a timer: the earlier timer
 * draft ended EVERY accepted edit on "Could not confirm". The ⭐ CONTRAST case
 * below is the one that pins that away.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NodeValueEditor } from '../NodeValueEditor'
import type { SystemEventSendSettlementDetail, SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'
import { SAVED_MODEL_READ_TIMEOUT_MS } from '../../../conversation/valueCommitSettlement'
import { useCanvasStore } from '../../../store'

const BEFORE = 60000
const COMMITTED = 70000

type Settle = (s: SystemEventSendSettlement, detail?: SystemEventSendSettlementDetail) => void

/** An authority double that dispatches and hands back the settle channel. */
function dispatchingAuthority() {
  const settles: Settle[] = []
  const onCommit = vi.fn((_v: number, opts: { onSendSettled: Settle }) => {
    settles.push(opts.onSendSettled)
    return 'dispatched' as const
  })
  return { onCommit, settles }
}

function renderEditor(onCommit: ReturnType<typeof dispatchingAuthority>['onCommit'], readNow?: () => number | null) {
  return render(
    <NodeValueEditor
      value={BEFORE}
      readout="£60,000"
      onCommit={onCommit}
      readCommittedValue={readNow}
      ariaLabel="Value"
      testId="nve"
    />,
  )
}

function commitTo(next: number) {
  fireEvent.click(screen.getByTestId('nve'))
  fireEvent.change(screen.getByTestId('nve-input'), { target: { value: String(next) } })
  fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
}

const word = () => screen.queryByTestId('nve-settlement')

describe('the settlement word after a dispatched commit', () => {
  it('revision refusal reads the saved model, then renders only the exact notice when another change got in first', async () => {
    // Batch R3 (capacity run 2, row 6): a revision race is a moved base, so the card reads the saved model before it
    // speaks; the notice is said only once that read shows a third value.
    const baseAtStart = useCanvasStore.getState().lastServerGraphHash
    let held: number | null = BEFORE
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit, () => held)
    commitTo(COMMITTED)
    act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'revision_conflict' }))
    expect(word()?.textContent).toBe('Checking the saved model…')
    held = 80000
    await act(async () => {
      useCanvasStore.setState({ lastServerGraphHash: 'revision-4' } as never)
      await new Promise(resolve => setTimeout(resolve, 5))
    })
    expect(word()?.textContent).toBe('The scenario changed while I was saving, so nothing was saved. Try again.')
    expect(word()?.getAttribute('role')).toBe('alert')
    expect(screen.queryByText(/The model kept its previous value/)).toBeNull()
    act(() => { useCanvasStore.setState({ lastServerGraphHash: baseAtStart } as never) })
  })
  it('shows "Saving…" while the send is in flight', () => {
    const { onCommit } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    expect(onCommit).toHaveBeenCalledWith(COMMITTED, expect.objectContaining({ onSendSettled: expect.any(Function) }))
    expect(word()?.textContent).toBe('Saving…')
    expect(word()?.getAttribute('role')).toBe('status')
  })

  it('⭐⭐ refused → "Not saved", role=alert', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('refused'))
    expect(word()?.textContent).toMatch(/^Not saved\./)
    expect(word()?.getAttribute('role')).toBe('alert')
  })

  it('⭐⭐ sent, but the model value is back where it was (a 200 that wrote nothing) → "Not saved"', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit, () => BEFORE)
    commitTo(COMMITTED)
    act(() => settles[0]('sent'))
    expect(word()?.textContent).toMatch(/^Not saved\./)
  })

  it('⭐ CONTRAST — sent and the model kept the value → NO word at all: no "Could not confirm", no "Saving…"', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit, () => COMMITTED)
    commitTo(COMMITTED)
    act(() => settles[0]('sent'))
    expect(word()).toBeNull()
  })

  it('unverified → "Could not confirm"', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('unverified'))
    expect(word()?.textContent).toBe('Could not confirm. It may not have reached the model.')
    expect(word()?.getAttribute('role')).toBe('status')
  })

  it('blocked → saved on this device only, never "Saving…" left hanging', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('blocked'))
    expect(word()?.textContent).toBe('Saved on this device only — not sent to the model yet.')
  })

  it('queued → no word (the flush queue owns it)', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('queued'))
    expect(word()).toBeNull()
  })

  it('a STALE reply from an earlier commit cannot label the newer one', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit, () => 80000)
    commitTo(COMMITTED)
    commitTo(80000)
    act(() => settles[0]('refused'))
    expect(word()?.textContent).toBe('Saving…')
    act(() => settles[1]('sent'))
    expect(word()).toBeNull()
  })

  it('a NEW edit clears a "Not saved" alert from the prior commit', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('refused'))
    expect(word()).not.toBeNull()
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Escape' })
    expect(word()).toBeNull()
  })

  it('a settlement arriving after the card unmounts writes nothing', () => {
    const { onCommit, settles } = dispatchingAuthority()
    const { unmount } = renderEditor(onCommit)
    commitTo(COMMITTED)
    unmount()
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => settles[0]('refused'))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

/**
 * Recovery Batch B (served capacity row 7a): only a refusal on a MOVED base waits for the saved model. Every other
 * refusal keeps its immediate word, and a read that never comes ends on the cannot-confirm line, never "Not saved".
 */
describe('a refusal on a moved base reads the saved model; nothing else changes', () => {
  it('NEGATIVE: a stopped turn (fence verdict) is still "Not saved" at once — the model did not move', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'turn_fence_stopped' }))
    expect(word()?.textContent).toMatch(/^Not saved\./)
  })

  it('NEGATIVE: a request the server declined outright is still "Not saved" at once', () => {
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit)
    commitTo(COMMITTED)
    act(() => settles[0]('refused', { refusal: 'declined', reason: 'system_event_refused_no_write' }))
    expect(word()?.textContent).toMatch(/^Not saved\./)
  })

  it('a moved-base refusal remains a definite non-save of this attempt when the current model cannot be read', () => {
    vi.useFakeTimers()
    try {
      const { onCommit, settles } = dispatchingAuthority()
      renderEditor(onCommit)
      commitTo(COMMITTED)
      act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'stale_base_graph_hash' }))
      expect(word()?.textContent).toBe('Checking the saved model…')
      act(() => { vi.advanceTimersByTime(SAVED_MODEL_READ_TIMEOUT_MS) })
      expect(word()?.textContent).toBe('Not saved on this attempt. The latest model could not be refreshed. Reload it before editing again.')
      expect(word()?.textContent).not.toMatch(/kept its previous value|may not have reached/)
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * B UI's delta checks on c72ec673 and cbeefd21 (BLOCKING ×2): a local scenario switch keeps a same-id card mounted, so the
 * card's settlement state leaked across scenarios — a read of B's value for A's refused edit, an A→B→A switch before the
 * refusal that a scenario-id equality let through, and a completed receipt that stayed on B. The class: the editor's
 * state is not scoped to the scenario. Now the editor is keyed by the scenario (any switch remounts it).
 *
 * GENERATIVE: every switch point in the card's flow × {A→B, A→B→A} × every read outcome. The flow is commit → the
 * refusal (the watch starts here, "Checking…") → the read (the base moves) → the receipt. After any switch, nothing from
 * the other scenario's edit shows: no receipt and no "Checking…". With no switch, each genuine word still shows.
 */
describe('a scenario switch, at any point of the flow, leaves no word from the other scenario on the card', () => {
  type Point = 'after-commit' | 'after-refusal' | 'as-the-read-lands' | 'after-receipt'
  type Kind = 'A→B' | 'A→B→A'
  const POINTS: readonly Point[] = ['after-commit', 'after-refusal', 'as-the-read-lands', 'after-receipt']
  const KINDS: readonly Kind[] = ['A→B', 'A→B→A']
  const OUTCOMES = [
    ['saved', COMMITTED, 'Saved. The model holds this value.'],
    ['kept', BEFORE, 'Not saved. The model kept its previous value.'],
    ['third', 80000, 'The scenario changed while I was saving, so nothing was saved. Try again.'],
  ] as const
  const start = useCanvasStore.getState()
  const set = (patch: Record<string, unknown>) => useCanvasStore.setState(patch as never)
  /** Each switch is its own user action, rendered before the next (opening a scenario is never batched with leaving it). */
  const doSwitch = async (kind: Kind, aBase = 'a-revision-3') => {
    await act(async () => { set({ currentScenarioId: 'scenario-b', lastServerGraphHash: 'b-graph-0001' }); await Promise.resolve() })
    // Back to A on the base it left: an equality on the scenario id alone would pass here.
    if (kind === 'A→B→A') {
      await act(async () => { set({ currentScenarioId: 'scenario-a', lastServerGraphHash: aBase }); await Promise.resolve() })
    }
  }

  async function run(point: Point | null, kind: Kind, held: number): Promise<string | null> {
    act(() => set({ currentScenarioId: 'scenario-a', lastServerGraphHash: 'a-revision-3' }))
    let value: number | null = BEFORE
    const { onCommit, settles } = dispatchingAuthority()
    renderEditor(onCommit, () => value)
    const maybe = async (here: Point) => {
      if (point !== here) return
      await doSwitch(kind, here === 'after-receipt' ? 'a-revision-4' : 'a-revision-3')
      // Right after the switch, nothing from A's edit is on the card.
      expect(word(), `right after a ${kind} switch ${here}`).toBeNull()
    }
    commitTo(COMMITTED)
    await maybe('after-commit')
    act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'stale_base_graph_hash' }))
    await maybe('after-refusal')
    value = held
    if (point === 'as-the-read-lands') {
      // The base moves and, in the same task, the person opens B (the read is still scheduled).
      await act(async () => {
        set({ lastServerGraphHash: 'a-revision-4' })
        set({ currentScenarioId: 'scenario-b', lastServerGraphHash: 'b-graph-0001' })
        await new Promise(resolve => setTimeout(resolve, 5))
      })
      if (kind === 'A→B→A') {
        await act(async () => { set({ currentScenarioId: 'scenario-a', lastServerGraphHash: 'a-revision-4' }); await new Promise(resolve => setTimeout(resolve, 5)) })
      }
      expect(word(), `right after a ${kind} switch as the read lands`).toBeNull()
    } else {
      await act(async () => {
        set({ lastServerGraphHash: 'a-revision-4' })
        await new Promise(resolve => setTimeout(resolve, 5))
      })
    }
    await maybe('after-receipt')
    return word()?.textContent ?? null
  }

  for (const point of POINTS) {
    for (const kind of KINDS) {
      for (const [name, held] of OUTCOMES) {
        it(`${kind} ${point}, the model holding the ${name} value → no receipt and no "Checking…"`, async () => {
          try {
            expect(await run(point, kind, held)).toBeNull()
          } finally {
            act(() => set({ currentScenarioId: start.currentScenarioId, lastServerGraphHash: start.lastServerGraphHash }))
          }
        })
      }
    }
  }

  for (const [name, held, said] of OUTCOMES) {
    it(`CONTRAST, no switch: the model holding the ${name} value → "${said}"`, async () => {
      try {
        expect(await run(null, 'A→B', held)).toBe(said)
      } finally {
        act(() => set({ currentScenarioId: start.currentScenarioId, lastServerGraphHash: start.lastServerGraphHash }))
      }
    })
  }
})

/**
 * B UI's final check on d770bc1c (non-blocking, DL ruling): keyed by the scenario id alone, the editor also remounted
 * on the FIRST "Save as" of an unbound model and threw away a genuine refusal and its draft. The id changed; the model
 * did not. The checker's sequence, on the real store, then the id changes that are a new model and must still remount.
 */
describe('the unbound model getting its first id is the same model: the editor keeps its refusal and draft', () => {
  const start = useCanvasStore.getState()
  const node = { id: 'keep', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Keep' } }
  const set = (patch: Record<string, unknown>) => act(() => { useCanvasStore.setState(patch as never) })
  afterEach(() => set({
    currentScenarioId: start.currentScenarioId, unboundModelBinding: null, nodes: start.nodes, edges: start.edges,
  }))

  function refuseAnOutOfRangeValue() {
    render(<NodeValueEditor value={50} readout="50" onCommit={vi.fn(() => 'dispatched' as const)} min={0} max={100}
      ariaLabel="Value" testId="nve" />)
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.change(screen.getByTestId('nve-input'), { target: { value: '500' } })
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
    expect(screen.getByTestId('nve-refusal').textContent).not.toBe('')
  }
  const refusalAndDraft = () => [
    screen.queryByTestId('nve-refusal')?.textContent ?? null,
    (screen.queryByTestId('nve-input') as HTMLInputElement | null)?.value ?? null,
  ]

  it('⭐ Start fresh → Undo (the id is null) → an out-of-range value → Save as: the refusal and its draft stay', () => {
    set({ currentScenarioId: 'scenario-a', nodes: [node], edges: [] })
    act(() => useCanvasStore.getState().resetCanvas())
    act(() => useCanvasStore.getState().undo())
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(useCanvasStore.getState().nodes.map(n => n.id)).toEqual(['keep'])
    refuseAnOutOfRangeValue()
    const before = refusalAndDraft()
    expect(before[1]).toBe('500')
    act(() => { useCanvasStore.getState().saveCurrentScenario('Saved model') })
    expect(useCanvasStore.getState().currentScenarioId).toEqual(expect.any(String))
    expect(refusalAndDraft()).toEqual(before)
  })

  it.each([
    ['opening another decision from the unbound model (null → id, no binding)', null,
      { currentScenarioId: 'scenario-b' }],
    ['a binding left from an earlier Save as, when that id is opened later', 'scenario-x',
      { currentScenarioId: 'scenario-x' }],
    ['a fresh binding that names another id', null,
      { currentScenarioId: 'scenario-b', unboundModelBinding: { scenarioId: 'scenario-x' } }],
  ] as const)('CONTRAST, a new model: %s → remounts', (_name, earlier, write) => {
    set({ currentScenarioId: null, unboundModelBinding: earlier === null ? null : { scenarioId: earlier } })
    refuseAnOutOfRangeValue()
    set(write)
    expect(refusalAndDraft()).toEqual([null, null])
  })

  it('CONTRAST, a new model: a BOUND model given another id, even with a binding (A → Y) → remounts', () => {
    set({ currentScenarioId: 'scenario-a', unboundModelBinding: null })
    refuseAnOutOfRangeValue()
    set({ currentScenarioId: 'scenario-y', unboundModelBinding: { scenarioId: 'scenario-y' } })
    expect(refusalAndDraft()).toEqual([null, null])
  })
})

describe('opening the editor', () => {
  it('selects the whole number, so typing replaces it rather than appending', () => {
    // jsdom does not model a number input's selection, so the call is the witness.
    const select = vi.spyOn(HTMLInputElement.prototype, 'select')
    const { onCommit } = dispatchingAuthority()
    renderEditor(onCommit)
    expect(select).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('nve'))
    const input = screen.getByTestId('nve-input') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(select.mock.instances).toContain(input)
    select.mockRestore()
  })
})
