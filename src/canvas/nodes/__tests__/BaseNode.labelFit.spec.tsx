/**
 * BaseNode — the rendered card honours the label-scale-derived geometry, and a
 * label that cannot be shown in full stays reachable.
 *
 * These are the parts of the #758 fix that live in the COMPONENT rather than in
 * the constants, so they need a detector inside the required gate. The
 * in-browser fit measurement is `e2e/visual/nodeLabelFit.visual.spec.ts`; it is
 * the only thing that can see a line box, and it is NOT in `Staging Gate`.
 * Without this file, deleting `title={label}` or re-hardcoding the card floor
 * would go green on every check that blocks a merge.
 *
 * jsdom cannot prove any of this is LEGIBLE. What it proves is that the values
 * the component hands the browser come from the shared derivation rather than
 * from a literal that will not move when the label scale does.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_TITLE_MIN_MEASURE_PX,
} from '../../utils/nodeLayoutConstants'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null, useUpdateNodeInternals: () => vi.fn() }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      results: { status: 'idle' },
      goalThreshold: null,
      goalConstraints: [],
      edges: [],
      viewMode: 'expert',
    }),
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'node-1',
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'factor',
  xPos: 0,
  yPos: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

/** A label the starters actually contain, which the clamp ellipsises. */
const LONG_LABEL = 'Engineering Overload and Platform Migration Delay'
const SHORT_LABEL = 'Current ARR'

function renderNode(label: string, maxWidth?: number) {
  const { container } = render(
    <BaseNode {...baseProps} data={{ label }} nodeType="factor" icon={Target} maxWidth={maxWidth} />,
  )
  const title = container.querySelector('[data-testid="node-title"]') as HTMLElement | null
  expect(title, 'node-title must exist — bound by testid, never by class').toBeTruthy()
  const card = container.querySelector('[role="group"]') as HTMLElement
  return { card, title: title as HTMLElement, wrapper: (title as HTMLElement).parentElement as HTMLElement }
}

describe('BaseNode — the card floor comes from the shared derivation', () => {
  it('takes its minimum width from NODE_LAYOUT_MIN_W, not a restated literal', () => {
    // This was `'140px'` hardcoded beside an identical `NODE_LAYOUT_MIN_W`.
    // Re-hardcoding it is the mutation this assertion exists to catch: the
    // constant would carry the label scale and the card would not.
    const { card } = renderNode(LONG_LABEL)
    expect(card.style.minWidth).toBe(`${NODE_LAYOUT_MIN_W}px`)
  })

  it('gives the title the full derived measure once the card can afford it', () => {
    const { wrapper } = renderNode(LONG_LABEL, NODE_LAYOUT_MIN_W)
    expect(wrapper.style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
  })

  it('never demands more measure than the card it is rendered in can give', () => {
    // A caller passing a narrower `maxWidth` must not have the title's own
    // min-width push the card wider than the box ELK placed it in. Bound by
    // ARITHMETIC — the only honest way to make a width claim in jsdom.
    const narrow = 180
    expect(narrow).toBeLessThan(NODE_LAYOUT_MIN_W)
    const { wrapper } = renderNode(LONG_LABEL, narrow)
    expect(wrapper.style.minWidth).toBe(`${narrow - NODE_CARD_PADDING_X - NODE_HEADER_RESERVE_PX}px`)
  })

  it('a short label is not promoted to the maximum card width', () => {
    // Opposite-direction twin: the floor grew, so prove the CAP did not follow
    // it and a short label still packs at the floor.
    const { card } = renderNode(SHORT_LABEL)
    expect(card.style.minWidth).toBe(`${NODE_LAYOUT_MIN_W}px`)
    expect(card.style.maxWidth).toBe(`${NODE_CARD_MAX_W}px`)
    expect(NODE_LAYOUT_MIN_W).toBeLessThan(NODE_CARD_MAX_W)
  })
})

describe('BaseNode — a label that cannot be shown in full stays reachable', () => {
  it('carries the complete label as a title attribute (DS v5 §2.4)', () => {
    // `line-clamp-3` ellipsises at the clamp, so the rendered text is a PREFIX
    // of the label. DS v5 §2.4 requires anything shown small or truncated to be
    // reachable at a readable size; this is that guarantee for sighted users,
    // and the group's aria-label is its assistive-tech twin.
    const { title } = renderNode(LONG_LABEL)
    expect(title.getAttribute('title')).toBe(LONG_LABEL)
  })

  it('binds the reachable text to THIS node’s label, not to any label', () => {
    // Identity, not a value predicate: a `title` carrying some other node's
    // text, or a static string, would satisfy "has a title attribute".
    const { title } = renderNode(SHORT_LABEL)
    expect(title.getAttribute('title')).toBe(SHORT_LABEL)
    expect(title.getAttribute('title')).not.toBe(LONG_LABEL)
  })
})
