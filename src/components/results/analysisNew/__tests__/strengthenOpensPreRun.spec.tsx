/**
 * Analysis (New) — THE PRE-RUN PANEL'S ONE PIECE OF COACHING IS ON SCREEN.
 *
 * ⚠⚠ THE DEFECT, DERIVED AT THE MOUNTED RENDER PATH ON `staging` (`3b2df4ce`).
 * Rendering `AnalysisNewTabBody` pre-run against the repo's own fixture and a
 * four-node model, the panel's ENTIRE text ended:
 *
 *   "…Pick a mark to show that part of the model on the canvas.
 *    Strengthen the reasoning1"
 *
 * — a collapsed row, a bare "1", and nothing else. Every testid under
 * `analysis-new-strengthen` was header furniture: `-toggle`, `-title`,
 * `-count`. No `-region`, so no `-item`, so not one word of the finding.
 *
 * ⭐ AND THE THING BEHIND THAT "1" IS EXACTLY WHAT THE READER NEEDS. Pre-run
 * the only recommendation the engine can ground is the success-measure one —
 * `buildRecommendations` mints it from the model, not from a run — and it is
 * the ONLY surface on this tab that says WHY the gap matters:
 *
 *   "Without a target the analysis cannot say how likely each option is to
 *    succeed, only how they compare with one another."
 *
 * `successTargetAskedOnce.spec.tsx` already reasons that this row "keeps its
 * place" for precisely that reason, and `StrengthenTheReasoningProps.analysisHash`
 * already documents the state: "Absent pre-run, which is correct: a pre-run
 * finding is grounded in the MODEL, not in any run." The finding was built,
 * grounded, counted — and put behind a click the reader had no reason to make.
 * That is this estate's first chronic failure ("we build more than we plug in")
 * at the scale of one disclosure row.
 *
 * ── WHAT IS UNDER TEST, AND WHY IT IS NOT "OPEN THE SECTION" ────────────────
 * The collapsed IA is a MEASURED design decision, not a default nobody thought
 * about: `SectionShell`'s header records the panel at 1,584px against a 769px
 * viewport before it landed. Opening this section unconditionally would spend
 * that back. The property is narrower, and every limb below names the test that
 * covers it — so the completeness claim is checkable rather than asserted:
 *
 *   pre-run AND there is a finding   → open
 *                                      ("the section is open and its region is
 *                                      mounted")
 *   pre-run AND there is none        → closed (a forced-open empty state is
 *                                      not the fix)
 *                                      ("pre-run with nothing to say stays
 *                                      CLOSED")
 *   a run is displayed               → closed, exactly as before (a FRESH
 *                                      mount — this is the limb that keeps the
 *                                      1,584px budget)
 *                                      ("a displayed run leaves the section
 *                                      CLOSED, as before" and "but a reader who
 *                                      lands on a completed run still meets a
 *                                      collapsed row")
 *   pre-run → run displayed          → STAYS OPEN. The section is already
 *                                      mounted, so `SectionShell`'s
 *                                      `useState(defaultOpen)` is not re-read
 *                                      and the reader keeps what they were
 *                                      reading, composer draft included
 *                                      ("the section the reader was reading
 *                                      stays open across the transition" and
 *                                      "an in-progress disagreement survives a
 *                                      run completing")
 *   the reader closes it             → it stays closed (a default, not a lock)
 *                                      ("the reader can close it, and it stays
 *                                      closed")
 *
 * ⚠ THAT FOURTH LIMB READ "closes (the opening is SCOPED to the state, never a
 * sticky override)" until this correction, which is the INVERSE of what the
 * file has always asserted at "the section the reader was reading stays open
 * across the transition" (`data-section-open` === 'true' after the rerender).
 * It was stale text from a first cut that re-keyed the component and was
 * measured to destroy the reader's unsaved "I disagree" text; the SCOPE claim
 * it was trying to make lives in the fresh-mount limb above, not here.
 *
 * ── ⭐ REASONING V2 (24 Sep 2026): THE WALL IS GONE, THE FINDINGS ARE NOT ────
 * "Strengthen the reasoning" is no longer mounted on this tab. Its findings
 * are split between two V2 surfaces, both of which render PRE-RUN:
 *   · `ChallengeCard` (`analysis-new-challenge`) shows ONE at rest — the body's
 *     `glancePrimary`, i.e. the first finding the model strip is not already
 *     offering as its own control;
 *   · `ModelReviewTool` (`analysis-new-review`) queues the rest, one at a time,
 *     behind "N to review" (`buildReviewQueue`, which excludes the card's one).
 * So the question this file asks is re-pointed from "is the section open?" to
 * "is every pre-run finding REACHABLE, by identity, with its reason?". The
 * default-open limb is RETIRED (X): V2 collapses the review tool by design, and
 * the replacement below asserts one press opens it onto the finding.
 * ⛔ The "I disagree" limb is NOT re-pointed: V2 has no disagreement composer
 * on this tab (see that test). It is reported as a regression, not edited.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { SUCCESS_MEASURE_RECOMMENDATION_ID } from '../../strengthen/buildRecommendations'
import { REVIEW_TOOL_COPY } from '../buildReviewQueue'
import { genuineDecision, makeData, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/**
 * ⚠ A REAL MODEL, NOT AN EMPTY CANVAS. `ModelStrip` renders nothing without
 * rows, and an empty canvas would starve half the panel — making every
 * assertion below pass or fail for a reason other than the one under test.
 */
