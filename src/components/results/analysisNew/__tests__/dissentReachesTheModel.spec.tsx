/**
 * ⭐⭐ THE USER'S STATED REASON LEAVES THE BROWSER — and the sentence that says
 * so is earned by an OUTCOME, never by the attempt.
 *
 * WHAT THIS CLOSES. A reader disagrees with a finding on the Reasoning tab and
 * types why. Until schemas 0.55.0 `finding_dissent`, those words went to
 * `localStorage.setItem` and stopped: invisible to the team, lost on a browser
 * clear, absent from the model the team is supposed to be reasoning over
 * together. Humans are the authors of this product and their stated reasoning
 * is the most valuable thing they produce.
 *
 * ⚠⚠ THE COPY IS THE HALF MOST LIKELY TO GO WRONG, so most of this file is
 * about it. The UI and CEE deploy INDEPENDENTLY, so every sentence here has to
 * be true at the intermediate state too — UI live, CEE reader not yet. A UI
 * that asserts a server capability which is dark is the defect class this
 * estate keeps shipping, and the only reliable guard is to bind the claim to a
 * dispatched OUTCOME rather than to the send having been attempted.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — exact testid, exact recommendation id,
 * exact sentence from COPY. Nothing here asks "is some text present", which the
 * neighbouring dissent text would satisfy on its own.
 */
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { useCanvasStore } from '../../../../canvas/store'
import { setCurrentScenarioId } from '../../../../canvas/store/scenarios'
import { readDissent } from '../../../../canvas/stores/dissentStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import { MAX_DISSENT_STATEMENT } from '../../../../canvas/conversation/findingDissent'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()), markKindForTarget: () => null,
}))

/**
 * The dispatcher is mocked at the OPTIONAL context, which is how the component
 * reaches it. `sendSystemEvent` is re-pointed per test so each case controls
 * exactly one variable.
 *
 * ⚠⚠ AND THE CONTEXT ITSELF IS A VARIABLE, NOT A CONSTANT. It used to return a
 * dispatcher unconditionally, which made the no-dispatcher state — the
 * intermediate deploy state this file exists to pin — INEXPRESSIBLE in the
 * fixture. A case named for that state could only assert things that are true
 * of every state, and one did. A fixture in which the wrong answer cannot be
 * written is not a weak test, it is an absent one.
 */
const sendSystemEvent = vi.fn()
let dispatcherMounted = true
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => (dispatcherMounted ? { sendSystemEvent } : undefined),
}))

const SCENARIO = 'scenario-A'
/**
 * ⚠⚠ THE SECOND DECISION, AND WITHOUT IT THIS FILE CANNOT SEE ITS OWN DEFECT.
 *
 * Every case here used to pin ONE scenario constant, so "the claim is scoped to
 * the decision on screen" was not a question the fixture could ask. Recommendation
 * ids are deterministic and scenario-agnostic — `strengthen:robustness` is a
 * fixed literal in every decision — so a set keyed on the bare id collides across
 * scenarios as the NORMAL case, and a single-scenario fixture reports green about
 * it forever.
 */
const SCENARIO_B = 'scenario-B'
const REAL_HASH = 'sha256:realrun'
const ID = 'strengthen:robustness'
const OTHER_ID = 'strengthen:broaden'

function rec(id: string, title: string): Recommendation {
  return {
    id, helpType: 'challenge', title,
    signal: 'The ranking was fragile.', whyNow: 'Small changes flip it.',
    tryThis: 'Imagine it failed.', sourceLine: 'From the robustness check.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
    priority: 1,
  } as Recommendation
}

const item = rec(ID, 'Pressure-test the leading option')
const sibling = rec(OTHER_ID, 'Broaden the options')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useStrengthenStore.getState()._reset()
  useCanvasStore.setState({ currentScenarioId: SCENARIO })
  setCurrentScenarioId(SCENARIO)
  dispatcherMounted = true
  sendSystemEvent.mockReset()
  // `undefined` is the ONLY dispatched outcome — the producer's own rule.
  sendSystemEvent.mockResolvedValue(undefined)
})

