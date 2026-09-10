/**
 * EdgePanel — the numeric edge-label mode must be REACHABLE.
 *
 * WHAT THIS PINS, AND WHY IT IS NOT A PRESENCE TEST
 * ------------------------------------------------
 * `useEdgeLabelMode` was built complete: a Zustand store, localStorage
 * persistence, `formatNumericLabel`, and a monospace treatment in
 * `StyledEdge.tsx:1767` that only ever runs in `numeric`. Derived at
 * `origin/staging` before this change: `setMode` had **zero callers outside
 * its own module and its tests**. Every one of those parts worked and no
 * person could reach any of them — the estate's "we build more than we plug
 * in" failure, in one store.
 *
 * So a test that merely finds a button would be the same defect one level up:
 * a control wired to a store nobody reads passes it. The two assertions that
 * carry weight are therefore:
 *
 *   1. clicking the control CHANGES `useEdgeLabelMode.getState().mode`; and
 *   2. that mode change CHANGES WHAT THE BOARD DRAWS — asserted through
 *      `getEdgeLabel`, the exact function `StyledEdge` calls (`:663`), on the
 *      exact values the panel is showing.
 *
 * (2) is what makes this a reachability claim rather than a widget claim. Drop
 * it and a control bound to a dead duplicate store still passes.
 *
 * CLAIM TYPE — rendered attributes and store state only. jsdom cannot prove
 * the label is VISIBLE on the canvas (platform trap 3) and nothing here says
 * it is; `StyledEdge` is not rendered by this file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useEdgeLabelMode } from '../../../store/edgeLabelMode'
import { getEdgeLabel } from '../../../domain/edgeLabels'
import type { EdgeValueDisplay, EdgeDirectionDisplay } from '../../../domain/edgeValueProvenance'

const panelProps = {
  edgeId: 'e1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

/** A strength and a likelihood that the two label modes render DIFFERENTLY. */
const STRENGTH = 0.6
const BELIEF = 0.85

/** The shapes `StyledEdge` hands `getEdgeLabel` — user-set, so both modes render. */
const STRENGTH_DISPLAY: EdgeValueDisplay = { show: true, value: STRENGTH, source: 'user' }
const BELIEF_DISPLAY: EdgeValueDisplay = { show: true, value: BELIEF, source: 'user' }
const DIRECTION_DISPLAY: EdgeDirectionDisplay = { show: true, direction: 'positive', source: 'user' }

function boardLabel(mode: 'human' | 'numeric'): string {
  return getEdgeLabel(STRENGTH_DISPLAY, BELIEF_DISPLAY, DIRECTION_DISPLAY, mode).label
}

function seedEdge() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    results: { status: 'none', report: null },
    edges: [{
      id: 'e1',
      source: 'fac1',
      target: 'out1',
      type: 'styled',
      data: { strength: STRENGTH, beliefExists: BELIEF },
    }],
  } as never)
}

function toggle(): HTMLElement {
  return screen.getByTestId('edge-label-mode-toggle')
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  useEdgeLabelMode.setState({ mode: 'human' })
})

describe('EdgePanel — a person can reach the numeric edge label', () => {
  it('PRECONDITION: the two modes genuinely draw different labels for this edge', () => {
    // Pins the discriminator's own power (trap 13b): if these two agreed, every
    // assertion below would hold while the control did nothing.
    const human = boardLabel('human')
    const numeric = boardLabel('numeric')
    expect(human).not.toBe(numeric)
    expect(numeric).toMatch(/[0-9]/)
  })

  it('the control flips the store the edge renderer reads', () => {
    seedEdge()
    render(<EdgePanel {...panelProps} />)

    expect(useEdgeLabelMode.getState().mode).toBe('human')
    const before = boardLabel(useEdgeLabelMode.getState().mode)

    fireEvent.click(toggle())

    expect(useEdgeLabelMode.getState().mode).toBe('numeric')
    const after = boardLabel(useEdgeLabelMode.getState().mode)
    // The board's label actually changed — not just a store field.
    expect(after).not.toBe(before)
    expect(after).toMatch(/[0-9]/)
  })

  it('the control is reversible and reports its state to assistive tech', () => {
    seedEdge()
    render(<EdgePanel {...panelProps} />)

    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(useEdgeLabelMode.getState().mode).toBe('human')
  })
})
