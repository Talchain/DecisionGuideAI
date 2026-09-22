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
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
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

describe('the rename affordance reaches every node kind', () => {
  for (const kind of KINDS) {
    it(`${kind}: the title says what a double-click does`, () => {
      const { title } = renderCard(kind)
      expect(title.getAttribute('title') ?? '').toContain(NODE_RENAME_AFFORDANCE)
    })

    it(`${kind}: the label still rides in the same attribute — the contrast control`, () => {
      // `node-title` is `line-clamp-2`; `title` is the only way back to a
      // clipped name. Replacing it with a hint would trade a capability for a
      // tooltip, so this REDs on a replace and passes on a compose.
      expect(renderCard(kind).title.getAttribute('title') ?? '').toContain(LABEL)
    })

    it(`${kind}: the accessible name carries it too`, () => {
      const { card } = renderCard(kind)
      expect(card?.getAttribute('aria-label') ?? '').toContain(NODE_RENAME_AFFORDANCE)
    })
  }
})

describe('the affordance promises the interaction and nothing about the model', () => {
  it('never claims the change is saved, shared or persisted', () => {
    // ⛔ `canvasNodeRenameWithServerHash` is conditional on a CEE-stamped
    // graph hash the card cannot see, and #1025 reverted a rename CTA once
    // already. A future edit adding a durability claim REDs here.
    const { title, card } = renderCard('risk')
    const hay = `${title.getAttribute('title') ?? ''} ${card?.getAttribute('aria-label') ?? ''}`
    for (const forbidden of [/saved/i, /persist/i, /shared model/i, /will be kept/i]) {
      expect(hay, `the affordance must not claim durability: ${forbidden}`).not.toMatch(forbidden)
    }
  })

  it('composes the label FIRST, so a clipped name is recoverable at a glance', () => {
    const c = nodeTitleChannels({ label: LABEL, accessibleName: 'risk node: X.' })
    expect(c.title.indexOf(LABEL)).toBe(0)
    expect(c.title).toContain(NODE_RENAME_AFFORDANCE)
  })

  it('still says the useful thing when a node has no name yet', () => {
    const c = nodeTitleChannels({ label: '   ', accessibleName: 'risk node: X.' })
    expect(c.title).toBe(NODE_RENAME_AFFORDANCE)
  })
})