/**
 * Switch the decision on screen, the way the product does.
 *
 * ⚠ NO UNMOUNT. `activeScenarioId` is a live store subscription, so a scenario
 * change re-renders this surface in place and the component's session state —
 * including the set that licenses the stronger sentence — SURVIVES it. That
 * survival is exactly what makes the key shape load-bearing, so the test must
 * switch the same way the product does rather than re-rendering a fresh tree.
 */
function switchScenario(id: string) {
  act(() => {
    useCanvasStore.setState({ currentScenarioId: id })
    setCurrentScenarioId(id)
  })
}

function openCard(items: Recommendation[] = [item], analysisHash: string | null = REAL_HASH) {
  const view = render(
    <StrengthenTheReasoning interventions={items} analysisHash={analysisHash} />,
  )
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return view
}

async function disagree(words: string, index = 0) {
  fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-disagree')[index])
  fireEvent.change(screen.getAllByTestId('analysis-new-strengthen-disagree-input')[0], {
    target: { value: words },
  })
  await act(async () => {
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-disagree-save')[0])
  })
}

/** The one `finding_dissent` the dispatcher was handed, or undefined. */
function sentEvent() {
  return sendSystemEvent.mock.calls
    .map((c) => c[0])
    .find((e) => e?.type === 'finding_dissent')
}

/** Every `finding_dissent` handed to the dispatcher for one finding, by id. */
function dissentEventsFor(findingId: string) {
  return sendSystemEvent.mock.calls
    .map((c) => c[0])
    .filter((e) => e?.type === 'finding_dissent' && e.payload?.finding_id === findingId)
}

describe('a stated dissent reaches the shared model', () => {
  it('⭐ RED-FIRST: committing a dissent SENDS finding_dissent with both ids and the words', async () => {
    // The signature that fails at pristine: nothing is sent at all, so
    // `sentEvent()` is undefined and this REDs on the first expectation.
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')

    const event = sentEvent()
    expect(event, 'no finding_dissent reached the dispatcher').toBeDefined()
    // Bound by identity to the FINDING'S OWN ID — never its label and never the
    // rendered sentence, both of which this panel truncates.
    expect(event.payload).toEqual({
      finding_id: ID,
      analysis_id: REAL_HASH,
      statement: 'Our Q1 capacity assumption is wrong.',
    })
  })

  it('⭐ sends the statement VERBATIM — surrounding whitespace survives the wire', async () => {
    openCard()
    await disagree('  we measured this in March  ')
    expect(sentEvent().payload.statement).toBe('  we measured this in March  ')
  })

  it('keeps the LOCAL record as well as sending — the send is additive, never a move', async () => {
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')
    expect(readDissent(SCENARIO)[ID].reason).toBe('Our Q1 capacity assumption is wrong.')
  })
})

describe('the address is guarded — a placeholder is never sent', () => {
  it("⭐ THE TWIN: a FAILED run's hash is the literal 'error', and NOTHING is sent", async () => {
    openCard([item], 'error')
    await disagree('This finding is wrong.')

    expect(sentEvent(), "'error' is not an analysis id and must never be addressed").toBeUndefined()
    // …and the words are still kept, which is the whole point of the guard.
    expect(readDissent(SCENARIO)[ID].reason).toBe('This finding is wrong.')
  })

  it('a PRE-RUN card has no run identity, and NOTHING is sent', async () => {
    openCard([item], null)
    await disagree('This finding is wrong.')
    expect(sentEvent()).toBeUndefined()
    expect(readDissent(SCENARIO)[ID].reason).toBe('This finding is wrong.')
  })

  it('CONTROL: the same journey with a REAL hash DOES send', async () => {
    // Without this, every refusal above would be consistent with a component
    // that never sends anything — the guard would be indistinguishable from a
    // broken emitter.
    openCard([item], REAL_HASH)
    await disagree('This finding is wrong.')
    expect(sentEvent()).toBeDefined()
  })
})

