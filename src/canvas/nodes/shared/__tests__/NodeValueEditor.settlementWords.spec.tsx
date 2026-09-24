/**
 * DESIGN-GAP-AUDIT row 37 — "Edit-state words on the card". `NodeValueEditor`
 * used to close the field on `dispatched` and say NOTHING further: a refusal
 * arriving a turn later reverted the value with no word on the card at all.
 * This pins the honest states it shows now, using the REAL
 * `didValueCommitRevert` predicate (via the real `value` prop moving — the
 * same signal the inspector's `FactorControllablePanel.
 * aRefusedEditIsNotShownAsSaved.spec.tsx` pins with the real
 * `revertOptimisticFactorEdit`), never a hand-built stand-in.
 *
 * ⚠ WHY THIS IS A RE-RENDER, NOT A STORE MOCK. `NodeValueEditor` is a
 * CONTROLLED component: it never reads the store itself, only the `value`
 * prop `FactorNode.tsx` derives from it. So the honest way to simulate "the
 * dispatcher reverted the optimistic write" is exactly what the real card
 * does when that happens — the SAME component re-rendered with a NEW `value`
 * prop. A mock at the store layer would test a mechanism this component does
 * not have.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NodeValueEditor } from '../NodeValueEditor'

const BEFORE = 60000
const COMMITTED = 70000

function commitTo(next: number) {
  fireEvent.click(screen.getByTestId('nve'))
  fireEvent.change(screen.getByTestId('nve-input'), { target: { value: String(next) } })
  fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Enter' })
}

describe('the settlement word after a dispatched commit', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "Saving…" the instant the commit dispatches', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    expect(screen.getByTestId('nve-settlement').textContent).toBe('Saving…')
    expect(screen.getByTestId('nve-settlement').getAttribute('role')).toBe('status')
  })

  /**
   * ⭐⭐ THE GATE THIS PINS, AND WHY A SIMPLER RERENDER CANNOT REACH IT. React
   * never re-runs a `useEffect` whose dependency did not actually change
   * between renders, so re-rendering with the SAME `value` the field already
   * held is a no-op for the watcher — it would pass whether or not the
   * two-step gate (`sawOptimisticWrite`) exists at all, discriminating
   * nothing. This drives the value through a THIRD, unrelated number first
   * (forcing a real effect run while the optimistic write still has not
   * landed), then back to `BEFORE` — the one sequence that tells apart "the
   * gate is protecting this" from "nothing happened to protect against".
   */
  it('a "Saving…" state that has not yet seen its own optimistic write land does NOT read a later coincidental match as a revert', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    // Some unrelated store change — the optimistic write has not landed yet.
    rerender(
      <NodeValueEditor value={999} readout="999" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    expect(screen.getByTestId('nve-settlement').textContent).toBe('Saving…')
    // And now back to BEFORE — without ever having seen COMMITTED land, this
    // must NOT read as a revert.
    rerender(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    expect(screen.getByTestId('nve-settlement').textContent).toBe('Saving…')
  })

  it('stays "Saving…" once the optimistic write lands, with nothing further known yet', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    rerender(
      <NodeValueEditor value={COMMITTED} readout="£70,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    expect(screen.getByTestId('nve-settlement').textContent).toBe('Saving…')
  })

  it('⭐⭐ a PROVEN revert shows "Not saved", role=alert — the exact defect this closes', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    // The optimistic write lands…
    rerender(
      <NodeValueEditor value={COMMITTED} readout="£70,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    // …then the dispatcher reverts it, exactly as `revertOptimisticFactorEdit`
    // does on a proven no-write refusal.
    rerender(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    const alert = screen.getByTestId('nve-settlement')
    expect(alert.textContent).toMatch(/^Not saved\./)
    expect(alert.getAttribute('role')).toBe('alert')
  })

  it('CONTRAST — an accepted edit never shows "Not saved": staying at the optimistic value is not a revert', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    rerender(
      <NodeValueEditor value={COMMITTED} readout="£70,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    expect(screen.queryByText(/^Not saved\./)).toBeNull()
  })

  /**
   * ⚠ ESCAPES BACK OUT RATHER THAN COMMITTING, DELIBERATELY. Opening the
   * editor always swaps to the input view, which does not render the
   * settlement span regardless of whether the underlying STATE was cleared —
   * that would pass even against a mutant that opens the editor without ever
   * touching `settlement`. Escaping back to the RESTING view, with no new
   * commit in between, is what actually proves the state was cleared rather
   * than merely hidden behind the editing branch for a moment.
   */
  it('a NEW edit clears a "Not saved" alert from the prior commit', () => {
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    rerender(
      <NodeValueEditor value={COMMITTED} readout="£70,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    rerender(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    expect(screen.getByTestId('nve-settlement')).toBeTruthy()
    fireEvent.click(screen.getByTestId('nve'))
    fireEvent.keyDown(screen.getByTestId('nve-input'), { key: 'Escape' })
    expect(screen.queryByTestId('nve-settlement')).toBeNull()
  })

  it('⭐ an UNCONFIRMED settlement — no revert, nothing further, after the wait window', () => {
    vi.useFakeTimers()
    const onCommit = vi.fn(() => 'dispatched' as const)
    render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    act(() => { vi.advanceTimersByTime(8001) })
    const notice = screen.getByTestId('nve-settlement')
    expect(notice.textContent).toBe('Could not confirm. It may not have reached the model.')
    expect(notice.getAttribute('role')).toBe('status')
  })

  it('DISCRIMINATING TWIN — a revert observed BEFORE the timeout wins; no "could not confirm" over it', () => {
    vi.useFakeTimers()
    const onCommit = vi.fn(() => 'dispatched' as const)
    const { rerender } = render(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    commitTo(COMMITTED)
    // ⚠ TWO SEPARATE `rerender` CALLS, DELIBERATELY NOT BATCHED TOGETHER —
    // each is its own store update in production (the optimistic write, then
    // the dispatcher's later revert), so each must get its own effect flush
    // here too, or this test would simulate a transition production never
    // makes (the two updates colliding in one React commit).
    rerender(
      <NodeValueEditor value={COMMITTED} readout="£70,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    rerender(
      <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId="nve" />,
    )
    act(() => { vi.advanceTimersByTime(8001) })
    expect(screen.getByTestId('nve-settlement').textContent).toMatch(/^Not saved\./)
  })

  it('a LOCAL_ONLY or NOT_ENCODABLE outcome never shows a settlement word — those are already synchronous refusals', () => {
    for (const outcome of ['local_only', 'not_encodable'] as const) {
      const onCommit = vi.fn(() => outcome)
      const { unmount } = render(
        <NodeValueEditor value={BEFORE} readout="£60,000" onCommit={onCommit} ariaLabel="Value" testId={`t-${outcome}`} />,
      )
      fireEvent.click(screen.getByTestId(`t-${outcome}`))
      fireEvent.change(screen.getByTestId(`t-${outcome}-input`), { target: { value: String(COMMITTED) } })
      fireEvent.keyDown(screen.getByTestId(`t-${outcome}-input`), { key: 'Enter' })
      expect(screen.queryByTestId(`t-${outcome}-settlement`)).toBeNull()
      unmount()
    }
  })

  it('POSITIVE CONTROL: no commit at all means no settlement word', () => {
    render(<NodeValueEditor value={BEFORE} readout="£60,000" onCommit={() => 'dispatched'} ariaLabel="Value" testId="nve" />)
    expect(screen.queryByTestId('nve-settlement')).toBeNull()
  })
})
