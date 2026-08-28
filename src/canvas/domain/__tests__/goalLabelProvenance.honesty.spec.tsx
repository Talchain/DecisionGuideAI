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
} from '../goalLabelProvenance'
import { HeroSection } from '../../components/pre-analysis-v3/hero/HeroSection'
import { useCanvasStore } from '../../store'

/** The goal node identity every surface assertion binds to. */
const GOAL_ID = 'goal-under-test'
/** A DIFFERENT node, present in every fixture, to catch a predicate that fires on anything. */
const OTHER_ID = 'factor-not-under-test'

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