describe('the copy may claim the words left the browser ONLY after a dispatched send', () => {
  it('⭐ RED-FIRST: a DISPATCHED send earns the stronger sentence', async () => {
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')
    expect(screen.getByTestId('analysis-new-strengthen-disagreement-sent')).toHaveTextContent(
      ANALYSIS_NEW_COPY.dissent.sentToOlumi,
    )
  })

  it('⭐ THE TWIN: a REJECTED send leaves the words on screen and claims NOTHING', async () => {
    sendSystemEvent.mockRejectedValue(new Error('server refused the turn'))
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')

    expect(screen.queryByTestId('analysis-new-strengthen-disagreement-sent')).toBeNull()
    // The user's words survive a failed POST. Losing them is the worst outcome
    // available on this surface.
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent(
      'Our Q1 capacity assumption is wrong.',
    )
    expect(readDissent(SCENARIO)[ID].reason).toBe('Our Q1 capacity assumption is wrong.')
  })

  it('⭐ a DEFERRED send is not a send — it is queued, and claims NOTHING', async () => {
    // `SendTurnOutcome` declares `undefined` as the only dispatched outcome.
    // A predicate that excluded only SEND_BLOCKED would pass this event as sent
    // while it sat in a client-side queue.
    sendSystemEvent.mockResolvedValue('send_deferred')
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')
    expect(screen.queryByTestId('analysis-new-strengthen-disagreement-sent')).toBeNull()
  })

  it('⭐ a BLOCKED send is not a send, and claims NOTHING', async () => {
    sendSystemEvent.mockResolvedValue('send_blocked')
    openCard()
    await disagree('Our Q1 capacity assumption is wrong.')
    expect(screen.queryByTestId('analysis-new-strengthen-disagreement-sent')).toBeNull()
  })

  it('⭐⭐ THE INTERMEDIATE DEPLOY STATE: no dispatcher mounted, no claim, words kept', async () => {
    /**
     * This is UI-live-but-CEE-not-yet in miniature, and the state a guest hits
     * on any route without a `ConversationProvider`. The card must go on saying
     * the local truth rather than a promise nothing can keep.
     *
     * ⚠⚠ AN EARLIER CUT OF THIS CASE ASSERTED NEITHER HALF OF ITS OWN NAME. It
     * rendered WITH a dispatcher — the mock returned one unconditionally — and
     * then asserted that two copy CONSTANTS differ and that a third contains a
     * phrase. Every one of those is true of the built module in every state,
     * including one that claims "sent to Olumi" on every card. Proven by
     * mutation: making the claim render unconditionally REDs four cases in this
     * file and left this one GREEN. It was not a weak test of the deploy state;
     * it was a test of the copy table wearing this one's name.
     */
    dispatcherMounted = false
    openCard([item], REAL_HASH)
    await disagree('Our Q1 capacity assumption is wrong.')

    // ⚠ THE PRECONDITION, PINNED IN-TEST: nothing was offered to a dispatcher at
    // all, so a claim on this card could only have been invented. Without this
    // the absence below would also hold for a mounted dispatcher that refused,
    // which is a DIFFERENT case (asserted above) and not the one named here.
    expect(sendSystemEvent, 'no dispatcher is mounted, so nothing may be sent').not.toHaveBeenCalled()

    // The words are kept — on screen…
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent(
      'Our Q1 capacity assumption is wrong.',
    )
    // …and durably, which is the half a lost POST must never cost the user.
    expect(readDissent(SCENARIO)[ID].reason).toBe('Our Q1 capacity assumption is wrong.')

    // And THE CLAIM IS ABSENT. This is the assertion the old case never made.
    expect(
      screen.queryByTestId('analysis-new-strengthen-disagreement-sent'),
      'no dispatcher can have dispatched anything',
    ).toBeNull()
  })

  it('⭐⭐ BOUND BY IDENTITY: a sibling finding\'s successful send does NOT label this one', async () => {
    /**
     * The defect this prevents: a "something was sent" flag would put the
     * stronger sentence on EVERY standing dissent once any one of them landed.
     *
     * ⚠⚠ BOTH CARDS MUST CARRY A STANDING DISSENT OR THIS TEST CANNOT SEE THE
     * DEFECT, AND AN EARLIER CUT OF IT DID NOT. It dissented on the sibling
     * alone, so the first card rendered no dissent paragraph at all and
     * therefore no marker either way — the count was 1 under the correct code
     * AND under a `…size > 0` mutant on the sent set. The mutant SURVIVED, and it
     * survived silently: a green assertion about an element that was never in
     * the DOM. The fix is not a sharper assertion, it is a fixture in which the
     * wrong answer is expressible.
     *
     * So: card 0's send is REJECTED (standing dissent, no claim) and card 1's
     * send is DISPATCHED (standing dissent, claim). Any predicate coarser than
     * the finding's own id now labels card 0 as well, and the count REDs.
     */
    sendSystemEvent.mockRejectedValueOnce(new Error('server refused the turn'))
    openCard([item, sibling], REAL_HASH)

    await disagree('This finding is wrong.', 0)
    await disagree('The sibling finding is wrong.', 1)

    // The precondition, pinned IN-TEST: both cards really do carry a dissent,
    // so a marker on the wrong one is an expressible outcome.
    expect(screen.getAllByTestId('analysis-new-strengthen-disagreement')).toHaveLength(2)
    // ⚠ BOTH cards handed an event to the dispatcher — card 0's was REJECTED,
    // which is the point of the fixture. So name the one under test by its id
    // rather than taking "the first finding_dissent", which is card 0's.
    expect(dissentEventsFor(ID), 'card 0 attempted a send, and it was refused').toHaveLength(1)
    expect(dissentEventsFor(OTHER_ID)).toHaveLength(1)

    // Exactly one card carries the claim, and it is the sibling's.
    const claims = screen.getAllByTestId('analysis-new-strengthen-disagreement-sent')
    expect(claims).toHaveLength(1)
    const carrier = claims[0].closest('[data-recommendation-id]')
    expect(carrier?.getAttribute('data-recommendation-id')).toBe(OTHER_ID)
  })
})

