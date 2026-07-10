/**
 * Pin (orchestrator correction 2, Lane R1+R3): store-existence is not the
 * whole fail-closed story. When the target EXISTS but no canvas focus
 * handler is registered (ReactFlowGraph not mounted — e.g. a conversation
 * surface rendered without the canvas), the pill is still clickable and a
 * click warns + no-ops. This mirrors EntityLink's existing behaviour
 * EXACTLY (focusByTarget → focusNodeById warns "before ReactFlow mounted"
 * and returns). Decision, not accident: if this ever needs to change, it
 * changes for EntityLink and TargetRefPill together, in their own lane.
 *
 * Uses the REAL focusHelpers module (no vi.mock) — that's the point.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { TargetRefPill } from '../TargetRefPill'
import { useCanvasStore } from '../../../store'
import { unregisterFocusHelpers } from '../../../utils/focusHelpers'

beforeEach(() => {
  unregisterFocusHelpers()
  useCanvasStore.setState({
    nodes: [
      { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor X' } } as any,
    ],
    edges: [],
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] })
  vi.restoreAllMocks()
})

describe('TargetRefPill with no registered focus handler', () => {
  it('click warns and no-ops — never throws (EntityLink-parity)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<TargetRefPill id="n1" label="Factor X" kind="factor" />)
    const btn = screen.getByRole('button', { name: /highlight factor x on the canvas/i })
    expect(() => btn.click()).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('before ReactFlow mounted'),
    )
  })
})
