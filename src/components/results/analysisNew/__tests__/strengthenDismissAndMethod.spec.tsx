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
const restoreDismissed = vi.fn()
const dispute = vi.fn()

/**
 * ⚠ `selectHistory` IS NOT MOCKED. It is the real, exported store selector —
 * mocking it would leave these tests agreeing with a stub about which records
 * count as retired, which is the one thing they exist to check.
 */
vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => ({
  ...(await orig<typeof import('../../../../canvas/stores/strengthenStore')>()),
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({ records, priorityOrder: Object.keys(records), dismiss, restoreDismissed, dispute }),
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
  restoreDismissed.mockClear()
  dispute.mockClear()
})

/** A retired record, shaped as the store writes it. */
const retiredRecord = (
  id: string,
  title: string,
  status: 'dismissed' | 'addressed',
  whatChanged?: string,
) => ({
  id,
  status,
  snapshot: { id, title },
  analysisHash: null,
  isStale: false,
  history: [
    { at: 1, event: 'recommended' as const },
    { at: 2, event: status, ...(whatChanged ? { whatChanged } : {}) },
  ],
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

/**
 * ⭐⭐ THE TAIL. Measured on the deployed build `d658698a`: a real run put
 * EIGHT active recommendations in the lifecycle store, the section header read
 * its true count, and the list rendered three. The other five were not
 * collapsed and not summarised — they were sliced away one layer up, so the
 * component never held them and no affordance could have reached them.
 *
 * ⚠ THESE ASSERT IDENTITY, NEVER LENGTH. Counting rows is what produced a
 * wrong verdict on this very section a day earlier: the list backfills from
 * the queue, so `3 before, 3 after` is equally consistent with "nothing
 * happened" and with "the right thing happened" (CLAUDE.md trap 19).
 */
describe('the preview discloses its remainder, and the remainder is reachable', () => {
  const five = [1, 2, 3, 4, 5].map((n) => rec({ id: `strengthen:r${n}`, title: `Finding ${n}` }))
  const shownIds = () =>
    screen
      .getAllByTestId('analysis-new-strengthen-item')
      .map((el) => el.getAttribute('data-recommendation-id'))

  it('shows the preview, names how many are held back, and reveals exactly those', () => {
    renderOpen(<StrengthenTheReasoning interventions={five} preview={3} />)
    expect(shownIds()).toEqual(['strengthen:r1', 'strengthen:r2', 'strengthen:r3'])

    const more = screen.getByTestId('analysis-new-strengthen-show-more')
    // The number is the ACTUAL remainder, not a generic "Show more" — a reader
    // deciding whether to open it is entitled to know the size of the tail.
    expect(more).toHaveTextContent('Show 2 more')

    fireEvent.click(more)
    expect(shownIds()).toEqual([
      'strengthen:r1',
      'strengthen:r2',
      'strengthen:r3',
      'strengthen:r4',
      'strengthen:r5',
    ])

    // And back, on the same control — an expansion with no way home is a
    // one-way door on a panel 278px wide.
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-show-more'))
    expect(shownIds()).toEqual(['strengthen:r1', 'strengthen:r2', 'strengthen:r3'])
  })

  /**
   * ⚠ THE OPPOSITE DIRECTION. A control rendered unconditionally would pass
   * every assertion above while offering "Show 0 more" on a complete list.
   */
  it('offers NO affordance when the preview already holds everything', () => {
    renderOpen(<StrengthenTheReasoning interventions={five.slice(0, 3)} preview={3} />)
    expect(shownIds()).toEqual(['strengthen:r1', 'strengthen:r2', 'strengthen:r3'])
    expect(screen.queryByTestId('analysis-new-strengthen-show-more')).toBeNull()
  })
})

/**
 * ⭐⭐ THE TRAIL. "A living representation of the team's reasoning" implies a
 * history — what was raised, what was worked through, what was set aside and
 * why. The store records all of it and the legacy panel renders it; this
 * surface rendered none, so consolidating onto it would have dropped the only
 * part of the picture that is not a snapshot.
 */
describe('the reasoning trail', () => {
  it('is not offered at all when nothing has been retired', () => {
    records = { 'strengthen:robustness': { status: 'recommended', history: [] } }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:robustness' })]} />)
    expect(screen.queryByTestId('analysis-new-strengthen-history-toggle')).toBeNull()
  })

  it('lists what was set aside and what was addressed, each saying which', () => {
    records = {
      'strengthen:gone': retiredRecord('strengthen:gone', 'Define what success looks like', 'dismissed'),
      'strengthen:done': retiredRecord('strengthen:done', 'Pressure-test the leader', 'addressed', 'added a downside case'),
    }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:live' })]} />)

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-history-toggle'))
    const rows = screen.getAllByTestId('analysis-new-strengthen-history-item')
    // Bound by identity, not by position or count.
    expect(rows.map((r) => r.getAttribute('data-recommendation-id')).sort()).toEqual([
      'strengthen:done',
      'strengthen:gone',
    ])
    expect(screen.getByTestId('analysis-new-strengthen-history')).toHaveTextContent(
      'Set aside as not relevant.',
    )
    // The producer's own `whatChanged` rides through — never "Addressed: undefined".
    expect(screen.getByTestId('analysis-new-strengthen-history')).toHaveTextContent(
      'Addressed: added a downside case.',
    )
  })

  /**
   * ⚠ THE DISCRIMINATING PAIR. Restore must be offered on the row it can act on
   * and withheld on the one it cannot — a control rendered on both would pass
   * any single-direction assertion while advertising an action that no-ops on
   * an addressed record.
   */
  it('offers restore on a set-aside row, and only there', () => {
    records = {
      'strengthen:gone': retiredRecord('strengthen:gone', 'Define what success looks like', 'dismissed'),
      'strengthen:done': retiredRecord('strengthen:done', 'Pressure-test the leader', 'addressed', 'added a downside case'),
    }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:live' })]} />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-history-toggle'))

    const restores = screen.getAllByTestId('analysis-new-strengthen-history-restore')
    expect(restores).toHaveLength(1)
    const owner = restores[0].closest('[data-recommendation-id]')
    expect(owner?.getAttribute('data-recommendation-id')).toBe('strengthen:gone')

    fireEvent.click(restores[0])
    expect(restoreDismissed).toHaveBeenCalledWith('strengthen:gone')
  })
})