/**
 * ⭐⭐ THE CLAIM IS SCOPED TO THE DECISION ON SCREEN, AND THE FINDING ID ALONE
 * CANNOT SCOPE IT.
 *
 * ⚠⚠ THIS SURFACE'S IDENTITY IS THE PAIR `(scenarioId, rec.id)`, NOT `rec.id`.
 * Every other identity in the component composes it through the store's own
 * `recordKey(activeScenarioId, rec.id)`, and the rendered dissent itself is
 * scenario-scoped via `readDissent(activeScenarioId)`. A set keyed on the bare
 * id is the one read that disagreed with all of them.
 *
 * ⚠⚠ AND THE COLLISION IS THE NORMAL CASE, NOT AN EDGE. Recommendation ids are
 * deterministic and scenario-agnostic — `strengthen:robustness` is a fixed
 * literal, identical in every decision — so ANY two decisions showing the same
 * finding collide. `activeScenarioId` is a live store subscription, so switching
 * decisions re-renders this surface WITHOUT unmounting it and the session set
 * survives the switch. Switching decisions is an ordinary in-session affordance.
 *
 * The harm is this feature's own honesty defect one axis over: the product tells
 * a user their words reached the shared model when those words never left the
 * browser. It is worse than the local-only wording it replaced, because a person
 * who believes their objection is on the record stops repeating it.
 *
 * ⚠ THE TWO CASES ARE A DISCRIMINATING PAIR AND NEITHER MEANS ANYTHING ALONE.
 * Revert the key to the bare id and the CROSS-decision case REDs while the
 * WITHIN-decision case stays GREEN. One case failing would only show the marker
 * is sensitive to something; the pair shows it is bound to the named object.
 */
