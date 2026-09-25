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
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'

const BEFORE = 60000
const COMMITTED = 70000

type Settle = (s: SystemEventSendSettlement) => void

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
