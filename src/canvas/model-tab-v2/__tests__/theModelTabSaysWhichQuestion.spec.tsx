/**
 * ⭐⭐ THE MODEL TAB SAYS WHICH QUESTION THE MODEL IS ABOUT.
 *
 * `MODEL-TAB-REDESIGN-2026-07-29.md` §2 states the sharpest criticism of this
 * tab: *"Nothing on the tab says what this decision is."* It was still true at
 * `18d681c2`, and the reason is structural rather than an oversight:
 *
 *   · `adapters.ts:246-252` files a `decision` node into the `goal` GROUP, so
 *     the question does reach the outline as a row; but
 *   · `ModelTabV2Panel.tsx:1298` passes `initiallyClosedGroups={MODEL_GROUP_IDS}`,
 *     so EVERY group arrives closed (`theOutlineOpensAsAnOutline.spec.tsx`).
 *
 * So on open the reader meets five collapsed headers and counts. The question is
 * behind one of them. The tab never states what is being worked out.
 *
 * ⚠ THIS IS A PROJECTION, NOT A SECOND SOURCE OF TRUTH (design §3.0, *"the text
 * IS the graph"*). `projectModelQuestion` is pure and reads the same two
 * policies the outline rows read — `nodeKind` for which node is the question,
 * `resolveCanvasLabel` for what it is called. A row and this line therefore
 * cannot name the question two different things, which is the only version of
 * this feature worth shipping.
 *
 * ── THE THREE CASES, AND WHY THERE ARE THREE AND NOT TWO ─────────────────────
 *
 * The design names two (a question, or the honest absence *"No decision node
 * yet"*). A third is REQUIRED and was derived, not imagined: a `decision` node
 * that still carries its TYPE DEFAULT name. `DECISION_NODE_LABEL` is the string
 * `'Question'` (`domain/vocabulary.ts:41`), and `rowPresentation.ts:208`
 * (`labelIsTypeDefault`) exists precisely because that state was WITNESSED on
 * deployed `a9c2e050`, rendering as a row reading "Question". A two-case line
 * would render the word twice and state nothing.
 *
 * ⛔ NO INSTRUCTION IS ADDED. `theTabDoesNotPromiseWhatItCannotDo.spec.tsx`
 * governs this surface: a GAP is acceptable where a LIE is not. Each absence
 * states a fact and tells the reader to do nothing.
 *
 * ⛔ NO VERDICT LANGUAGE. The Model tab states composition. Naming a leading
 * option, a recommendation or a race belongs to the results surfaces and is
 * pinned below.
 *
 * ⚠ EVERY EXPECTATION IS A LITERAL RENDERED SENTENCE. Importing the constant the
 * component emits would move both sides together and this spec could not RED.
 * The FIXTURES do import `DECISION_NODE_LABEL`, which is the opposite case: the
 * input must stay bound to the real product default or case 3 tests a premise
 * the product no longer has.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { projectModelQuestion } from '../modelQuestion'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import { useCanvasStore } from '../../store'

const QUESTION_ID = 'dec_ops_site'
const SECOND_QUESTION_ID = 'dec_pricing'
const GOAL_ID = 'goal_arr'
const FACTOR_ID = 'fac_headcount'

/** Deliberately NOT id-shaped: `RAW_ID_PATTERN` would reject an id-shaped label. */
const WRITTEN_QUESTION = 'Should we move Ops to Berlin?'
const OTHER_QUESTION = 'Should we keep Ops in Leeds?'

const TESTID = 'model-tab-v2-question'

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' },
  } as unknown as Node
}

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Engineering headcount', kind: 'factor', category: 'observable' },
  } as unknown as Node
}

function questionNode(label: string, id: string = QUESTION_ID): Node {
  return {
    id,
    type: 'decision',
    position: { x: 0, y: 0 },
    data: { label, kind: 'decision' },
  } as unknown as Node
}

const edges = (): Edge[] => []

function renderPanel(nodes: Node[]) {
  useCanvasStore.setState({ nodes, edges: edges() } as never, false)
  return render(<ModelTabV2Panel nodes={nodes} edges={edges()} goalThreshold={null} />)
}

/** The rendered line, bound BY IDENTITY rather than by a text predicate. */
const line = () => screen.getByTestId(TESTID)

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