describe('the claim is scoped to the DECISION on screen, not to the finding id alone', () => {
  /** Send once for real in A, then refuse everything after it. */
  function dispatchInAOnly() {
    sendSystemEvent.mockResolvedValueOnce(undefined)
    sendSystemEvent.mockResolvedValue('send_blocked')
  }

  it('⭐ RED-FIRST: a dispatched send in decision A does NOT claim in decision B — same finding id', async () => {
    dispatchInAOnly()
    openCard([item], REAL_HASH)
    await disagree('Scenario A words, genuinely sent.')

    // ⚠ PRECONDITION ONE, pinned IN-TEST: A really did earn the claim. Without
    // it the absence below would also hold for a build that never claims at all,
    // and the case would pass for the wrong reason.
    expect(
      screen.getByTestId('analysis-new-strengthen-disagreement-sent'),
      'scenario A dispatched, so it must carry the claim',
    ).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.sentToOlumi)

    switchScenario(SCENARIO_B)
    await disagree('Scenario B words, NEVER sent anywhere.')

    // ⚠ PRECONDITION TWO: B's card really is rendering B's own words, so a
    // marker here would sit on the WRONG DECISION rather than on nothing at all.
    // This is the fixture half the sibling-finding case had to learn: an
    // assertion about an element that never renders is green about nothing.
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent(
      'Scenario B words, NEVER sent anywhere.',
    )
    // ⚠ PRECONDITION THREE: both decisions ATTEMPTED a send under the same
    // finding id — which is what makes the ids collide — and exactly one of them
    // was dispatched. A fixture where B never attempted would not reproduce it.
    expect(dissentEventsFor(ID), 'both decisions attempted, under one finding id').toHaveLength(2)

    expect(
      screen.queryByTestId('analysis-new-strengthen-disagreement-sent'),
      "scenario B's words never left the browser, so its card may claim nothing",
    ).toBeNull()
  })

  it('⭐ THE TWIN: returning to decision A keeps A\'s claim — the marker is scoped, not erased', async () => {
    // The GREEN half of the pair. A fix that simply stopped claiming — or that
    // cleared the set on every scenario change — would satisfy the case above
    // and fail this one. The marker must be SCOPED, not suppressed.
    dispatchInAOnly()
    openCard([item], REAL_HASH)
    await disagree('Scenario A words, genuinely sent.')

    switchScenario(SCENARIO_B)
    await disagree('Scenario B words, NEVER sent anywhere.')
    switchScenario(SCENARIO)

    // A's own words are back on screen…
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent(
      'Scenario A words, genuinely sent.',
    )
    // …and so is the claim A actually earned. The set is session state and a
    // decision switch is not an unmount, so nothing here was re-sent.
    expect(screen.getByTestId('analysis-new-strengthen-disagreement-sent')).toHaveTextContent(
      ANALYSIS_NEW_COPY.dissent.sentToOlumi,
    )
    expect(dissentEventsFor(ID), 'no third send was made by navigating').toHaveLength(2)
  })
})

