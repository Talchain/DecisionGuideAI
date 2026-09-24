/**
 * ⛔ GAP-17 (DESIGN-GAP-AUDIT-20260924.md row 17) — the card frame is ALWAYS
 * solid. Contract §02 `.node{border:1px solid …}`; §03 "Dash = a recorded
 * doubt about existence" and v3.1 pt4: "Dash remains existence certainty
 * only" — a CONNECTION channel, never a card-frame channel.
 *
 * `BaseNode.tsx:868-886` (at fd64ff77) borrowed that same dash to mean
 * "outside your control" (external category) or "downstream, not directly
 * set" (observable/partial controllability). This spec pins the removal:
 * every factor card frame is solid regardless of category/controllability.
 * No replacement visual channel is introduced — none of BaseNode/FactorNode
 * carries an existing non-dash channel for this distinction today (verified
 * by grep before writing this spec), so the dash is simply dropped.
 *
 * Bound by identity: each case renders one factor node id and reads ITS OWN
 * root's class list (role=group), never a substring match across the DOM.
 */
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'

function renderFactorCard(id: string, data: Record<string, unknown>) {
  const props = {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { type: 'factor', ...data },
  }
  useCanvasStore.setState({
    nodes: [props] as never,
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
  const view = render(
    <ReactFlowProvider>
      <BaseNode {...(props as any)} nodeType="factor" icon={Circle} />
    </ReactFlowProvider>,
  )
  const group = view.container.querySelector('[role="group"]') as HTMLElement
  expect(group, `card root for ${id} must render`).not.toBeNull()
  expect(group.getAttribute('aria-label'), `card root for ${id} must be its own node`).toContain(
    (data.label as string) ?? '',
  )
  return group
}

const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
})
afterEach(() => cleanup())

describe('GAP-17 — factor card frames are solid; dash is dropped, not relocated', () => {
  it('external-category factor (id=weather-ext): SOLID frame, no border-dashed / border-dotted', () => {
    const root = renderFactorCard('weather-ext', { label: 'Weather', category: 'external' })
    const t = tokens(root)
    expect(t).not.toContain('border-dashed')
    expect(t).not.toContain('border-dotted')
  })

  it('partial-controllability factor (id=downstream-partial): SOLID frame, no border-dashed', () => {
    // A stated value is required so the card is NOT `isIncomplete` (which
    // already forces solid via a different branch) — this exercises the
    // controllability->borderStyle path the gap actually names.
    const root = renderFactorCard('downstream-partial', {
      label: 'Downstream effect',
      controllability: 'partial',
      observedState: { value: 0.4, source: 'user_override' },
    })
    const t = tokens(root)
    expect(t).not.toContain('border-dashed')
  })

  it('observable-controllability factor (id=baseline-observable): SOLID frame, no border-dashed', () => {
    const root = renderFactorCard('baseline-observable', {
      label: 'Baseline',
      controllability: 'observable',
      observedState: { value: 0.6, source: 'user_override' },
    })
    const t = tokens(root)
    expect(t).not.toContain('border-dashed')
  })

  it('CONTRAST — a controllable factor (id=hiring-controllable) was already solid, and stays solid', () => {
    const root = renderFactorCard('hiring-controllable', {
      label: 'Hiring rate',
      controllability: 'controllable',
      observedState: { value: 0.7, source: 'user_override' },
    })
    const t = tokens(root)
    expect(t).not.toContain('border-dashed')
    expect(t).not.toContain('border-dotted')
  })
})
