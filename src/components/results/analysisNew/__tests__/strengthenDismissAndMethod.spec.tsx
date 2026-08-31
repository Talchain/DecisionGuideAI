/**
 * The dismissal control, and the technique chip.
 *
 * ⭐⭐ THE FIRST DESCRIBE BLOCK EXISTS BECAUSE OF A DEFECT WITNESSED ON THE
 * DEPLOYED BUILD `3378415d`, not because of a hypothesis.
 *
 * `strengthenStore.dismiss` opens with `if (!record) return` — it SILENTLY
 * NO-OPS for an id it holds no record for, and records are only created by
 * `reconcile`, which runs on a COMPLETED analysis. Before a run the button
 * therefore did nothing, while the notice said "Recommendation dismissed" and
 * the card stayed on screen beside it.
 *
 * A control that cannot act is not an affordance, it is an advertisement. The
 * button is not offered unless the store can actually retire the id, and that
 * is what these cases pin — in both directions, because a guard that only ever
 * hides the control would be just as wrong.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()),
  markKindForTarget: () => null,
}))

/** Records the component sees. Mutated per test. */
let records: Record<string, unknown> = {}
const dismiss = vi.fn()

vi.mock('../../../../canvas/stores/strengthenStore', () => ({
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({ records, dismiss, restoreDismissed: vi.fn() }),
}))

import { openAskOlumi } from '../../coaching/askOlumiStore'

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test the leading option',
    signal: 'The ranking was fragile under perturbation.',
    whyNow: 'Small changes flip which option leads.',
    tryThis: 'Imagine it failed. Write down why.',
    sourceLine: 'From the robustness check.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
    priority: 1,
    ...over,
  }) as Recommendation

const renderOpen = (ui: React.ReactElement) => {
  const r = render(ui)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  records = {}
  dismiss.mockClear()
})

describe('the dismissal is offered only when it can actually act', () => {
  it('is ABSENT when the store holds no record for the id (the pre-run case)', () => {
    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: 'strengthen:success-measure' })]} />,
    )
    expect(screen.queryByTestId('analysis-new-strengthen-dismiss')).toBeNull()
  })

  /**
   * ⭐ THE OPPOSITE DIRECTION, AND IT IS THE ONE THAT KEEPS THE GUARD HONEST. A
   * predicate that always hid the button would pass the case above and remove
   * the feature. This proves it appears when the store CAN retire the id.
   */
  it('is PRESENT, and dismisses, when the store holds the record', () => {
    records = { 'strengthen:robustness': { status: 'recommended', history: [] } }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:robustness' })]} />)

    const btn = screen.getByTestId('analysis-new-strengthen-dismiss')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)

    expect(dismiss).toHaveBeenCalledWith('strengthen:robustness')
    // The notice names what went, so undo is a choice rather than a guess.
    expect(screen.getByTestId('analysis-new-strengthen-dismissed-notice')).toHaveTextContent(
      'Pressure-test the leading option',
    )
    expect(screen.getByTestId('analysis-new-strengthen-dismissed-undo')).toBeInTheDocument()
  })
})

describe('the technique chip', () => {
  it('names the method on a finding that IS that technique, and carries its identity', () => {
    records = { 'strengthen:robustness': { status: 'recommended', history: [] } }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:robustness' })]} />)

    const chip = screen.getByTestId('analysis-new-strengthen-method')
    expect(chip).toHaveTextContent('Run a pre-mortem')
    fireEvent.click(chip)

    /**
     * ⚠ `parameters` and `source` are the load-bearing half. Without them the
     * drawer still opens with the right prompt and nothing LOOKS broken — CEE
     * simply never learns which technique was invoked, and the chip is
     * decoration. `ActionsMenu` passes both for exactly this reason.
     */
    expect(openAskOlumi).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Run a pre-mortem',
        parameters: { method_id: 'pre_mortem' },
        source: 'chip',
        // The FINDING is the context — that is the point of attaching a
        // technique to a trigger rather than listing it in a menu.
        context: 'Small changes flip which option leads.',
      }),
    )
  })

  it('renders NO chip on a finding no technique matches', () => {
    renderOpen(
      <StrengthenTheReasoning interventions={[rec({ id: 'strengthen:success-measure' })]} />,
    )
    expect(screen.queryByTestId('analysis-new-strengthen-method')).toBeNull()
  })
})
