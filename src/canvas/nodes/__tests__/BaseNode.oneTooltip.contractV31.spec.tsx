/**
 * Canvas visual contract v3.1 — ONE tooltip system (DESIGN-GAP-v31 row 36).
 *
 *   `.tooltip{background:#303A3A;border-radius:7px;font-size:12px;max-width:300px}`
 *   Served (`eec722ab`): the styled tooltip was #262626, radius 12px, max 200px,
 *   AND every card name carried a native `title` ("<name>\n\nDouble-click to
 *   rename it", 15/15 cards) — two tooltip systems on one card.
 *
 * Pinned, on all six kinds: the name has NO native `title`; hovering it shows
 * the ONE styled tooltip, carrying the full name (the name is `line-clamp-2`,
 * so this is still the reader's route back to a clipped name — v3.1: "keep full
 * labels accessible through focus/click as well as hover"); and the rename
 * affordance is still ADVERTISED — in that same tooltip, after the name, and on
 * the accessible name.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Target } from 'lucide-react'
import { BaseNode } from '../BaseNode'
import { NODE_RENAME_AFFORDANCE } from '../shared/nodeRenameAffordance'
import { TOOLTIP_SURFACE_CLASS } from '../../../components/Tooltip'

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

describe('v3.1 row 36 — a card name has one tooltip, the styled one', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  for (const kind of KINDS) {
    it(`${kind}: no native title on the name; hover shows the styled tooltip with the full name`, () => {
      const { title, card } = renderCard(kind)
      expect(title.getAttribute('title') ?? '').toBe('')
      act(() => {
        fireEvent.mouseEnter(title)
        vi.advanceTimersByTime(400)
      })
      const name = document.querySelector('[data-testid="node-title-tooltip-name"]')
      expect(name?.textContent, 'the styled tooltip carries the full name').toBe(LABEL)
      const tip = name!.closest('[role="tooltip"]') as HTMLElement
      for (const token of TOOLTIP_SURFACE_CLASS.split(/\s+/)) expect(tip.className).toContain(token)
      // The affordance is still advertised — in the same tooltip, after the
      // name, and on the accessible name.
      expect(tip.textContent).toBe(`${LABEL}${NODE_RENAME_AFFORDANCE}`)
      expect(card?.getAttribute('aria-label') ?? '').toContain(NODE_RENAME_AFFORDANCE)
    })
  }
})
