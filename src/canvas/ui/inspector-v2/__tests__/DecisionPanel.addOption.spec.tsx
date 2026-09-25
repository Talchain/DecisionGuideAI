/**
 * DecisionPanel — "+ Add option" button.
 *
 * The button was a dead stub (no onClick). It now creates a real option node
 * linked to the decision (decision → option edge, the same store action the
 * canvas context-menu "Add option" uses) and focuses it in the inspector.
 *
 * RED-first: before the wire, clicking did nothing, so the node/edge/selection
 * assertions below would fail.
 *
 * ⚠ 24 Sep 2026 — THE CONTROL MOVED, SO THIS FILE NOW RENDERS `DecisionAddOption`.
 * It sat inside `DecisionPanel`'s options card, which the Router wraps in
 * `<fieldset disabled>`, so it was inert for every user while this spec (which
 * renders the panel directly, past the fence) stayed green. It is now its own
 * component, mounted in the Router's `quickActions` slot. This file still pins
 * the HANDLER; `DecisionPanel.addOptionIsReachable.spec.tsx` pins that a user
 * can reach it through the mounted Router, and what it sends.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DecisionAddOption } from '../panels/DecisionPanel'
import { useCanvasStore } from '../../../store'

function setStore() {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'dec1', type: 'decision', position: { x: 40, y: 40 }, data: { label: 'Decision' } },
    ],
    edges: [],
    selection: { nodeIds: new Set(['dec1']), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'none', report: null },
  } as any)
}


describe('DecisionPanel — "+ Add option" wire', () => {
  beforeEach(() => {
    useCanvasStore.setState(useCanvasStore.getState(), true)
  })

  it('creates an option node linked to the decision and focuses it', () => {
    setStore()
    const { getByTestId } = render(<DecisionAddOption decisionId="dec1" />)

    fireEvent.click(getByTestId('decision-add-option'))

    const s = useCanvasStore.getState()
    const options = s.nodes.filter(n => n.type === 'option')
    expect(options).toHaveLength(1)
    const newOption = options[0]

    // Edge runs decision → new option.
    const linkingEdge = s.edges.find(e => e.source === 'dec1' && e.target === newOption.id)
    expect(linkingEdge).toBeDefined()

    // The new option is focused (single-selected → inspector routes to it).
    expect(s.selection.nodeIds.has(newOption.id)).toBe(true)
    expect(s.selection.nodeIds.size).toBe(1)
  })
})
