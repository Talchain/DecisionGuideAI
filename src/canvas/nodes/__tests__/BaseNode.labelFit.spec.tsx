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
import { render, fireEvent, act } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { NODE_RENAME_AFFORDANCE, nodeTitleChannels } from '../shared/nodeRenameAffordance'
import {
  NODE_CARD_MAX_W,
  NODE_CARD_PADDING_X,
  NODE_HEADER_RESERVE_PX,
  NODE_LAYOUT_MIN_W,
  NODE_TITLE_MIN_MEASURE_PX,
  restingCardWidthForKind,
  REPEATED_CARD_W,
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

  it('a short label is not promoted to the maximum card width — nor is a long one (S4)', () => {
    // Opposite-direction twin: the floor grew, so prove the CAP did not follow
    // it. ⭐ S4: before any layout publishes a width, a factor rests at its
    // kind's width (`REPEATED_CARD_W`), not at `NODE_CARD_MAX_W` — and the width
    // is the kind's, whatever the label (ED: one long title must not widen a
    // row).
    const short = renderNode(SHORT_LABEL).card
    expect(short.style.minWidth).toBe(`${NODE_LAYOUT_MIN_W}px`)
    expect(short.style.maxWidth).toBe(`${restingCardWidthForKind('factor')}px`)
    expect(restingCardWidthForKind('factor')).toBe(REPEATED_CARD_W)
    expect(REPEATED_CARD_W).toBeLessThan(NODE_CARD_MAX_W)
    const long = renderNode(LONG_LABEL).card
    expect(long.style.maxWidth).toBe(short.style.maxWidth)
  })
})

describe('BaseNode — a label that cannot be shown in full stays reachable', () => {
  // ⭐ v3.1 (DESIGN-GAP-v31 row 36): the route is the ONE styled tooltip on the
  // title, no longer a native `title` attribute beside it. The guarantee this
  // file owns is unchanged — the complete label, first, bound to THIS node.
  function hoverName(title: HTMLElement): string | null {
    vi.useFakeTimers()
    try {
      act(() => {
        fireEvent.mouseEnter(title)
        vi.advanceTimersByTime(400)
      })
    } finally {
      vi.useRealTimers()
    }
    return document.querySelector('[data-testid="node-title-tooltip-name"]')?.textContent ?? null
  }

  it('carries the complete label in the styled name tooltip (DS v5 §2.4)', () => {
    // `line-clamp-3` ellipsises at the clamp, so the rendered text is a PREFIX
    // of the label. DS v5 §2.4 requires anything shown small or truncated to be
    // reachable at a readable size; this is that guarantee for sighted users,
    // and the group's aria-label is its assistive-tech twin.
    const { title } = renderNode(LONG_LABEL)
    // `title=""` is the shared Tooltip's own blocker for inherited native
    // tooltips — no native tooltip text either way.
    expect(title.getAttribute('title') ?? '', 'no native title — one tooltip system').toBe('')
    // Bound to the COMPOSER, and to the full label (never a prefix).
    expect(hoverName(title)).toBe(nodeTitleChannels({ label: LONG_LABEL, accessibleName: '' }).tooltip.name)
    expect(nodeTitleChannels({ label: LONG_LABEL, accessibleName: '' }).tooltip.name).toBe(LONG_LABEL)
  })

  it('binds the reachable text to THIS node’s label, not to any label', () => {
    // Identity, not a value predicate: a tooltip carrying some other node's
    // text, or a static string, would satisfy "has a tooltip".
    const { title } = renderNode(SHORT_LABEL)
    const name = hoverName(title)
    expect(name).toBe(SHORT_LABEL)
    // Still discriminating in both directions a static string would defeat.
    expect(name).not.toContain(LONG_LABEL)
    expect(name).not.toBe(NODE_RENAME_AFFORDANCE)
  })
})
