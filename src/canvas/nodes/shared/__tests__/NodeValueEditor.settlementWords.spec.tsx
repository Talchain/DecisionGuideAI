/**
 * DESIGN-GAP-AUDIT row 37 — the edit-state words on the CARD's value editor.
 *
 * A `dispatched` commit is not a settled one. The card is settled on the send
 * itself (`proposeFactorValue`'s `opts.onSendSettled`, classified by
 * `settleSystemEventSend`), never guessed from a timer: the earlier timer
 * draft ended EVERY accepted edit on "Could not confirm". The ⭐ CONTRAST case
 * below is the one that pins that away.
 */
import { describe, it, expect, vi } from 'vitest'
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

  it('a moved-base refusal whose saved model is never read ends on "Could not confirm", never "Not saved"', () => {
    vi.useFakeTimers()
    try {
      const { onCommit, settles } = dispatchingAuthority()
      renderEditor(onCommit)
      commitTo(COMMITTED)
      act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'stale_base_graph_hash' }))
      expect(word()?.textContent).toBe('Checking the saved model…')
      act(() => { vi.advanceTimersByTime(SAVED_MODEL_READ_TIMEOUT_MS) })
      expect(word()?.textContent).toBe('Could not confirm. It may not have reached the model.')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a saved-model read only counts in the scenario the edit was sent in (B UI check on 6d44b341)', () => {
  it('RED on 6d44b341: refused in scenario A, then B holds the typed value under a new hash → "Could not confirm", never "Saved"', async () => {
    const start = useCanvasStore.getState()
    act(() => { useCanvasStore.setState({ currentScenarioId: 'scenario-a', lastServerGraphHash: 'a-revision-3' } as never) })
    try {
      let held: number | null = BEFORE
      const { onCommit, settles } = dispatchingAuthority()
      renderEditor(onCommit, () => held)
      commitTo(COMMITTED)
      act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'stale_base_graph_hash' }))
      expect(word()?.textContent).toBe('Checking the saved model…')
      held = COMMITTED
      await act(async () => {
        useCanvasStore.setState({ currentScenarioId: 'scenario-b', lastServerGraphHash: 'b-graph-0001' } as never)
        await new Promise(resolve => setTimeout(resolve, 5))
      })
      expect(word()?.textContent).toBe('Could not confirm. It may not have reached the model.')
      expect(screen.queryByText('Saved. The model holds this value.')).toBeNull()
    } finally {
      act(() => { useCanvasStore.setState({ currentScenarioId: start.currentScenarioId, lastServerGraphHash: start.lastServerGraphHash } as never) })
    }
  })
})

describe('the scenario is the one the edit was SENT in, read at commit (B UI check on 6d44b341)', () => {
  it('committed in A, the person opens B before the refusal arrives, B holds the typed value → never "Saved"', async () => {
    const start = useCanvasStore.getState()
    act(() => { useCanvasStore.setState({ currentScenarioId: 'scenario-a', lastServerGraphHash: 'a-revision-3' } as never) })
    try {
      let held: number | null = BEFORE
      const { onCommit, settles } = dispatchingAuthority()
      renderEditor(onCommit, () => held)
      commitTo(COMMITTED)
      act(() => { useCanvasStore.setState({ currentScenarioId: 'scenario-b', lastServerGraphHash: 'b-graph-0001' } as never) })
      act(() => settles[0]('refused', { refusal: 'conflict', conflictCategory: 'stale_base_graph_hash' }))
      held = COMMITTED
      await act(async () => {
        useCanvasStore.setState({ lastServerGraphHash: 'b-graph-0002' } as never)
        await new Promise(resolve => setTimeout(resolve, 5))
      })
      expect(word()?.textContent).toBe('Could not confirm. It may not have reached the model.')
    } finally {
      act(() => { useCanvasStore.setState({ currentScenarioId: start.currentScenarioId, lastServerGraphHash: start.lastServerGraphHash } as never) })
    }
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