const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Board wants NRR above 110%' } },
  { id: 'o1', type: 'option', data: { label: 'Ship usage pricing' } },
  { id: 'o2', type: 'option', data: { label: 'Hold current strategy' } },
  { id: 'f1', type: 'factor', data: { label: 'Enterprise churn risk' } },
]

/**
 * A model whose goal DOES carry a stated target, so the engine mints no
 * success-measure recommendation and the pre-run section has nothing behind it.
 * Derived, not assumed: `buildRecommendations` gates that row on
 * `hasStatedGoalTarget`, and the count assertion below proves the gate held.
 */
const targetAlreadySet = (): ResultsSectionDataReturn =>
  makeData({
    recommendation: {
      hasGoalTarget: true,
      goalThreshold: 0.8,
      allOptions: [],
      recommendedOption: null,
    },
  })

afterEach(cleanup)

const draw = (data: ResultsSectionDataReturn, isPreRun: boolean) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={isPreRun}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )

const REVIEW = 'analysis-new-review'
const CHALLENGE = 'analysis-new-challenge'
const PRODUCER_ID = 'strengthen:phase3:g_narrow'

/** Open the V2 review tool, if it is offering anything. */
const openReview = (): void => {
  const toggle = screen.getByTestId(`${REVIEW}-toggle`)
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
}

/**
 * Every key in the review queue, BY IDENTITY, read by paging the one-at-a-time
 * tool from its first item to its last. `[]` when the tool offers nothing.
 */
const reviewQueueKeys = (): string[] => {
  if (screen.queryByTestId(`${REVIEW}-toggle`) === null) return []
  openReview()
  const prev = () => screen.getByTestId(`${REVIEW}-prev`) as HTMLButtonElement
  const next = () => screen.getByTestId(`${REVIEW}-next`) as HTMLButtonElement
  for (let guard = 0; !prev().disabled && guard < 50; guard += 1) fireEvent.click(prev())
  const keys: string[] = []
  for (let guard = 0; guard < 50; guard += 1) {
    keys.push(screen.getByTestId(`${REVIEW}-item`).getAttribute('data-review-key') ?? '')
    if (next().disabled) break
    fireEvent.click(next())
  }
  return keys
}

/** The finding the Challenge card shows at rest, by engine id, or null. */
const challengeFindingId = (): string | null => {
  const card = screen.queryByTestId(CHALLENGE)
  return card?.getAttribute('data-source') === 'intervention'
    ? card.getAttribute('data-recommendation-id')
    : null
}

/**
 * Every ENGINE FINDING the panel offers, wherever V2 put it: the card's one
 * plus the queue's recommendation items. Verify-list factors (`factor:<id>`)
 * are not findings and are excluded, so the count is the engine's.
 */
const groundedFindingIds = (): string[] => {
  const card = challengeFindingId()
  const queued = reviewQueueKeys().filter((k) => !k.startsWith('factor:'))
  return card === null ? queued : [card, ...queued]
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {} })
  useGuidanceStore.setState({ guidanceItems: [] } as never)
})