// ── PRECONDITION ─────────────────────────────────────────────────────────────

describe('the line is reachable at all', () => {
  it('PRECONDITION: the panel renders, so a missing line is the line and not the panel', () => {
    renderPanel([goalNode(), factorNode()])
    expect(screen.queryByTestId('model-tab-v2-panel')).not.toBeNull()
  })

  it('PRECONDITION: the question is NOT already visible on open, or this line duplicates one', () => {
    // The decision row lives in the `goal` GROUP, and every group arrives
    // CLOSED. If this ever starts failing, the row has become visible on open
    // and THIS line is the duplicate that should go — not the row.
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION)])
    const goalGroup = screen.queryByTestId('model-group-v2-goal-toggle')
    expect(goalGroup?.getAttribute('aria-expanded')).toBe('false')
  })
})

// ── CASE 1 · a model WITH a written question states it ───────────────────────

describe('a model with a written question', () => {
  it('states the question the user wrote, verbatim', () => {
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION), factorNode()])
    expect(line()).toHaveTextContent('Should we move Ops to Berlin?')
  })

  it('names it as the question, using the product noun', () => {
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION)])
    expect(line()).toHaveTextContent('Question')
  })

  it('does NOT state an absence when a question is present', () => {
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION)])
    expect(line().textContent ?? '').not.toContain('Not written yet')
    expect(line().textContent ?? '').not.toContain('Not in this model yet')
  })
})

// ── CASE 2 · a model with NO question node states the absence ────────────────

describe('a model with no question node', () => {
  it('states the honest absence and invents nothing', () => {
    renderPanel([goalNode(), factorNode()])
    expect(line()).toHaveTextContent('Not in this model yet')
  })

  it('does NOT borrow the goal, a factor or any other node as the question', () => {
    renderPanel([goalNode(), factorNode()])
    const text = line().textContent ?? ''
    expect(text, 'the goal label leaked into the question line').not.toContain('Hit ARR target')
    expect(text, 'a factor label leaked into the question line').not.toContain(
      'Engineering headcount',
    )
  })

  it('does not instruct an action this surface cannot perform', () => {
    renderPanel([goalNode(), factorNode()])
    const text = (line().textContent ?? '').toLowerCase()
    for (const imperative of ['add a', 'click', 'edit it', 'open the', 'write your']) {
      expect(text, `the absence instructs: "${imperative}"`).not.toContain(imperative)
    }
  })
})

// ── CASE 3 · a question node still carrying its TYPE DEFAULT name ────────────

describe('a question node nobody has written yet', () => {
  it('is not read as a written question, so the line does not say "Question: Question"', () => {
    renderPanel([goalNode(), questionNode(DECISION_NODE_LABEL)])
    expect(line()).toHaveTextContent('Not written yet')
  })

  it('separates "not written" from "not in the model" — they are different facts', () => {
    renderPanel([goalNode(), questionNode(DECISION_NODE_LABEL)])
    expect(line().textContent ?? '').not.toContain('Not in this model yet')
  })

  it('treats a node with no honest label at all as unwritten, not as a named question', () => {
    // `resolveCanvasLabel` returns null for an empty label; the row falls back
    // to `UNNAMED_ELEMENT_LABEL`. Rendering "Question: Unnamed element" is the
    // same gibberish as case 3 proper.
    renderPanel([goalNode(), questionNode('   ')])
    expect(line()).toHaveTextContent('Not written yet')
    expect(line().textContent ?? '').not.toContain('Unnamed element')
  })
})

// ── DETERMINISTIC PROJECTION · the text derives from the graph ───────────────

