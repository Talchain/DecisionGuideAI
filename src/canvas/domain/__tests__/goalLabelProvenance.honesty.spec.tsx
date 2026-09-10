/**
 * The goal label that is a BRIEF EXTRACT must not be presented as the goal.
 *
 * ─── THE DEFECT ─────────────────────────────────────────────────────────────
 * CEE's projector authors an objective label for the goal node
 * (`deriveGoalObjectiveLabel`) and REFUSES when the quote holds no objective to
 * derive — a deliberation frame, a discarded clause, or simply more than
 * `GOAL_WORD_BOUND = 9` words. On refusal the verbatim sentence STAYS as the
 * label. CEE measured 9 of 13 authored on its own governed corpus, so roughly a
 * third of stated goals reach the user as a raw brief fragment.
 *
 * Three dated live captures in this repo show exactly that, and show the
 * carrier:
 *   captures/acceptance-2026-08-17-j1r1-t1.json
 *     { kind:'goal', label:"We need a direction before the January board
 *       meeting", provenance:'from_brief' }
 *   captures/w998-2026-08-16-a1-turn2.json
 *     { kind:'goal', label:"growing 15% a year, which is slower than we'd
 *       like", provenance:'from_brief' }
 *   captures/acceptance-2026-08-17-j4-t5.json
 *     { kind:'goal', label:"has to respond to the city's new clean-air zone
 *       within a year", provenance:'from_brief' }
 * None of them carries `source_quote` or `label_authored`. **`provenance` is
 * the only carrier that reaches the UI**, which is why the predicate is keyed
 * on it and not on the quote (a `source_quote` guard would be dark).
 *
 * ⚠ SCOPE — DO NOT READ A GREEN RUN HERE AS MORE THAN IT IS. `from_brief` is a
 * display projection of `extractionType` (`explicit`/`observed`) at the producer
 * (`olumi-assistants-service` `src/cee/transforms/provenance-display.ts:24-29`),
 * so it reports that the node's CONTENT came from the brief — NOT that the label
 * is unauthored. The field that would say that is `label_authored`
 * (`src/schemas/cee-v3.ts`, derived from `label !== source_quote`) and it is not
 * on this wire. The captures above are genuine raw fragments, and the predicate
 * correctly fires on them; it ALSO fires on a brief-extracted goal whose label
 * CEE authored. The copy is true of both — that is the whole reason it is
 * phrased as provenance rather than as a judgement about the label. The full
 * derivation is in the module header.
 *
 * ─── WHAT IS ASSERTED, AND HOW IT BINDS ─────────────────────────────────────
 * Every assertion binds by NODE ID, by `data-testid`, or by the `provenance`
 * field. NOTHING binds by matching the label string — the label is the thing
 * under change, and a string match would retarget the moment CEE's derivation
 * authors one more case.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import {
  goalLabelIsUnconfirmedBriefExtract,
  provenanceAfterHumanAuthoredLabel,
  GOAL_LABEL_FROM_BRIEF_TESTID,
  GOAL_LABEL_FROM_BRIEF_COPY,
} from '../goalLabelProvenance'
import { HeroSection, GOAL_INPUT_ID } from '../../components/pre-analysis-v3/hero/HeroSection'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '../../mutations/mutationAuthority'
import { useCanvasStore } from '../../store'

/** The goal node identity every surface assertion binds to. */
const GOAL_ID = 'goal-under-test'
/** A DIFFERENT node, present in every fixture, to catch a predicate that fires on anything. */
const OTHER_ID = 'factor-not-under-test'

/**
 * The SAME derivation `HeroSection.tsx:44` uses, read from the real module.
 * It selects which arm of the honesty biconditional below applies, so the test
 * follows the shipped posture instead of mandating the present one.
 */
const GOAL_SUCCESS_EDIT_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.goalSuccessTarget,
)

