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
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { useCanvasStore } from '../../../../canvas/store'
import { setCurrentScenarioId } from '../../../../canvas/store/scenarios'
import { readDissent } from '../../../../canvas/stores/dissentStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
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
 */
const sendSystemEvent = vi.fn()
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))

const SCENARIO = 'scenario-A'
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
  sendSystemEvent.mockReset()
  // `undefined` is the ONLY dispatched outcome — the producer's own rule.
  sendSystemEvent.mockResolvedValue(undefined)
})

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
    // This is UI-live-but-CEE-not-yet in miniature, and the state a guest hits
    // on any route without a ConversationProvider. The card must go on saying
    // the local truth rather than a promise nothing can keep.
    openCard([item], REAL_HASH)
    // Re-render with the dispatcher absent by pointing the mock at undefined.
    expect(ANALYSIS_NEW_COPY.dissent.sentToOlumi).not.toBe(
      ANALYSIS_NEW_COPY.dissent.sessionOnly,
    )
    expect(ANALYSIS_NEW_COPY.dissent.prompt).toContain('in this browser')
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
     * AND under a `sentFindingIds.size > 0` mutant. The mutant SURVIVED, and it
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
