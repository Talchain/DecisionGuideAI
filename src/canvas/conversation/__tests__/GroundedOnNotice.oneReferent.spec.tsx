/**
 * ⭐⭐ ONE BOX, ONE REFERENT — the two sentences of the grounding notice must
 * be about the SAME THING.
 *
 * ── THE DEFECT THIS FILE REPRODUCES, AND WHY IT IS NEW ────────────────────
 * The claim-honesty fix corrected the FIRST line to say what the producer can
 * actually license — the user's SELECTION. It did not touch the SECOND. The
 * notice then rendered, in one container, one after the other:
 *
 *     You had Runway months selected when you asked.
 *     Something you asked about isn't in this model.
 *
 * Two referents, one box, ONE producer field. `deriveUnresolved(selection)`
 * (CEE `context-pack-assembler.ts:1213-1225`, staging `d5455355`) takes a
 * `TurnSelection` and NOTHING ELSE — the user's question is not an input to it,
 * so "something you ASKED ABOUT" is the same conflation the first line had just
 * stopped making. Before the fix both sentences were consistently wrong; after
 * it they CONTRADICT EACH OTHER, which is worse: a reader can see the box
 * disagree with itself and has no way to tell which half to believe.
 *
 * ── WHY THIS IS ITS OWN SPEC ──────────────────────────────────────────────
 * `GroundedOnNotice.claimHonesty.spec.tsx` bans usage verbs on the ELEMENTS
 * line; `GroundedOnNotice.spec.tsx` pins that `not_in_model` and
 * `could_not_check` never collapse. Both are true of each sentence read alone.
 * The defect here is a property of the PAIR — it exists only when both are
 * rendered together — so neither existing spec can see it, and a third
 * assertion bolted into either would go on passing if the other line moved.
 * Every case below therefore renders BOTH paragraphs and asserts across them.
 *
 * ── WHY THESE CASES CANNOT PASS VACUOUSLY (trap 13) ───────────────────────
 * The ban half is always paired with a positive half in the same case:
 *   · the element is named, bound by CANONICAL ID via `data-element-id`, never
 *     by label text another node could carry (trap 19) — so deleting the
 *     elements line REDs these tests instead of satisfying the ban by silence;
 *   · the disclosure paragraph is asserted PRESENT and non-empty, and its
 *     state-specific content is re-asserted — so deleting the disclosure, or
 *     collapsing the two states into one sentence, REDs here too.
 *
 * MOUNT (trap 3b): every case drives the REAL `MessageBubble`, the render
 * authority for an assistant turn, exactly as both sibling specs do.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import { useCanvasStore } from '../../store'
import type { ConversationMessage } from '../types'
import type { GroundedSelection, GroundedUnresolved } from '../groundedSelection'

const noop = async () => {}

/** Canonical ids — non-guessable tokens, so any match is an identity match. */
const RUNWAY_ID = 'node-runway-months-6d20'
const HEADCOUNT_ID = 'node-headcount-plan-f417'

const RUNWAY_LABEL = 'Runway months'
const HEADCOUNT_LABEL = 'Headcount plan'

/**
 * THE QUESTION REFERENTS, AS DATA — the phrasings that attribute the producer's
 * field to what the user ASKED rather than to what they SELECTED. The
 * load-bearing member is `asked about`, the exact string that shipped in the
 * disclosure copy; the rest are the same misattribution in other clothes, so a
 * later rewording cannot reintroduce it under a synonym.
 *
 * ⚠ SCOPED TO THE DISCLOSURE PARAGRAPH ONLY, DELIBERATELY. The elements line
 * legitimately contains "when you asked" — it says WHEN the selection was
 * taken, which is a true statement about timing and not a claim about the
 * question's content. A ban applied to the whole notice would forbid that too
 * and would be asserting something the producer does not require.
 */
const QUESTION_REFERENTS = [
  'asked about',
  'you asked about',
  'what you asked',
  'your question',
  'the question you',
] as const

/** The answer the user actually received — about runway, not about the selection. */
const RUNWAY_ANSWER =
  'Runway is usually read against committed spend rather than headline cash, so the ' +
  'figure moves whenever a hiring decision is confirmed.'

function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      { id: RUNWAY_ID, position: { x: 0, y: 0 }, data: { label: RUNWAY_LABEL } },
      { id: HEADCOUNT_ID, position: { x: 0, y: 0 }, data: { label: HEADCOUNT_LABEL } },
    ] as never,
    edges: [] as never,
  })
}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-runway-1',
    role: 'assistant',
    content: RUNWAY_ANSWER,
    timestamp: new Date(),
    ...overrides,
  }
}

/**
 * Render a notice that carries BOTH halves — a nameable selected element AND an
 * unresolved disclosure — and hand back the two paragraphs separately, because
 * the property under test is a relation BETWEEN them.
 */
