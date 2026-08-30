/**
 * FirstModelNotice — a generated model must say it is a starting point, and
 * must stop saying it the moment that stops being true.
 *
 * ⚠ WHAT THESE TESTS ARE FOR, AND WHAT THEY CANNOT REACH. jsdom proves the
 * component's DECISION, never that a user sees it: the mount lives in
 * `ReactFlowGraph`'s top-centre column and only a real browser can say whether
 * it is on screen and clear of the chips above it. That is a separate witness.
 *
 * ⭐ THE DISCRIMINATING PAIR, MEASURED (not asserted). Deleting the
 * `edgeValueSource` clause from `hasUserJudgedAnyElement` REDs
 * "an inspector strength edit" and "a cee stamp on a DIFFERENT field" while
 * leaving "the pre-analysis strength quick-select" GREEN. The RED proves the
 * clause is load-bearing; the GREEN proves the two clauses bind to different
 * objects rather than one covering for the other. A single biting mutant would
 * have shown only that the predicate is sensitive to something.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import {
  FirstModelNotice,
  FIRST_MODEL_NOTICE_TESTID,
  FIRST_MODEL_NOTICE_COPY,
  hasUserJudgedAnyElement,
} from '../FirstModelNotice'

const node = (data: Record<string, unknown>): Node =>
  ({ id: 'n1', position: { x: 0, y: 0 }, data }) as unknown as Node
const edge = (data: Record<string, unknown>): Edge =>
  ({ id: 'e1', source: 'a', target: 'b', data }) as unknown as Edge

describe('hasUserJudgedAnyElement', () => {
  it('is false on the element shapes a fresh draft actually produces', () => {
    // `mapDraftEdgeToCanvas` stamps 'cee', never 'user' — read at the bytes.
    expect(
      hasUserJudgedAnyElement(
        [node({ label: 'Factor', provenance: 'ai_inferred', observedState: { source: 'cee_inference' } })],
        [edge({ weight: 0.6, weightSource: 'cee', beliefExistsSource: 'cee', directionSource: 'cee' })],
      ),
    ).toBe(false)
  })

  it('is false for a brief-extracted value — the model read the brief, the user did not set the number', () => {
    expect(
      hasUserJudgedAnyElement([node({ provenance: 'from_brief', observedState: { source: 'brief_extraction' } })], []),
    ).toBe(false)
  })

  it('is true on an inspector strength edit — the case isReviewedEdge alone cannot see', () => {
    // `useInspectorMutations.setStrength` writes `weightSource: 'user'` and NO
    // `userReviewedStrength`, so the precondition is pinned in-test: this
    // payload is one `isReviewedEdge` is structurally unable to recognise.
    const e = edge({ weight: 0.9, weightSource: 'user', directionSource: 'user' })
    expect((e.data as Record<string, unknown>).userReviewedStrength).toBeUndefined()
    expect(hasUserJudgedAnyElement([], [e])).toBe(true)
  })

  it('is true on the pre-analysis strength quick-select', () => {
    expect(hasUserJudgedAnyElement([], [edge({ userReviewedStrength: true })])).toBe(true)
  })

  it('is true on a confirmed node value, and false again once the confirmation is withdrawn', () => {
    expect(hasUserJudgedAnyElement([node({ observed_state: { source: 'user_confirmed' } })], [])).toBe(true)
    expect(
      hasUserJudgedAnyElement(
        [node({ observed_state: { source: 'user_confirmed' }, userConfirmationWithdrawn: true })],
        [],
      ),
    ).toBe(false)
  })

  it('is true on the server rung — a CEE-applied user_set', () => {
    expect(hasUserJudgedAnyElement([node({ provenance: 'user_set' })], [])).toBe(true)
  })

  it('binds to the value "user", not to the presence of a marker', () => {
    expect(hasUserJudgedAnyElement([], [edge({ strengthStdSource: 'cee' })])).toBe(false)
    expect(hasUserJudgedAnyElement([], [edge({ strengthStdSource: 'user' })])).toBe(true)
  })
})

const storeNode = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id, ...extra } }) as never
const storeEdge = (data: Record<string, unknown>) =>
  ({ id: 'e1', source: 'n1', target: 'n2', data }) as never

describe('FirstModelNotice', () => {
  beforeEach(() => {
    useCanvasStore.setState({ nodes: [], edges: [] })
  })

  it('is absent on an empty canvas — there is no model to characterise', () => {
    render(<FirstModelNotice />)
    expect(screen.queryByTestId(FIRST_MODEL_NOTICE_TESTID)).toBeNull()
  })

  it('renders on a fresh draft graph, saying exactly the sentence the predicate supports', () => {
    useCanvasStore.setState({
      nodes: [storeNode('n1'), storeNode('n2')],
      edges: [storeEdge({ weight: 0.6, weightSource: 'cee' })],
    })
    render(<FirstModelNotice />)
    expect(screen.getByTestId(FIRST_MODEL_NOTICE_TESTID).textContent).toContain(FIRST_MODEL_NOTICE_COPY)
  })

  it('is absent on a bundled example — StarterProvenanceBanner owns that disclosure', () => {
    useCanvasStore.setState({ nodes: [storeNode('n1', { starterId: 'build-vs-buy' })], edges: [] })
    render(<FirstModelNotice />)
    expect(screen.queryByTestId(FIRST_MODEL_NOTICE_TESTID)).toBeNull()
  })

  it('is absent once a single edge strength is the user’s', () => {
    useCanvasStore.setState({
      nodes: [storeNode('n1'), storeNode('n2')],
      edges: [storeEdge({ weight: 0.9, weightSource: 'user' })],
    })
    render(<FirstModelNotice />)
    expect(screen.queryByTestId(FIRST_MODEL_NOTICE_TESTID)).toBeNull()
  })

  it('the dismiss control removes it', () => {
    useCanvasStore.setState({ nodes: [storeNode('n1')], edges: [] })
    render(<FirstModelNotice />)
    fireEvent.click(screen.getByTestId(`${FIRST_MODEL_NOTICE_TESTID}-dismiss`))
    expect(screen.queryByTestId(FIRST_MODEL_NOTICE_TESTID)).toBeNull()
  })
})