describe('the line is a projection of the graph, not stored copy', () => {
  it('the same model state produces the same sentence, every time', () => {
    const nodes = [goalNode(), questionNode(WRITTEN_QUESTION), factorNode()]
    expect(projectModelQuestion(nodes)).toEqual(projectModelQuestion(nodes))
    // A fresh but equal set of nodes must project identically too: a projection
    // that depended on object identity would pass the line above and fail this.
    expect(projectModelQuestion(nodes)).toEqual(
      projectModelQuestion([goalNode(), questionNode(WRITTEN_QUESTION), factorNode()]),
    )
  })

  it('DISCRIMINATOR: changing the graph changes the sentence', () => {
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION)])
    expect(line()).toHaveTextContent('Should we move Ops to Berlin?')
    cleanup()

    renderPanel([goalNode(), questionNode(OTHER_QUESTION)])
    expect(line()).toHaveTextContent('Should we keep Ops in Leeds?')
    expect(
      line().textContent ?? '',
      'the line kept the previous question — it is stored copy, not a projection',
    ).not.toContain('Should we move Ops to Berlin?')
  })

  it('DISCRIMINATOR: removing the question node changes the sentence back to the absence', () => {
    renderPanel([goalNode(), questionNode(WRITTEN_QUESTION)])
    expect(line()).toHaveTextContent('Should we move Ops to Berlin?')
    cleanup()

    renderPanel([goalNode()])
    expect(line()).toHaveTextContent('Not in this model yet')
  })

  it('a WRITTEN question outranks an unwritten one, wherever it sits in node order', () => {
    // A stray unwritten question node ahead of the real one must not make the
    // line say "not written yet" while the outline shows a written question
    // below it. The line and the rows may never disagree about the same model.
    renderPanel([
      goalNode(),
      questionNode(DECISION_NODE_LABEL, SECOND_QUESTION_ID),
      questionNode(WRITTEN_QUESTION),
    ])
    expect(line()).toHaveTextContent('Should we move Ops to Berlin?')
    expect(line().textContent ?? '').not.toContain('Not written yet')
  })

  it('is deterministic when a model carries more than one question node', () => {
    // Not a claim that this is common — a claim that it cannot render
    // NON-DETERMINISTICALLY if it happens. Node order decides, and node order is
    // the same array the outline reads, so the line and the rows agree.
    const nodes = [
      goalNode(),
      questionNode(WRITTEN_QUESTION),
      questionNode(OTHER_QUESTION, SECOND_QUESTION_ID),
    ]
    expect(projectModelQuestion(nodes)).toEqual(projectModelQuestion(nodes))
    expect(projectModelQuestion(nodes)).toEqual({ state: 'stated', label: WRITTEN_QUESTION })
  })
})

// ── STANDING COPY RULINGS ────────────────────────────────────────────────────

describe('the line obeys the standing copy rulings', () => {
  const EM_DASH = '—'

  it('renders no em dash, in any of the three states', () => {
    for (const nodes of [
      [goalNode(), questionNode(WRITTEN_QUESTION)],
      [goalNode(), questionNode(DECISION_NODE_LABEL)],
      [goalNode()],
    ]) {
      renderPanel(nodes)
      expect(line().textContent ?? '').not.toContain(EM_DASH)
      cleanup()
    }
  })

  it('CONTROL: the em dash detector can see an em dash', () => {
    // Without this the ruling above passes for a detector that matches nothing.
    expect(`a${EM_DASH}b`).toContain(EM_DASH)
  })

  /**
   * ⚠ ALL THREE STATES, AND THE FIRST CUT OF THIS TEST ONLY CHECKED ONE.
   * It rendered a model with a written question and asserted on that alone, so
   * the two ABSENCE strings were never examined. A mutant that put "best option
   * unknown" into the no-question copy passed the whole suite: a guard watching
   * one door while the other two stood open (trap 22b). Caught by the mutant,
   * not by review, which is the reason the loop exists.
   */
  it('states no leader, recommendation or race, in ANY of the three states', () => {
    for (const nodes of [
      [goalNode(), questionNode(WRITTEN_QUESTION), factorNode()],
      [goalNode(), questionNode(DECISION_NODE_LABEL)],
      [goalNode(), factorNode()],
    ]) {
      renderPanel(nodes)
      const text = (line().textContent ?? '').toLowerCase()
      for (const banned of [
        'winner',
        'wins',
        'leads',
        'leading',
        'best',
        'recommend',
        'should choose',
      ]) {
        expect(text, `the question line used verdict language: "${banned}"`).not.toContain(banned)
      }
      cleanup()
    }
  })

  it('CONTROL: the verdict-language detector can see verdict language', () => {
    // Without this the ruling above passes for a detector that matches nothing.
    expect('Not in this model yet, best option unknown'.toLowerCase()).toContain('best')
  })
})