function renderBothSentences(unresolved: Exclude<GroundedUnresolved, 'none'>) {
  const groundedSelection: GroundedSelection = { element_ids: [RUNWAY_ID], unresolved }
  const { unmount } = render(
    <MessageBubble message={makeMsg({ groundedSelection })} onChipClick={noop} />,
  )

  const notice = screen.getByTestId('grounded-on-notice')
  const elementsLine = screen.getByTestId('grounded-on-elements')
  const disclosureLine = screen.getByTestId('grounded-on-unresolved')

  // PRECONDITION, PINNED IN-TEST (trap 13b): this payload really does render
  // both paragraphs, inside ONE container. Without this the cross-sentence
  // assertions below could hold on a notice that rendered only one of them.
  expect(notice).toContainElement(elementsLine)
  expect(notice).toContainElement(disclosureLine)
  expect((elementsLine.textContent ?? '').length).toBeGreaterThan(0)
  expect((disclosureLine.textContent ?? '').length).toBeGreaterThan(0)

  return {
    elements: (elementsLine.textContent ?? '').toLowerCase(),
    disclosure: (disclosureLine.textContent ?? '').toLowerCase(),
    unmount,
  }
}

beforeEach(() => {
  seedCanvas()
})

describe('grounding notice — ⭐⭐ the two sentences name ONE referent', () => {
  it.each(['not_in_model', 'could_not_check'] as const)(
    'THE CONTRADICTION: with unresolved="%s", the disclosure is about the SELECTION, not the question',
    (unresolved) => {
      const { elements, disclosure } = renderBothSentences(unresolved)

      // POSITIVE HALF — the element is still named, bound by canonical id.
      // Deleting the elements line REDs here rather than satisfying the ban.
      const named = screen.getAllByTestId('grounded-on-element')
      expect(named).toHaveLength(1)
      expect(named[0].getAttribute('data-element-id')).toBe(RUNWAY_ID)

      // The first sentence's referent, restated so this case is self-contained:
      // it is about what the user SELECTED.
      expect(elements).toContain('select')

      // ⭐ THE PROPERTY — the second sentence names the SAME referent…
      expect(
        disclosure,
        `the disclosure must name the SELECTION, as the line above it does (unresolved="${unresolved}")`,
      ).toContain('select')

      // …and never re-attributes the producer's field to the question.
      for (const referent of QUESTION_REFERENTS) {
        expect(
          disclosure,
          `the disclosure contradicts the line above it by naming the question (found "${referent}", unresolved="${unresolved}")`,
        ).not.toContain(referent)
      }
    },
  )

  it('⭐ the two disclosure states STILL do not collapse — the referent fix changes nothing else', () => {
    // The fix is a referent swap and must stay one. If closing the
    // contradiction ever tempts someone to merge the two sentences, this REDs.
    const first = renderBothSentences('not_in_model')
    const notInModel = first.disclosure
    first.unmount()
    const couldNotCheck = renderBothSentences('could_not_check').disclosure

    expect(notInModel).not.toBe(couldNotCheck)
    // `not_in_model` still ASSERTS the absence — the graph was read.
    expect(notInModel).toContain("isn't in this model")
    // `could_not_check` still claims NOTHING about presence.
    expect(couldNotCheck).toContain("couldn't read your model")
    for (const banned of ["isn't in", 'not in this model', 'not found', 'does not exist']) {
      expect(
        couldNotCheck,
        `could_not_check must not claim absence (found "${banned}")`,
      ).not.toContain(banned)
    }
  })

  it('DISCRIMINATING PAIR: a DIFFERENT selected element is named, and the disclosure is unchanged by it', () => {
    // Same answer, same canvas, same unresolved state — only the selected id
    // differs. An implementation that named a fixed element passes the case
    // above and FAILS here; and the cross-sentence property is a property of
    // the SENTENCE, not of one fixture, so it is re-asserted on this payload.
    render(
      <MessageBubble
        message={makeMsg({
          groundedSelection: { element_ids: [HEADCOUNT_ID], unresolved: 'not_in_model' },
        })}
        onChipClick={noop}
      />,
    )

    const ids = screen
      .getAllByTestId('grounded-on-element')
      .map((el) => el.getAttribute('data-element-id'))
    expect(ids).toEqual([HEADCOUNT_ID])
    expect(ids).not.toContain(RUNWAY_ID)
    expect(screen.queryByText(RUNWAY_LABEL)).toBeNull()

    const disclosure = (
      screen.getByTestId('grounded-on-unresolved').textContent ?? ''
    ).toLowerCase()
    expect(disclosure).toContain('select')
    for (const referent of QUESTION_REFERENTS) {
      expect(disclosure, `question referent "${referent}" leaked on the second payload`).not.toContain(
        referent,
      )
    }
  })

  it('the disclosure alone — no nameable element — is still about the selection', () => {
    // The producer can legitimately send an empty `element_ids` with a
    // disclosure (nothing resolved). There is no first sentence to be
    // consistent WITH here, so the assertion is the standalone one: the
    // sentence must still describe the field the producer actually computes.
    render(
      <MessageBubble
        message={makeMsg({
          groundedSelection: { element_ids: [], unresolved: 'not_in_model' },
        })}
        onChipClick={noop}
      />,
    )

    // POSITIVE HALF — the disclosure really is the only paragraph here.
    expect(screen.queryByTestId('grounded-on-elements')).toBeNull()
    const disclosure = (
      screen.getByTestId('grounded-on-unresolved').textContent ?? ''
    ).toLowerCase()
    expect(disclosure.length).toBeGreaterThan(0)

    expect(disclosure).toContain('select')
    for (const referent of QUESTION_REFERENTS) {
      expect(disclosure, `question referent "${referent}" leaked with no element named`).not.toContain(
        referent,
      )
    }
  })
})