describe('THE INSTRUMENT — the precondition, pinned in test', () => {
  /**
   * ⭐⭐ WITHOUT THIS EVERY ASSERTION BELOW IS VACUOUS. "The finding is
   * reachable" says nothing if there is no finding, and a harness that silently
   * stopped producing the pre-run recommendation would satisfy the empty twin
   * for entirely the wrong reason (CLAUDE.md trap 13b).
   *
   * V2: read off the review tool's own count AND by identity across both
   * surfaces, so a copy edit to "N to review" cannot make it vacuous.
   */
  it('pre-run, the engine really does ground exactly one finding', () => {
    draw(openStrategicChallenge(), true)
    expect(screen.getByTestId(`${REVIEW}-count`)).toHaveTextContent(REVIEW_TOOL_COPY.toReview(1))
    expect(groundedFindingIds()).toEqual([SUCCESS_MEASURE_RECOMMENDATION_ID])
  })

  /** The opposite precondition, for the empty twin: this model grounds NONE. */
  it('with a target already stated, the engine grounds none', () => {
    draw(targetAlreadySet(), true)
    // Contrast: the review tool IS mounted (its whole-framing ask is always
    // there), so the absent entry below is the queue being empty, not a
    // failed render.
    expect(screen.getByTestId(`${REVIEW}-ask-framing`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${REVIEW}-toggle`)).toBeNull()
    expect(groundedFindingIds()).toEqual([])
  })
})

describe('pre-run, the coaching is REACHABLE, not promised', () => {
  /**
   * ⛔ RETIRED (X): "the section is open and its region is mounted". V2 removed
   * the Strengthen wall from this tab; its findings are the review tool's
   * queue, which is collapsed by design ("N to review"). The V2 replacement:
   * the entry renders pre-run, and ONE press opens it onto the finding.
   */
  it('V2: the review entry renders pre-run, and one press opens the finding', () => {
    draw(openStrategicChallenge(), true)
    const toggle = screen.getByTestId(`${REVIEW}-toggle`)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${REVIEW}-item`)).toBeInTheDocument()
  })

  /**
   * ⭐ BOUND BY IDENTITY, NOT BY A TEXT PREDICATE. Another item could satisfy
   * "a row is on screen"; this must be THE finding about the gap that blocks
   * measurement, so it is matched on the engine's own id (CLAUDE.md trap 19).
   */
  it('the row on screen is the gap that blocks measurement', () => {
    draw(openStrategicChallenge(), true)
    openReview()
    expect(screen.getByTestId(`${REVIEW}-item`)).toHaveAttribute(
      'data-review-key',
      SUCCESS_MEASURE_RECOMMENDATION_ID,
    )
  })

  /**
   * ⚠ AND THE SENTENCE THAT MAKES THE ROW WORTH OPENING FOR. The strip's
   * "Set a target" control states the gap; only this finding says what it
   * costs. If the copy is ever moved elsewhere this REDs, which is correct.
   */
  it('and it carries the reason the gap matters', () => {
    draw(openStrategicChallenge(), true)
    openReview()
    expect(screen.getByTestId(`${REVIEW}-reason`)).toHaveTextContent(
      'the analysis cannot say how likely each option is to succeed',
    )
  })
})