/**
 * ⭐⭐⭐ THE SENTENCE THE USER READS BEFORE TYPING IS TRUE ABOUT WHERE THE WORDS GO.
 *
 * ⚠⚠ WHAT THIS CLOSES, AND WHY IT IS NOT A COPY NIT. `dissent.prompt` sits ON
 * the textarea and its own comment says it exists "so saving is not a guess".
 * Shipping `finding_dissent` beneath it made it false: the user composed under
 * an explicit promise of locality and the words then went to the server, with
 * the only sentence saying so rendering AFTER the send. Standing rule R-004
 * keeps user free text out of persistence and Paul widened it deliberately on
 * 2026-09-11 for stated reasoning about a finding — but a widening the user is
 * not told about at the moment of decision is indistinguishable, from their
 * side, from a leak. Consent that arrives after the fact is not consent.
 *
 * ⚠⚠ EVERY CASE READS THE PROMPT WITH THE TEXTAREA STILL EMPTY. That is the
 * moment the sentence has to be true, and it is also the moment a prompt keyed
 * on the WHOLE of `buildFindingDissentEvent` would get wrong: an empty draft is
 * not a sendable statement, so such a prompt would promise locality at exactly
 * the moment the user is deciding whether to type at all.
 *
 * ⚠ AND NOTHING HERE IS BOUND TO A FIXTURE FLAG. `dispatcherMounted` and the
 * hash are INPUTS; every case asserts the prompt against what then reached the
 * WIRE, so a copy predicate that drifted from the send predicate REDs. That
 * drift is the whole defect, and a test bound to the fixture could not see it.
 */
