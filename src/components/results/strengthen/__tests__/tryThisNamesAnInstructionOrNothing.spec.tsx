/**
 * "Try this" names a practical move, or it does not appear.
 *
 * ⭐ THE DEFECT, MEASURED ON THE DEPLOYED BUILD (`e685dafa`, fresh guest,
 * "Strengthen the reasoning" offering 6 cards):
 *
 *   1  Pick the number that would make this decision a win, and the date it matters by.
 *   2  Work through it with Olumi.
 *   3  Work through it with Olumi.
 *   4  Work through it with Olumi.
 *   5  Work through it with Olumi.
 *   6  Note the chosen option, the key assumptions, and the one change that would reopen this.
 *
 * FOUR OF SIX said the same nothing — each directly above a button reading
 * "Work through with Olumi". The same seven words twice per card, eight times
 * in one section.
 *
 * ⚠⚠ AND IT WAS A RESTATEMENT IN BOTH BRANCHES, NOT ONLY IN THE FALLBACK.
 * `tryThis: item.actionLabel ?? 'Work through it with Olumi.'` — when the
 * producer DOES supply `actionLabel`, that same string becomes `action.label`
 * on the button four lines below. On the producer path this field never once
 * added information over the control beneath it, while the type's own doc
 * calls it "one practical instruction".
 *
 * ⭐ WHY IT IS WORTH A SPEC RATHER THAN A TIDY-UP. The hand-authored values in
 * the same file are real decision-science moves — "Build the strongest case
 * AGAINST the current leader and see if it survives". That is the coaching this
 * product exists to give, and one line of boilerplate was outnumbering it two
 * to one. The pins below are therefore a PAIR: the producer path must name
 * nothing, AND the catalogue paths must still name their instruction. Either
 * one alone would pass under a blanket change that deleted the feature.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { buildRecommendations } from '../buildRecommendations'
import { StrengthenPanel } from '../StrengthenPanel'
import { STRENGTHEN_COPY } from '../strengthenCopy'
import type { Recommendation, StrengthenInputs } from '../strengthenTypes'
import { resolveFactorConfidenceDisplay } from '../../driverConfidenceDisplayPolicy'
import type { RecRecord } from '../../../../canvas/stores/strengthenStore'

/** The exact string that shipped. Pinned so a re-introduction REDs by name. */
const SHIPPED_PLACEHOLDER = 'Work through it with Olumi.'

const base: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

/** A fragile edge produces the CATALOGUE flip recommendation. */
const FRAGILE = [{ edgeId: 'e1', factorLabel: 'Salary cost', switchProbability: 0.62 }]

