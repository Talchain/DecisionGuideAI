/**
 * The dismissal, the disagreement, and the technique chip.
 *
 * ⭐⭐ HISTORY, BECAUSE IT EXPLAINS THE SHAPE OF WHAT IS PINNED HERE.
 *
 * `strengthenStore.dismiss` opens with `if (!record) return` — it SILENTLY
 * NO-OPS for an id it holds no record for. Records were created only by
 * `reconcile`, which runs on a COMPLETED analysis. Before a run the button
 * therefore did nothing, while the notice said "Recommendation dismissed" and
 * the card stayed on screen beside it. The first fix GATED the control on the
 * store holding the id, on the principle that a control which cannot act is not
 * an affordance but an advertisement.
 *
 * ⚠⚠ THAT GATE WAS THEN MEASURED ON THE DEPLOYED BUILD `fdeb08d2` AND FOUND TO
 * BE THE WRONG FIX. `reconcile` is called from ONE place — `StrengthenContainer`,
 * which mounts only on the OLD Analysis tab. This surface is deliberately
 * read-only. So on a live run the panel rendered SIX findings while the store
 * held FOUR, from an earlier run seen on the other tab: the controls appeared on
 * some cards and not others, for a reason wholly invisible to the reader. An
 * affordance that appears at random is worse than one that is simply missing.
 *
 * The gate is therefore replaced by `seedIfAbsent`, which creates the record on
 * the user's DELIBERATE ACTION — never on mount, so the read-only property that
 * keeps the two tabs comparable is preserved. What is pinned below is that the
 * controls are always offered AND that acting always seeds before it acts;
 * without the seed the action would be silently discarded, which is the original
 * defect wearing a different hat.
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
const seedIfAbsent = vi.fn()

/**
 * ⚠ `selectHistory` IS NOT MOCKED. It is the real, exported store selector —
 * mocking it would leave these tests agreeing with a stub about which records
 * count as retired, which is the one thing they exist to check.
 */
vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => ({
  ...(await orig<typeof import('../../../../canvas/stores/strengthenStore')>()),
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({ records, priorityOrder: Object.keys(records), dismiss, restoreDismissed, dispute, seedIfAbsent }),
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
  seedIfAbsent.mockClear()
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

describe('the dismissal can always act, whichever tab the reader came from', () => {
  it('is OFFERED with no store record, and SEEDS the record before dismissing', () => {
    const one = rec({ id: 'strengthen:success-measure' })
    renderOpen(<StrengthenTheReasoning interventions={[one]} analysisHash="v5:abc" />)

    const btn = screen.getByTestId('analysis-new-strengthen-dismiss')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)

    /**
     * ⚠ THE ORDER IS THE ASSERTION. `dismiss` no-ops without a record, so a
     * seed that ran afterwards — or not at all — would discard the action in
     * silence. Bound to the recommendation BY IDENTITY, and to the hash, so a
     * seed of the wrong row or an unstamped record fails here.
     */
    expect(seedIfAbsent).toHaveBeenCalledWith(one, 'v5:abc')
    expect(seedIfAbsent.mock.invocationCallOrder[0]).toBeLessThan(
      dismiss.mock.invocationCallOrder[0],
    )
    expect(dismiss).toHaveBeenCalledWith('strengthen:success-measure')
  })

  it('still dismisses when the store DOES hold the record', () => {
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

  it('carries the objection onto the trail with the finding it contests', () => {
    records = {
      'strengthen:gone': {
        ...retiredRecord('strengthen:gone', 'Define what success looks like', 'dismissed'),
        history: [
          { at: 1, event: 'recommended' },
          { at: 2, event: 'disputed', disputeReason: 'Our board measures this quarterly.' },
          { at: 3, event: 'dismissed' },
        ],
      },
    }
    renderOpen(<StrengthenTheReasoning interventions={[rec({ id: 'strengthen:live' })]} />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-history-toggle'))
    // "I disagree, and I am setting this aside" is one of the most useful
    // things a team does; the act used to survive and its content did not.
    expect(screen.getByTestId('analysis-new-strengthen-history-disagreement')).toHaveTextContent(
      'Our board measures this quarterly.',
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

  it('is OFFERED with no store record, and SEEDS before recording', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} analysisHash="v5:abc" />)

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: 'Wrong for our supplier.' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))

    // Same ordering obligation as the dismissal: `dispute` no-ops without a
    // record, so a seed that ran second would lose the objection silently.
    expect(seedIfAbsent).toHaveBeenCalledWith(one[0], 'v5:abc')
    expect(seedIfAbsent.mock.invocationCallOrder[0]).toBeLessThan(
      dispute.mock.invocationCallOrder[0],
    )
    expect(dispute).toHaveBeenCalledWith('strengthen:robustness', 'Wrong for our supplier.')
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
     * ⚠⚠ THIS BLOCK USED TO ASSERT THAT THE CARD "STAYS", BY READING THE
     * RENDERED ITEM IDS. That assertion was STRUCTURALLY INCAPABLE OF FAILING:
     * `interventions` is a PROP, so the row renders whatever the store does,
     * and it would have passed just as happily if disputing retired the record.
     * A test named for the property that distinguishes dispute from dismissal,
     * which could not observe that property, is worse than no test.
     *
     * What this layer CAN prove is that dispute does not reach for dismissal.
     * That the record SURVIVES is a store property and is proven where it
     * lives — `strengthenStore.spec.ts`, "records the reason on the history and
     * leaves the finding ACTIVE", which asserts status and `selectActive`
     * membership and REDs when `dispute` is made a disposal.
     */
    expect(dismiss).not.toHaveBeenCalled()
    expect(restoreDismissed).not.toHaveBeenCalled()
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