describe('the opening is SCOPED — every other limb is unchanged', () => {
  /**
   * ⭐⭐ THE DISCRIMINATING TWIN. A panel that opened its review on every run
   * would destroy the collapsed IA that `SectionShell`'s header measured at
   * 1,584px. V2: a displayed run leaves the review tool closed.
   */
  it('a displayed run leaves the section CLOSED, as before', () => {
    draw(genuineDecision(), false)
    // Precondition: there IS something to open, so "closed" is a state and
    // not an absence.
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${REVIEW}-item`)).toBeNull()
  })

  /**
   * ⛔⛔ V2 FIDELITY (24 Sep 2026) RETIRED — NOT RE-POINTED, AND HERE IS WHY.
   *
   * This asserted "no sibling section was opened either — this is not 'open
   * everything'", using `analysis-new-options` as the discriminating sibling.
   * Gap 17 makes that section `bare` — no `SectionShell`, always visible by
   * design (the fidelity finding this gap fixes) — so it is no longer a
   * `SectionShell` sibling with a closed state to be in at all; asserting
   * `data-section-open` on it now reads `null` unconditionally, which is not
   * evidence about the review tool's scope, only about this section's own
   * (now-retired) disclosure.
   *
   * ⚠ NO SUBSTITUTE SIBLING EXISTS ON THIS FIXTURE. `genuineDecision()` (the
   * fixture this case renders) carries one driver — which the file's own
   * comment above already excludes as a candidate, since `AnalysisNewSection`
   * opens a single-item section by design — and no key-insights or
   * uncertainty findings at all, so those sections do not mount here to be
   * checked either. Reaching for a richer fixture would test a different
   * scenario under this case's name rather than re-point this one.
   *
   * ⭐ THE PROPERTY ITSELF IS NOT LOST. `collapsedIA.spec.tsx`'s "mounts every
   * section CLOSED" case is the general form of "opening one thing does not
   * open its siblings" — it renders every `SectionShell` sibling on a richer
   * fixture and asserts each is closed, unconditionally, which is strictly
   * stronger than this one case naming a single sibling.
   */

  /**
   * ⚠ AN EMPTY TOOL IS NOT WORTH A VIEWPORT. With nothing grounded the review
   * offers no entry to open at all, and nothing is open.
   */
  it('pre-run with nothing to say stays CLOSED', () => {
    draw(targetAlreadySet(), true)
    expect(screen.queryByTestId(`${REVIEW}-toggle`)).toBeNull()
    expect(screen.queryByTestId(`${REVIEW}-item`)).toBeNull()
    expect(screen.queryByTestId(CHALLENGE)).toBeNull()
  })

  /**
   * ⭐⭐⭐ THE TRANSITION — AND THIS ROW EXISTS BECAUSE I GOT IT WRONG FIRST.
   *
   * The first cut of this change re-keyed `StrengthenTheReasoning` on
   * `isPreRun`, so `SectionShell` would remount and re-read the default,
   * collapsing the section once the run landed. It looked like the tidy answer
   * and it DISCARDED THE READER'S WORK.
   *
   * Driven at this render path: open the "I disagree" composer pre-run, type
   * into it, complete a run. Pristine kept the draft; the keyed version lost
   * it — `SectionShell` unmounts a closed region, and that composer holds
   * UNSAVED text. Measured, not reasoned about.
   *
   * It was also INCONSISTENT. A section the reader opened BY HAND already
   * survives that transition, because nothing remounts. The key would have made
   * a section opened by DEFAULT behave differently from the identical section
   * opened by the identical toggle — one control, two behaviours.
   *
   * So the state belongs to the toggle after mount, which is `SectionShell`'s
   * own rule. The collapsed IA is untouched for everyone who LANDS on a
   * completed run, which is the state its 1,584px measurement was taken in.
   *
   * ⚠ THIS ROW IS A REGRESSION GUARD, AND IT PASSES AT PRISTINE — stated
   * plainly rather than dressed up as RED-first. Its evidence is the mutant:
   * re-adding the `key` turns it red.
   */
  it('a disagreement survives a run completing (V2: it lives in the conversation, not the panel)', async () => {
    // V2 has no in-panel composer: "I disagree" opens the ask with the
    // finding's context, and the draft lives in the ask store outside this
    // tab, so a completing run cannot remount it away. What the panel owns is
    // that the act stays reachable on both sides of the transition.
    const { openAskOlumi } = await import('../../coaching/askOlumiStore')
    vi.mocked(openAskOlumi).mockClear()
    const { rerender } = draw(openStrategicChallenge(), true)
    openReview()
    fireEvent.click(screen.getByTestId(`${REVIEW}-more`))
    fireEvent.click(screen.getByTestId(`${REVIEW}-disagree`))
    expect(vi.mocked(openAskOlumi).mock.calls.at(-1)?.[0].label).toBe(REVIEW_TOOL_COPY.disagree)

    rerender(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    // Post-run the act is on the Challenge card (the promoted finding) or on a
    // review item; at least one must offer it.
    const cardMore = screen.queryByTestId(`${CHALLENGE}-more`)
    if (cardMore) fireEvent.click(cardMore)
    else {
      openReview()
      fireEvent.click(screen.getByTestId(`${REVIEW}-more`))
    }
    expect(
      screen.queryByTestId(`${CHALLENGE}-disagree`) ?? screen.queryByTestId(`${REVIEW}-disagree`),
    ).not.toBeNull()
  })

  /**
   * ⚠ AND THE STATE THE READER LEFT IT IN IS THE STATE THEY GET BACK. The
   * review does not slam shut under them when a run lands. V2: the reader
   * opens it (it is collapsed by design), and it stays open across the
   * transition — `ModelReviewTool` keeps its state after mount.
   */
  it('the section the reader was reading stays open across the transition', () => {
    const { rerender } = draw(openStrategicChallenge(), true)
    openReview()
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    rerender(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${REVIEW}-item`)).toBeInTheDocument()
  })

  /**
   * ⚠ THE TWIN THAT KEEPS THE ABOVE FROM WEAKENING THE IA CLAIM: a reader who
   * LANDS on a completed run — the state the 1,584px measurement was taken in —
   * still meets a collapsed row. Asserted by a FRESH mount, not a rerender,
   * because that is the journey being claimed.
   */
  it('but a reader who lands on a completed run still meets a collapsed row', () => {
    draw(genuineDecision(), false)
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${REVIEW}-item`)).toBeNull()
  })

  /**
   * ⚠ A DEFAULT, NOT A LOCK. The reader stays authoritative over their own
   * panel; an opening that cannot be undone is a worse affordance than a
   * closed row.
   */
  it('the reader can close it, and it stays closed', () => {
    draw(openStrategicChallenge(), true)
    openReview()
    expect(screen.getByTestId(`${REVIEW}-item`)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(`${REVIEW}-toggle`))
    expect(screen.getByTestId(`${REVIEW}-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${REVIEW}-item`)).toBeNull()
  })
})


/**
 * ⭐⭐ AND THE HALF THAT MATTERS MOST — THE PRODUCER'S OWN COACHING.
 *
 * The success-measure card is the finding this panel can always ground, so it
 * is what the tests above bind to. But it is not the only thing behind that
 * row, and the difference is the whole point of the change.
 *
 * `buildRecommendations`' phase-3 promotion is NOT gated on `analysisComplete`
 * — derived at its bytes, unlike the six deterministic triggers around it
 * (`:488`, `:518`, `:554`, `:606`, `:652`) which all are. So every coaching
 * block CEE sends while drafting — the same channel the canvas coaches from —
 * already reaches this list before any run. It reached a COLLAPSED row.
 *
 * That is the "promise, not a coach" gap in one line: the canvas says "Top gap:
 * validate X"; this tab said "No analysis has run yet" and hid the producer's
 * own finding behind a chevron with a number on it.
 *
 * ⚠ IT IS PINNED HERE RATHER THAN LEFT AS A CLAIM IN A COMMIT MESSAGE. A
 * sentence saying "producer coaching reaches this list" is a mirror; a test
 * that REDs when the promotion becomes analysis-gated is not (trap 12).
 *
 * V2: the producer block is the Challenge card's finding AT REST (the strip
 * already offers the success target, so the card skips that one), and the
 * success-measure finding stays in the review queue. Both are asserted by id.
 */
describe('the producer\'s own coaching reaches the pre-run reader', () => {
  /** A CEE draft-coaching block, in the store's own `GuidanceItem` shape. */
  const seedProducerCoaching = () =>
    useGuidanceStore.setState({
      guidanceItems: [
        {
          item_id: 'g_narrow',
          source: 'coaching',
          title: 'You are comparing only two options',
          detail: 'Narrow framing: consider a third path before committing.',
          category: 'should_fix',
          coaching_kind: 'bias_signal',
          primary_action: { kind: 'ask', label: 'Explore a third option' },
          priority_rank: 1,
        },
      ],
    } as never)

  /**
   * ⚠ THE PRECONDITION IS THE COUNT MOVING, NOT THE COUNT BEING TWO. Asserting
   * a bare "2" would pass if the engine dropped the producer block and minted
   * some other row instead; the identity assertion is what settles which two.
   */
  it('the block is promoted into the pre-run list at all', () => {
    seedProducerCoaching()
    draw(openStrategicChallenge(), true)
    const ids = groundedFindingIds()
    expect(ids).toHaveLength(2)
    expect(ids).toEqual(expect.arrayContaining([SUCCESS_MEASURE_RECOMMENDATION_ID, PRODUCER_ID]))
  })

  it('and the reader can READ it — at rest, and bound to the producer\'s own id', () => {
    seedProducerCoaching()
    draw(openStrategicChallenge(), true)
    // ⚠ BY IDENTITY: `strengthen:phase3:${item_id}` is the engine's own key for
    // a producer block, so this cannot be satisfied by a UI-authored row. No
    // click precedes it: the card is on screen at rest.
    const card = screen.getByTestId(CHALLENGE)
    expect(card).toHaveAttribute('data-source', 'intervention')
    expect(card).toHaveAttribute('data-recommendation-id', PRODUCER_ID)
    expect(screen.getByTestId(`${CHALLENGE}-heading`)).toHaveTextContent(
      'You are comparing only two options',
    )
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it, the two rows above could both come
   * from a panel that renders every guidance item it can find regardless of
   * the store — and the seed would be proving nothing.
   */
  it('with no producer coaching, that row is absent', () => {
    draw(openStrategicChallenge(), true)
    const ids = groundedFindingIds()
    expect(ids).not.toContain(PRODUCER_ID)
    expect(ids).toEqual([SUCCESS_MEASURE_RECOMMENDATION_ID])
  })
})