describe('goalLabelIsUnconfirmedBriefExtract — the one predicate', () => {
  it('fires on from_brief, and on nothing else in the vocabulary', () => {
    expect(goalLabelIsUnconfirmedBriefExtract({ provenance: 'from_brief' })).toBe(true)
    // ai_inferred is Olumi's AUTHORED objective — a different claim, not this defect.
    expect(goalLabelIsUnconfirmedBriefExtract({ provenance: 'ai_inferred' })).toBe(false)
    expect(goalLabelIsUnconfirmedBriefExtract({ provenance: 'user_set' })).toBe(false)
    expect(goalLabelIsUnconfirmedBriefExtract({})).toBe(false)
    expect(goalLabelIsUnconfirmedBriefExtract(undefined)).toBe(false)
    // An unknown literal must not be guessed into the fired state.
    expect(goalLabelIsUnconfirmedBriefExtract({ provenance: 'something_new' })).toBe(false)
  })

  it('a human authoring the label makes it theirs, in the EXISTING vocabulary', () => {
    expect(provenanceAfterHumanAuthoredLabel('goal')).toBe('user_set')
    // ⚠ Scoped to goal. On a factor, `data.provenance` answers a DIFFERENT
    // question — who owns the VALUE — and stamping it on a rename would credit
    // the user with a number Olumi estimated (trap 21).
    expect(provenanceAfterHumanAuthoredLabel('factor')).toBeUndefined()
    expect(provenanceAfterHumanAuthoredLabel(undefined)).toBeUndefined()
  })
})

