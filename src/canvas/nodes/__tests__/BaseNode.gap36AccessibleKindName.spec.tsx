/**
 * ⛔ GAP-36 (DESIGN-GAP-AUDIT-20260924.md row 36) — the card's accessible name
 * uses the USER-FACING kind word, not the code id, and ends "Open details."
 *
 * Contract §01: aria-label `"<Kind>: <title>. Open details."`. `BaseNode.tsx`
 * (at fd64ff77) built `"${nodeType} node: ${label}. ${NODE_TYPE_DESCRIPTIONS[
 * nodeType]}"` — the internal code id ("decision", "factor", …), never the
 * product word a screen-reader user or the contract expects, and no "Open
 * details." sentence at all.
 *
 * `domain/nodes.ts`'s `NODE_REGISTRY[nodeType].label` already carries the
 * exact contract vocabulary (Question/Option/Factor/Outcome/Risk/Goal —
 * `decision`'s label is `DECISION_NODE_LABEL`, "Question") and is reused here
 * rather than a second hand-typed map.
 *
 * Bound by identity: each case renders one node id and reads THAT node's own
 * `[role="group"]` root (one node per render+cleanup, following the existing
 * `contractV31Frame`/`gap17` harness), never a text predicate another card
 * could also satisfy.
 */
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import { NODE_REGISTRY } from '../../domain/nodes'

type Kind = 'goal' | 'decision' | 'option' | 'outcome' | 'factor' | 'risk'
const KINDS: readonly Kind[] = ['goal', 'decision', 'option', 'outcome', 'factor', 'risk']

function renderCard(kind: Kind, id: string, label: string) {
  const props = {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { type: kind, label },
  }
  useCanvasStore.setState({
    nodes: [props] as never,
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
  const view = render(
    <ReactFlowProvider>
      <BaseNode {...(props as any)} nodeType={kind} icon={Circle} />
    </ReactFlowProvider>,
  )
  const root = view.container.querySelector('[role="group"]') as HTMLElement
  expect(root, `card root for ${id} must render`).not.toBeNull()
  return root
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
})
afterEach(() => cleanup())

describe('GAP-36 — accessible name uses the user-facing Kind word and "Open details."', () => {
  it.each(KINDS)('%s: aria-label starts "<Kind>: <title>. Open details." — never the code id', (kind) => {
    const root = renderCard(kind, `${kind}-1`, 'Trial conversion')
    const label = root.getAttribute('aria-label') ?? ''
    const kindWord = NODE_REGISTRY[kind].label
    expect(label.startsWith(`${kindWord}: Trial conversion. Open details.`)).toBe(true)
    // The old defect, named directly: the raw code id must not appear as a
    // standalone word followed by " node:" (case-insensitive) — the "decision
    // node:" shape this gap removes.
    expect(label.toLowerCase()).not.toMatch(new RegExp(`^${kind} node:`))
  })

  it('CONTRAST — decision\'s Kind word is "Question", not the code id "decision"', () => {
    const root = renderCard('decision', 'dec-1', 'Which supplier?')
    const label = root.getAttribute('aria-label') ?? ''
    expect(label.startsWith('Question: Which supplier?. Open details.')).toBe(true)
    expect(label.toLowerCase().startsWith('decision:')).toBe(false)
  })
})
