/**
 * ⭐⭐⭐ EVERY NODE KIND ADVERTISES THE ONE EDIT IT ACTUALLY SUPPORTS.
 *
 * The full measurement and the reason the answer is the LABEL and not a value
 * editor are in `shared/nodeRenameAffordance.ts`. In one line: seven
 * model-changing wire verbs exist and none of them carries an arbitrary node
 * field, so the label is the only field with a carrier on all six kinds — and
 * no card mentioned it.
 *
 * ⛔ THE SCOPE LIMIT, STATED: jsdom pins the CHANNELS, never that a
 * double-click opens anything. The reachability of the rename field on the
 * served build is a browser witness (`e2e/canvas-witness/renameReachability.spec.ts`),
 * and `inspector-v2/__tests__/inspectorRenameReachability.spec.tsx` holds the
 * panel half.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { NODE_RENAME_AFFORDANCE, nodeTitleChannels } from '../shared/nodeRenameAffordance'

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
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    winRate: null, isResultsMode: false,
  })),
}))

const baseProps = {
  id: 'node-1', selected: false, dragging: false, zIndex: 0, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, xPos: 0, yPos: 0,
  deletable: true, selectable: true, draggable: true,
}

/** ⛔ ALL SIX, ENUMERATED — the finding was that five of them were silent. */
const KINDS = ['decision', 'goal', 'option', 'factor', 'outcome', 'risk'] as const
const LABEL = 'Transition to usage-based pricing'

function renderCard(nodeType: (typeof KINDS)[number]) {
  const { container } = render(
    <BaseNode {...baseProps} type={nodeType} data={{ label: LABEL }} nodeType={nodeType} icon={Target} />,
  )
  const title = container.querySelector('[data-testid="node-title"]') as HTMLElement | null
  expect(title, 'node-title must exist — bound by testid, never by class').toBeTruthy()
  const card = container.querySelector('[aria-label]') as HTMLElement | null
  return { title: title as HTMLElement, card }
}

/**
 * ⭐ v3.1 (DESIGN-GAP-v31 row 36): the name and the affordance moved from a
 * NATIVE `title` to the ONE styled tooltip on the title — same two facts, same
 * order, one tooltip system. Bound to the tooltip's own parts by test id.
 */
function hoverName(title: HTMLElement): HTMLElement {
  act(() => {
    fireEvent.mouseEnter(title)
    vi.advanceTimersByTime(400)
  })
  const name = document.querySelector('[data-testid="node-title-tooltip-name"]')
  expect(name, 'the styled name tooltip did not open').not.toBeNull()
  return name!.closest('[role="tooltip"]') as HTMLElement
}

describe('the rename affordance reaches every node kind', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  for (const kind of KINDS) {
    // ⭐ AMENDED 26 Sep 2026 (design audit #13): the hover no longer carries the
    // instruction. The inspector's title is the rename control, and the
    // accessible name (below) still says what a double-click does.
    it(`${kind}: the name's tooltip carries no instruction chrome`, () => {
      const { title } = renderCard(kind)
      // `title=""` is the shared Tooltip's own blocker for inherited native
      // tooltips — no native tooltip text either way.
      expect(title.getAttribute('title') ?? '', 'no native title — one tooltip system').toBe('')
      const tip = hoverName(title)
      expect(tip.querySelector('[data-testid="node-title-tooltip-affordance"]')).toBeNull()
      expect(tip.textContent).not.toContain(NODE_RENAME_AFFORDANCE)
    })

    it(`${kind}: the label still rides in the same tooltip, FIRST — the contrast control`, () => {
      // `node-title` is `line-clamp-2`; the tooltip is the hover route back to
      // a clipped name. Replacing the name with a hint would trade a capability
      // for a tooltip, so this REDs on a replace and passes on a compose.
      const tip = hoverName(renderCard(kind).title)
      expect(tip.querySelector('[data-testid="node-title-tooltip-name"]')!.textContent).toBe(LABEL)
      expect((tip.textContent ?? '').indexOf(LABEL)).toBe(0)
    })

    it(`${kind}: the accessible name carries it too`, () => {
      const { card } = renderCard(kind)
      expect(card?.getAttribute('aria-label') ?? '').toContain(NODE_RENAME_AFFORDANCE)
    })
  }
})

describe('the affordance promises the interaction and nothing about the model', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('never claims the change is saved, shared or persisted', () => {
    // ⛔ `canvasNodeRenameWithServerHash` is conditional on a CEE-stamped
    // graph hash the card cannot see, and #1025 reverted a rename CTA once
    // already. A future edit adding a durability claim REDs here.
    const { title, card } = renderCard('risk')
    const tip = hoverName(title)
    const hay = `${tip.textContent ?? ''} ${card?.getAttribute('aria-label') ?? ''}`
    for (const forbidden of [/saved/i, /persist/i, /shared model/i, /will be kept/i]) {
      expect(hay, `the affordance must not claim durability: ${forbidden}`).not.toMatch(forbidden)
    }
  })

  it('composes the label FIRST, so a clipped name is recoverable at a glance', () => {
    const c = nodeTitleChannels({ label: LABEL, accessibleName: 'risk node: X.' })
    expect(c.tooltip).toEqual({ name: LABEL })
    expect(c.accessibleName).toBe(`risk node: X. ${NODE_RENAME_AFFORDANCE}`)
  })

  it('offers no tooltip when a node has no name yet; the accessible name still says it', () => {
    const c = nodeTitleChannels({ label: '   ', accessibleName: 'risk node: X.' })
    expect(c.tooltip.name).toBeNull()
    expect(c.accessibleName).toContain(NODE_RENAME_AFFORDANCE)
  })
})