describe('the mounted Analysis Goal field tells the truth', () => {
  const heroWith = (provenance: string | undefined) => ({
    decisionTitle: 'A decision',
    hasDecision: true,
    goal: {
      nodeId: GOAL_ID,
      label: 'We need a direction before the January board meeting',
      fromBrief: provenance === 'from_brief',
    },
    success: { displayText: null, attribution: null } as never,
    goalNodeId: GOAL_ID,
    coaching: null,
  })

  it('marks an unconfirmed brief extract, bound by testid not by label text', () => {
    render(
      <HeroSection
        hero={heroWith('from_brief') as never}
        ladder={'draft' as never}
        onSendPrompt={() => {}}
        onLadderAct={() => {}}
      />,
    )
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toBeInTheDocument()
  })

  it('does NOT mark an Olumi-authored objective — the discriminating twin', () => {
    render(
      <HeroSection
        hero={heroWith('ai_inferred') as never}
        ladder={'draft' as never}
        onSendPrompt={() => {}}
        onLadderAct={() => {}}
      />,
    )
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
  })

  /**
   * ⛔⛔ THE PROPERTY THIS SURFACE GOT WRONG: IT TOLD THE READER TO EDIT A FIELD
   * IT RENDERS AS READ-ONLY.
   *
   * Until 10 Sep 2026 this component rendered `GOAL_LABEL_FROM_BRIEF_COPY.notice`
   * unconditionally — "Edit it to say what you want to achieve." — as VISIBLE
   * TEXT beneath the goal field, under a comment asserting the field "really
   * writes the label". Derived at the bytes, the field is inert:
   * `HeroSection.tsx:215-216` passes `readOnly={!GOAL_SUCCESS_EDIT_CONNECTED}`
   * and `onCommit=undefined`; `:44` resolves that from `mutationAuthority.ts:127`
   * `goalSuccessTarget: 'disabled'`, a HARDCODED CONSTANT rather than a flag, so
   * no deployed posture can make the instruction true.
   *
   * ⚠ WHY THIS IS A BICONDITIONAL AND NOT A CONJUNCTION. The property is an
   * IMPLICATION: no instruction WHILE the field renders read-only. Asserting
   * instead that the field IS read-only AND carries no instruction would make
   * the present, defective posture MANDATORY. Connecting `goalSuccessTarget`
   * would turn this test RED for the repair. That is the same shape as the
   * defect this file replaces, one level up, and an earlier draft of this very
   * test had it. Both arms are therefore selected by the SAME derivation the
   * component uses, so connecting the authority later turns this GREEN.
   *
   * ⚠ NO `vi.mock` ANYWHERE IN THIS FILE, DELIBERATELY. The real constant is
   * read, so the arm taken is decided by the shipped posture. Mocking it would
   * hide the very coupling this test exists to prove.
   *
   * Both arms bind to the rendered DOM, which is what makes the attribute a
   * witness of which arm mounted rather than a restatement of the input:
   * `InlineField.tsx:159-163` renders the read-only arm as
   * `<span role="textbox" aria-readonly="true">`, and `:177-180` renders the
   * editable arm as an `<input>` carrying NO `aria-readonly`. Neither arm binds
   * to a sentence's wording: the copy is bound by CONSTANT, so a rewording
   * flows through and only a wrong-member swap REDs.
   */
  it('⛔ instruction and editability agree: no imperative unless the field is really editable', () => {
    render(
      <HeroSection
        hero={heroWith('from_brief') as never}
        ladder={'draft' as never}
        onSendPrompt={() => {}}
        onLadderAct={() => {}}
      />,
    )

    const field = document.getElementById(GOAL_INPUT_ID)
    // ⚠ PRECONDITION PINNED IN-TEST, so each arm below is provably about a
    // rendered field and not about a field that failed to render at all.
    expect(field).not.toBeNull()

    const notice = (screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).textContent ?? '').trim()
    // True in EITHER arm, so neither can pass by rendering nothing.
    expect(notice.length).toBeGreaterThan(20)
    expect(notice).toMatch(/taken from your brief/i)

    if (GOAL_SUCCESS_EDIT_CONNECTED) {
      // Connected: the editable `<input>` arm mounts and carries no
      // `aria-readonly`, and the imperative-bearing member is then honest.
      expect(field).not.toHaveAttribute('aria-readonly')
      expect(notice).toBe(GOAL_LABEL_FROM_BRIEF_COPY.notice)
    } else {
      // Not connected: the read-only `<span>` arm mounts, and no instruction may
      // point at an affordance that is not there.
      expect(field).toHaveAttribute('aria-readonly', 'true')
      // Case-insensitive: a mutant restoring the imperative with different
      // capitalisation walks past a case-sensitive arm.
      expect(notice).not.toMatch(/\bedit\b/i)
      expect(notice).toBe(GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere)
    }
  })

  /**
   * ⚠ THE MEASUREMENT, RECORDED RATHER THAN ASSUMED. It records WHICH ARM of
   * the biconditional above this head takes. It is a DELIBERATE LOUD TRIPWIRE
   * and not a second copy of the defect: its declared job is to RED the moment
   * the posture moves, so a lane connecting the writer is told to come and look
   * here. The honesty property itself does not depend on it. That test now
   * passes in both postures, and the copy follows on its own, because
   * `HeroSection` derives its member from the same constant.
   */
  it('⚠ measured posture: the hero goal-label writer is not connected at this head', () => {
    expect(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget).toBe('disabled')
    expect(hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget)).toBe(false)
    // CONTRAST CONTROL: the predicate is not simply always false.
    expect(hasServerGraphAuthority('server_graph')).toBe(true)
    // And the two sentences it selects between really are two.
    expect(GOAL_LABEL_FROM_BRIEF_COPY.notice).not.toBe(GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere)
  })
})

describe('taking the pen clears the claim', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'a brief sentence', kind: 'goal', provenance: 'from_brief' } },
        { id: OTHER_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'ai_inferred' } },
      ] as never,
      edges: [],
    })
  })

  it('renaming the GOAL stamps user_set, so the notice stops (bound by node id)', () => {
    useCanvasStore.getState().updateNodeLabel(GOAL_ID, 'Win the January board decision')
    const goal = useCanvasStore.getState().nodes.find(n => n.id === GOAL_ID)
    expect((goal?.data as Record<string, unknown>)?.provenance).toBe('user_set')
    expect(goalLabelIsUnconfirmedBriefExtract(goal?.data as never)).toBe(false)
  })

  it('renaming a FACTOR leaves its value provenance untouched — the second twin', () => {
    useCanvasStore.getState().updateNodeLabel(OTHER_ID, 'Unit price')
    const other = useCanvasStore.getState().nodes.find(n => n.id === OTHER_ID)
    expect((other?.data as Record<string, unknown>)?.provenance).toBe('ai_inferred')
  })
})
