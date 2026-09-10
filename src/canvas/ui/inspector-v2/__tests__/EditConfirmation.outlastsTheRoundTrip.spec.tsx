/**
 * A confirmation must outlive the thing it confirms.
 *
 * ⚠⚠ MEASURED ON THE DEPLOYED BUILD, NOT REASONED ABOUT. `EditConfirmation`
 * hid after 1500ms. A `factor_value_edit` round trip on staging takes ~1800ms
 * (1756 / 1801 / 2019ms, driven as a guest). So the send-outcome state added
 * for the factor value was STRUCTURALLY UNOBSERVABLE: the notice always faded
 * before the dispatcher resolved, and "Sent to Olumi" could never be seen by
 * anyone. The suite was green the whole time — nothing in jsdom has latency.
 *
 * ⭐ THE DURABLE POINT: a timing constant and a network round trip are two
 * different quantities, and no unit test compares them. This one does, against
 * a MEASURED figure rather than a guessed one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { EditConfirmation } from '../shared/EditConfirmation'

/** The slowest round trip actually measured on staging, not a round number. */
const MEASURED_SLOWEST_TURN_MS = 2019

describe('the notice survives a real round trip', () => {
  // ⚠ Braces, not an implicit return: `vi.useFakeTimers()` returns `VitestUtils`,
  // which TypeScript reads as a hook CLEANUP CALLBACK. Green under vitest, red
  // under the typecheck gate — which is the whole reason the gate runs separately.
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('HELD — still on screen after the slowest turn we have measured', () => {
    render(<EditConfirmation trigger={1} label="Sending to Olumi…" tone="pending" hold />)
    expect(screen.getByText('Sending to Olumi…')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(MEASURED_SLOWEST_TURN_MS + 500) })

    // Before `hold` existed this was gone at 1500ms — 519ms before the answer.
    expect(screen.getByText('Sending to Olumi…')).toBeTruthy()
  })

  it('CONTRAST — unheld, it still fades, so `hold` has not simply pinned it forever', () => {
    // ⭐ Without this the case above passes on a change that removed the timer
    // altogether, leaving a notice that never clears.
    render(<EditConfirmation trigger={1} label="Updated" />)
    expect(screen.getByText('Updated')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1600) })
    expect(screen.queryByText('Updated')).toBeNull()
  })

  it('the terminal answer gets its OWN full window, not the remains of the previous one', () => {
    // The label changes when the dispatcher resolves. If the timer were keyed
    // only on `trigger`, "Sent to Olumi" would inherit whatever was left of the
    // sending window and could flash for a few milliseconds.
    const { rerender } = render(
      <EditConfirmation trigger={1} label="Sending to Olumi…" tone="pending" hold />,
    )
    act(() => { vi.advanceTimersByTime(1800) })

    rerender(<EditConfirmation trigger={1} label="Sent to Olumi" tone="pending" />)
    expect(screen.getByText('Sent to Olumi')).toBeTruthy()

    // Nearly a full window later it is still there — it did not inherit an
    // already-expired one.
    act(() => { vi.advanceTimersByTime(1400) })
    expect(screen.getByText('Sent to Olumi')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.queryByText('Sent to Olumi')).toBeNull()
  })

  it('a LABEL change alone restarts the window — trigger and hold unchanged', () => {
    // ⚠ THIS CASE EXISTS BECAUSE A MUTANT SURVIVED. Dropping `label` from the
    // effect's dependencies REDded nothing: the case above rerenders with
    // `hold` going true → false, and `hold` is itself a dependency, so the
    // effect re-ran for a reason that had nothing to do with the label. The
    // test asserted the right behaviour for the wrong reason.
    //
    // Here `trigger` and `hold` are both held constant, so ONLY the label can
    // restart the timer. If it cannot, the second label inherits the remains of
    // the first window and vanishes early.
    const { rerender } = render(<EditConfirmation trigger={7} label="First" tone="pending" />)
    act(() => { vi.advanceTimersByTime(1400) })
    expect(screen.getByText('First')).toBeTruthy()

    rerender(<EditConfirmation trigger={7} label="Second" tone="pending" />)
    // Only 100ms of the ORIGINAL window remained. A fresh one must have begun.
    act(() => { vi.advanceTimersByTime(1400) })
    expect(screen.getByText('Second')).toBeTruthy()
  })

  it('a pending tone never renders the success tick', () => {
    // "Sending" and "Sent" are both pending: neither is a claim the SERVER
    // applied the value, which this panel cannot observe.
    const { container } = render(
      <EditConfirmation trigger={1} label="Sending to Olumi…" tone="pending" hold />,
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('[data-tone="pending"]')).not.toBeNull()
  })
})