describe('the prompt is true at the moment it is read', () => {
  /** Open the composer and hand back its label. Nothing is typed. */
  function openComposer(analysisHash: string | null = REAL_HASH) {
    openCard([item], analysisHash)
    fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-disagree')[0])
    return screen.getByTestId('analysis-new-strengthen-disagree-prompt')
  }

  async function typeAndSave(words: string) {
    fireEvent.change(screen.getAllByTestId('analysis-new-strengthen-disagree-input')[0], {
      target: { value: words },
    })
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('analysis-new-strengthen-disagree-save')[0])
    })
  }

  it('⭐ RED-FIRST: when the send WILL happen, the prompt says so before a word is typed', async () => {
    /**
     * The signature that fails at 374a40ff: the label reads "This stays on the
     * card in this browser." while the very next click puts those words on the
     * wire. It REDs on the first expectation below.
     */
    const prompt = openComposer(REAL_HASH)

    // ⚠ THE PRECONDITION, PINNED IN-TEST: the box really is empty, so this is
    // the deciding moment and not a post-hoc reading.
    expect(screen.getByTestId('analysis-new-strengthen-disagree-input')).toHaveValue('')

    expect(prompt).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi)
    expect(
      prompt,
      'the locality sentence must not be what a user reads before a send',
    ).not.toHaveTextContent(ANALYSIS_NEW_COPY.dissent.prompt)

    // …and the sentence was not a guess: the words do leave the browser.
    await typeAndSave('Our Q1 capacity assumption is wrong.')
    expect(sentEvent(), 'the prompt promised a send, so one must have happened').toBeDefined()
  })

  it("⭐ THE TWIN: a FAILED run's hash is 'error', nothing is sent, and the LOCAL wording stands", async () => {
    /**
     * The opposite direction, and it is the case that proves the copy consults
     * `isSendableAddress` rather than a hand-rolled truthiness test: `'error'`
     * is a NON-BLANK string, so `Boolean(hash)` would call this state sendable
     * and show the stronger sentence over words that never travel.
     */
    const prompt = openComposer('error')
    expect(screen.getByTestId('analysis-new-strengthen-disagree-input')).toHaveValue('')

    expect(prompt).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.prompt)
    expect(
      prompt,
      "nothing can be sent against 'error', so nothing may be promised",
    ).not.toHaveTextContent(ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi)

    await typeAndSave('This finding is wrong.')
    expect(sentEvent(), 'the prompt promised locality, so nothing may be sent').toBeUndefined()
  })

  it('⭐⭐ THE INTERMEDIATE DEPLOY STATE: no dispatcher, so the local wording is the true one', async () => {
    // UI live, CEE reader not yet — and any route with no `ConversationProvider`.
    dispatcherMounted = false
    const prompt = openComposer(REAL_HASH)

    expect(prompt).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.prompt)
    expect(prompt).not.toHaveTextContent(ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi)

    await typeAndSave('This finding is wrong.')
    expect(sendSystemEvent, 'no dispatcher is mounted, so nothing may be sent').not.toHaveBeenCalled()
  })

  it('a PRE-RUN card has no run identity, and the local wording stands', async () => {
    const prompt = openComposer(null)
    expect(prompt).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.prompt)
    expect(prompt).not.toHaveTextContent(ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi)
    await typeAndSave('This finding is wrong.')
    expect(sentEvent()).toBeUndefined()
  })

  it('⭐⭐ BOUND TO THE WIRE, NOT TO THE FIXTURE: prompt and send agree in every state', async () => {
    /**
     * ⭐ THE LOAD-BEARING CASE. The cases above each pin one state, which a copy
     * predicate hand-written to match them would also satisfy. This one asks the
     * question the defect is actually about: does what the user was TOLD match
     * what then happened on the wire? A second predicate that drifts from
     * `isSendableAddress` REDs here whichever direction it drifts in.
     */
    const STATES = [
      { name: 'dispatcher mounted, real run', mounted: true, hash: REAL_HASH as string | null },
      { name: 'dispatcher mounted, failed run', mounted: true, hash: 'error' as string | null },
      { name: 'dispatcher mounted, pre-run', mounted: true, hash: null as string | null },
      { name: 'no dispatcher, real run', mounted: false, hash: REAL_HASH as string | null },
    ]
    const observed: Array<{ name: string; promised: boolean; sent: boolean }> = []

    for (const state of STATES) {
      cleanup()
      localStorage.clear()
      sessionStorage.clear()
      useStrengthenStore.getState()._reset()
      useCanvasStore.setState({ currentScenarioId: SCENARIO })
      setCurrentScenarioId(SCENARIO)
      sendSystemEvent.mockReset()
      sendSystemEvent.mockResolvedValue(undefined)
      dispatcherMounted = state.mounted

      const prompt = openComposer(state.hash)
      const promised = (prompt.textContent ?? '').includes(
        ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi,
      )
      await typeAndSave('Words that decide nothing on their own.')
      observed.push({ name: state.name, promised, sent: sentEvent() !== undefined })
    }

    // ⚠ VACUITY FIRST. An invariant over four states that all answer the same
    // way is satisfied by a build that never sends and never promises. Both
    // answers must occur, or everything below is agreement about nothing.
    expect(observed.filter((o) => o.sent).map((o) => o.name)).toEqual([
      'dispatcher mounted, real run',
    ])
    expect(observed.filter((o) => !o.sent)).toHaveLength(3)

    for (const o of observed) {
      expect(
        o.promised,
        `${o.name}: the prompt said ${o.promised ? 'SENT' : 'LOCAL'} and the wire did ${o.sent ? 'SEND' : 'NOT send'}`,
      ).toBe(o.sent)
    }
  })

  it('⭐ THE RESIDUE IS PINNED, AND IT CAN ONLY EVER OVER-WARN', async () => {
    /**
     * The address is deliberately a WIDER condition than the send, so states
     * exist where the prompt warns and nothing travels. This is one of them: a
     * statement over the contract bound is refused by the builder.
     *
     * ⚠ THE DIRECTION IS THE POINT AND IT IS ASSERTED, NOT ASSUMED. Warning
     * about words that then stay put costs the user nothing; staying silent
     * about words that travel is the defect this file repairs. A change that
     * traded one for the other would RED here.
     */
    const prompt = openComposer(REAL_HASH)
    expect(prompt).toHaveTextContent(ANALYSIS_NEW_COPY.dissent.promptSendsToOlumi)

    await typeAndSave('x'.repeat(MAX_DISSENT_STATEMENT + 1))
    expect(
      sentEvent(),
      'over the contract bound: refused, so the warning over-stated and nothing travelled',
    ).toBeUndefined()
  })
})