describe('the producer path names no instruction rather than restating its own button', () => {
  it('emits null — not the placeholder, and not the action label either', () => {
    const recs = buildRecommendations({
      ...base,
      phase3Items: [
        { id: 'p-1', title: 'Add a competitive-pressure factor', body: 'Nothing represents rivals.', targetIds: [] },
        // ⚠ THE SECOND CASE IS THE ONE THE ORIGINAL FIX ATTEMPT WOULD MISS.
        // With `actionLabel` PRESENT the old code put that string in BOTH
        // slots, so a change that only replaced the `??` fallback would leave
        // this card still saying its button twice.
        {
          id: 'p-2',
          title: 'Check the large-account assumption',
          body: 'It carries the most weight.',
          actionLabel: 'Review this assumption',
          targetIds: [],
        },
      ],
    })
    const produced = recs.filter((r) => r.id.startsWith('strengthen:phase3:'))
    expect(produced.length, 'the fixture must actually produce producer rows').toBe(2)
    for (const r of produced) {
      expect(r.tryThis, `${r.id} still names an instruction`).toBeNull()
    }
    // The button keeps the producer's label — the words are not lost, only
    // said once, where they are pressable.
    expect(produced[1].action.label).toBe('Review this assumption')
  })

  /**
   * ⭐⭐ THE DISCRIMINATING TWIN — AND IT PINS THE EXACT SET, NOT A COUNT.
   *
   * ⚠ THIS TEST'S FIRST VERSION WAS TOO WEAK AND A MUTANT PROVED IT. It drove
   * ONE input (a fragile edge), collected `filter(r => r.tryThis !== null)`,
   * and asserted the list was non-empty. Nulling the ROBUSTNESS instruction —
   * "Build the strongest case AGAINST the current leader and see if it
   * survives" — left it fully GREEN, because that branch was not in the set the
   * fixture produced. A guard watching one door: it proved SOME catalogue
   * instruction survives, never that THESE ones do, so a blanket deletion of
   * the coaching this PR exists to protect would have shipped unnoticed.
   *
   * The set below is derived by BUILDING, not read off the source, and it is
   * asserted exactly — so it REDs if one is deleted (shrinks) AND if a
   * producer row starts inventing one again (grows).
   */
  it('every catalogue branch still names its own move — the exact set, not a count', () => {
    const recs = buildRecommendations({
      ...base,
      goalThreshold: null,
      fragileEdges: FRAGILE,
      robustness: { status: 'computed', level: 'low' },
      biasFindingTypes: ['narrow_framing'],
      factors: [
        {
          factorId: 'f1',
          label: 'Churn',
          worthInvestigating: true,
          canFocus: true,
          // The production resolver's own output for an absent confidence —
          // never a hand-shaped object, which is how the first attempt at this
          // fixture crashed inside the builder.
          confidenceDisplay: resolveFactorConfidenceDisplay({ confidence: null }, true),
        },
      ],
      // A producer row in the SAME build, so the assertion is about which rows
      // carry an instruction, not about which fixture was used.
      phase3Items: [{ id: 'p-1', title: 'Add a competitive-pressure factor', targetIds: [] }],
    } as StrengthenInputs)

    const named = recs.filter((r) => r.tryThis !== null).map((r) => r.id).sort()
    expect(named).toEqual([
      'strengthen:broaden',
      'strengthen:flip:e1',
      'strengthen:robustness',
      'strengthen:success-measure',
      'strengthen:voi:f1',
    ])

    for (const r of recs.filter((r) => r.tryThis !== null)) {
      expect(r.tryThis).not.toBe(SHIPPED_PLACEHOLDER)
      // An instruction is a sentence, not a restatement of a button label.
      expect(r.tryThis!.split(' ').length, `${r.id}: "${r.tryThis}"`).toBeGreaterThan(4)
      expect(r.tryThis, `${r.id} restates its own button`).not.toBe(r.action.label)
    }
  })

  /**
   * ⚠ `strengthen:commit` CANNOT FIRE ALONGSIDE THE OTHERS — its trigger is
   * `analysisComplete && robustness.status === 'computed' && level === 'high'`,
   * and the set above needs `level: 'low'` to fire `robustness`. Two mutually
   * exclusive readiness states, so it needs its own build; without this case
   * the sixth catalogue instruction would sit outside every assertion, which is
   * exactly the hole a mutant found in this file's first version.
   */
  it('the commit instruction — the one the set above structurally cannot reach', () => {
    const recs = buildRecommendations({
      ...base,
      robustness: { status: 'computed', level: 'high' },
    })
    const commit = recs.find((r) => r.id === 'strengthen:commit')
    expect(commit, 'the fixture failed to fire the commit branch').toBeDefined()
    expect(commit!.tryThis).not.toBeNull()
    expect(commit!.tryThis).not.toBe(commit!.action.label)
    expect(commit!.tryThis!.split(' ').length).toBeGreaterThan(4)
  })

  it('the shipped placeholder appears nowhere in a built set', () => {
    const recs = buildRecommendations({ ...base, fragileEdges: FRAGILE, phase3Items: [
      { id: 'p-1', title: 'Add a competitive-pressure factor', targetIds: [] },
    ] })
    expect(recs.length).toBeGreaterThan(1)
    expect(recs.map((r) => r.tryThis)).not.toContain(SHIPPED_PLACEHOLDER)
  })
})

describe('the panel omits the line entirely rather than printing a lead-in with nothing after it', () => {
  const rec = (tryThis: string | null): Recommendation =>
    ({
      id: 'r1',
      title: 'A finding',
      signal: 'a signal',
      whyNow: 'why it matters now',
      tryThis,
      sourceLine: 'Source: Olumi model review.',
      action: { kind: 'ai-dialogue', label: 'Work through with Olumi', actionType: 'discuss', prompt: 'p' },
      targetId: null,
      priority: 10,
    }) as Recommendation

  const record = (tryThis: string | null): RecRecord => ({
    id: 'r1',
    status: 'recommended',
    snapshot: rec(tryThis),
    analysisHash: 'h1',
    isStale: false,
    history: [{ at: 1, event: 'recommended' }],
  }) as RecRecord

  const noop = () => {}
  const renderOne = (tryThis: string | null) =>
    render(
      <StrengthenPanel
        active={[record(tryThis)]}
        history={[]}
        addressedCount={0}
        onPrimaryAction={noop}
        onWorkThrough={noop}
        onNotRelevant={noop}
        onMarkAddressed={noop}
      />,
    )

  afterEach(cleanup)

  it('renders no "Try this" lead-in when there is no instruction', () => {
    renderOne(null)
    // The row must actually be on screen, or this asserts nothing.
    expect(screen.getByText('A finding')).toBeInTheDocument()
    expect(screen.queryByText(STRENGTHEN_COPY.tryThisLead)).not.toBeInTheDocument()
    // The action itself is untouched — the card still offers its route.
    expect(screen.getByText('Work through with Olumi')).toBeInTheDocument()
  })

  /** The twin: the lead-in must still render when there IS something to try. */
  it('renders the lead-in and the instruction when one is named', () => {
    renderOne('Build the strongest case against the leader and see if it survives.')
    expect(screen.getByText(STRENGTHEN_COPY.tryThisLead)).toBeInTheDocument()
    expect(screen.getByText(/Build the strongest case against the leader/)).toBeInTheDocument()
  })
})