/**
 * ⭐⭐ DISAGREEMENT. Before this the panel's only answer to "I think this is
 * wrong" was "Not relevant" — which retires the card. The reasoning act became
 * a disappearance and the reason went unrecorded, while disagreement is
 * precisely where a team's first real insight usually surfaces.
 */
describe('recording a disagreement', () => {
  const one = [rec({ id: 'strengthen:robustness' })]

  it('is NOT offered when the store holds no record for the id (the pre-run case)', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} />)
    expect(screen.queryByTestId('analysis-new-strengthen-disagree')).toBeNull()
  })

  it('records the reason, and the finding STAYS — that is the whole difference', () => {
    records = { 'strengthen:robustness': { status: 'recommended', history: [] } }
    renderOpen(<StrengthenTheReasoning interventions={one} />)

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: 'The lead time assumption is wrong for our supplier.' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))

    expect(dispute).toHaveBeenCalledWith(
      'strengthen:robustness',
      'The lead time assumption is wrong for our supplier.',
    )
    /**
     * ⚠ THE ASSERTION THAT SEPARATES THIS FROM DISMISSAL, bound by identity
     * rather than by a count — a count cannot tell "still there" from
     * "replaced by the next item in the queue" (trap 19), which is exactly the
     * mistake that produced a wrong verdict on this section once already.
     */
    expect(
      screen
        .getAllByTestId('analysis-new-strengthen-item')
        .map((el) => el.getAttribute('data-recommendation-id')),
    ).toContain('strengthen:robustness')
    // And dismissal was NOT invoked as a side effect.
    expect(dismiss).not.toHaveBeenCalled()
  })

  it('shows the standing objection on the card, and offers to edit rather than restate', () => {
    records = {
      'strengthen:robustness': {
        status: 'recommended',
        history: [
          { at: 1, event: 'recommended' },
          { at: 2, event: 'disputed', disputeReason: 'First thought.' },
          // The LATEST one is what the user now thinks — see the note in the
          // component. An earlier objection must not be the one displayed.
          { at: 3, event: 'disputed', disputeReason: 'What I actually mean.' },
        ],
      },
    }
    renderOpen(<StrengthenTheReasoning interventions={one} />)

    const shown = screen.getByTestId('analysis-new-strengthen-disagreement')
    expect(shown).toHaveTextContent('What I actually mean.')
    expect(shown).not.toHaveTextContent('First thought.')
    expect(shown.getAttribute('data-recommendation-id')).toBe('strengthen:robustness')
    expect(screen.getByTestId('analysis-new-strengthen-disagree')).toHaveTextContent(
      'Edit what you said',
    )
  })

  it('cancelling records nothing', () => {
    records = { 'strengthen:robustness': { status: 'recommended', history: [] } }
    renderOpen(<StrengthenTheReasoning interventions={one} />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: 'typed then thought better of it' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-cancel'))
    expect(dispute).not.toHaveBeenCalled()
    expect(screen.queryByTestId('analysis-new-strengthen-disagree-form')).toBeNull()
  })
})
