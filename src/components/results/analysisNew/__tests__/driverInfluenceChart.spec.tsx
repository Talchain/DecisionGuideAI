/**
 * The influence chart draws the side the PRODUCER asserted, and refuses to
 * draw one it did not.
 *
 * ⚠⚠ THIS IS THE DEFECT THE OLD CHART STILL SHIPS. `TornadoChart` receives a
 * populated `TornadoRow.direction` and branches only on GOAL direction, so a
 * negative-direction factor (cost, churn) draws on the wrong side. Its own
 * derivation comment in `OutputsDock.tsx:1039` admits it and defers the fix to
 * a phase that shipped without it. These cases bind the new component to the
 * per-factor field, BY IDENTITY — each assertion finds its row by node id, not
 * by a value predicate another row could satisfy (CLAUDE.md trap 19).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DriverInfluenceChart } from '../sections/DriverInfluenceChart'
import type { DriverInfluenceRow } from '../analysisNewTypes'

const proposeFactorValue = vi.fn(() => 'dispatched')
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue,
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

const TID = 'chart'
afterEach(() => {
  cleanup()
  proposeFactorValue.mockReset().mockReturnValue('dispatched')
})

const row = (over: Partial<DriverInfluenceRow>): DriverInfluenceRow => ({
  id: 'f1',
  label: 'Factor one',
  fraction: 0.8,
  direction: 'positive',
  targetId: 'f1',
  ...over,
})

/** Find a row by its node id — never by position, never by a shared value. */
const byId = (id: string) =>
  screen.getAllByTestId(`${TID}-row`).find((el) => el.getAttribute('data-node-id') === id)!

function draw(rows: DriverInfluenceRow[], onCommitOutcome = vi.fn()) {
  render(<DriverInfluenceChart rows={rows} onCommitOutcome={onCommitOutcome} testId={TID} />)
  return { onCommitOutcome }
}

describe('the side comes from the factor, not from the goal', () => {
  it('a negative-direction factor draws on the LOWERS side and never on RAISES', () => {
    draw([row({ id: 'cost', label: 'Unit cost', direction: 'negative' })])
    const el = byId('cost')
    expect(el.querySelector(`[data-testid="${TID}-bar-lowers"]`)).toBeInTheDocument()
    expect(el.querySelector(`[data-testid="${TID}-bar-raises"]`)).toBeNull()
  })

  it('a positive-direction factor draws on the RAISES side and never on LOWERS', () => {
    draw([row({ id: 'cap', label: 'Sales capacity', direction: 'positive' })])
    const el = byId('cap')
    expect(el.querySelector(`[data-testid="${TID}-bar-raises"]`)).toBeInTheDocument()
    expect(el.querySelector(`[data-testid="${TID}-bar-lowers"]`)).toBeNull()
  })

  /**
   * ⚠ THE DISCRIMINATING HALF. The two cases above pass on a component that
   * always draws the same side for everything only if the OTHER assertion
   * fails — so both must hold IN ONE RENDER, on rows that differ only in
   * direction, or the pair proves sensitivity to something and not to the
   * field. Same fraction on both, so the bar geometry cannot be the tell.
   */
  it('two rows differing ONLY in direction land on opposite sides in one render', () => {
    draw([
      row({ id: 'up', label: 'Retention', direction: 'positive', fraction: 0.6 }),
      row({ id: 'down', label: 'Churn', direction: 'negative', fraction: 0.6 }),
    ])
    expect(byId('up').querySelector(`[data-testid="${TID}-bar-raises"]`)).toBeInTheDocument()
    expect(byId('up').querySelector(`[data-testid="${TID}-bar-lowers"]`)).toBeNull()
    expect(byId('down').querySelector(`[data-testid="${TID}-bar-lowers"]`)).toBeInTheDocument()
    expect(byId('down').querySelector(`[data-testid="${TID}-bar-raises"]`)).toBeNull()
  })
})

describe('a direction the producer declined to assert is SAID, not guessed', () => {
  it('a null-direction row draws neither side and states that direction was not established', () => {
    draw([row({ id: 'mix', label: 'Market timing', direction: null })])
    const el = byId('mix')
    expect(el.querySelector(`[data-testid="${TID}-bar-raises"]`)).toBeNull()
    expect(el.querySelector(`[data-testid="${TID}-bar-lowers"]`)).toBeNull()
    expect(el.querySelector(`[data-testid="${TID}-no-direction"]`)).toBeInTheDocument()
  })

  /**
   * ⚠ THE MAGNITUDE SURVIVES THE MISSING DIRECTION. A row the producer
   * measured and declined to give a side is NOT a row with no influence, and
   * rendering it as an empty line beside two barred neighbours would say
   * exactly that.
   */
  it('and it still carries its measured magnitude', () => {
    draw([row({ id: 'mix', direction: null, fraction: 0.73 })])
    expect(byId('mix').querySelector(`[data-testid="${TID}-bar"]`)).toHaveAttribute(
      'data-fraction',
      '73',
    )
  })

  it('a directional row does NOT carry the not-established sentence', () => {
    draw([row({ id: 'up', direction: 'positive' })])
    expect(byId('up').querySelector(`[data-testid="${TID}-no-direction"]`)).toBeNull()
  })
})

describe('a bar is an edit, not a picture', () => {
  it('clicking a bar opens the value editor for THAT row only', async () => {
    const user = userEvent.setup()
    draw([row({ id: 'a', label: 'Alpha' }), row({ id: 'b', label: 'Beta' })])
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    expect(byId('a').querySelector(`[data-testid="${TID}-editor"]`)).toBeInTheDocument()
    expect(byId('b').querySelector(`[data-testid="${TID}-editor"]`)).toBeNull()
  })

  it('a typed value reaches the write authority as a number', async () => {
    const user = userEvent.setup()
    draw([row({ id: 'a' })])
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    await user.type(screen.getByTestId(`${TID}-input`), '42')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(proposeFactorValue).toHaveBeenCalledWith(42)
  })

  /**
   * ⚠⚠ THE THREE OUTCOMES ARE NOT COLLAPSED. `proposeFactorValue` answers
   * three different truths and a caller that reported one word over all three
   * would claim a server acceptance it never observed.
   */
  it.each([
    ['dispatched', 'dispatched'],
    ['local_only', 'local_only'],
    ['not_encodable', 'not_encodable'],
  ])('reports %s verbatim to its caller', async (returned, expected) => {
    const user = userEvent.setup()
    proposeFactorValue.mockReturnValue(returned as 'dispatched')
    const onCommitOutcome = vi.fn()
    draw([row({ id: 'a' })], onCommitOutcome)
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    await user.type(screen.getByTestId(`${TID}-input`), '5')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(onCommitOutcome).toHaveBeenCalledWith(expected)
  })

  /** Nothing was written anywhere, so closing would read as a success. */
  it('the editor STAYS OPEN when nothing could be written', async () => {
    const user = userEvent.setup()
    proposeFactorValue.mockReturnValue('not_encodable')
    draw([row({ id: 'a' })])
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    await user.type(screen.getByTestId(`${TID}-input`), '5')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(byId('a').querySelector(`[data-testid="${TID}-editor"]`)).toBeInTheDocument()
  })

  it('and it CLOSES when the edit was dispatched', async () => {
    const user = userEvent.setup()
    draw([row({ id: 'a' })])
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    await user.type(screen.getByTestId(`${TID}-input`), '5')
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(byId('a').querySelector(`[data-testid="${TID}-editor"]`)).toBeNull()
  })

  /** `Number('')` is 0 — a blank field must not dispatch a zero. */
  it('a blank field dispatches nothing at all', async () => {
    const user = userEvent.setup()
    const { onCommitOutcome } = draw([row({ id: 'a' })])
    await user.click(byId('a').querySelector(`[data-testid="${TID}-bar"]`) as HTMLElement)
    await user.click(screen.getByTestId(`${TID}-save`))
    expect(proposeFactorValue).not.toHaveBeenCalled()
    expect(onCommitOutcome).toHaveBeenCalledWith('not_encodable')
  })
})

describe('the chart refuses to be furniture', () => {
  it('no rows renders nothing at all', () => {
    const { container } = render(
      <DriverInfluenceChart rows={[]} onCommitOutcome={vi.fn()} testId={TID} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
