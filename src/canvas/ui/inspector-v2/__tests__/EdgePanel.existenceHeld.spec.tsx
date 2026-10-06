/**
 * ⭐ D3 cut 6 HOLD-AT-1.0 (DL 0df0e1: UI in scope; words c6): the edge inspector shows the existence the Run USES. A link
 * CEE holds at 1.0 (the user's own range excludes zero) reads as held ("Very likely to exist", 1.0) with c6's note; the twin
 * keeps its stored 0.8 ("Likely to exist") and no note.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { EDGE_COPY } from '../inspectorStrings'

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
function seedEdge(data: Record<string, unknown>) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Subscribers' } },
    ],
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
    results: { status: 'none', report: null },
  } as never)
}
const STORED = { weight: 0.4, beliefExists: 0.8, exists_probability: 0.8 }

describe('the inspector shows the existence the Run uses', () => {
  it('HELD: 100% and c6\'s note, exactly', () => {
    seedEdge({ ...STORED, existenceHeld: true })
    render(<EdgePanel {...panelProps} />)
    // Default (human) label mode says the band in words: 1.0 → "Very likely to exist".
    expect(screen.getByTestId('edge-existence-readout').textContent).toContain('Very likely to exist')
    expect(screen.getByTestId('edge-existence-held-note').textContent).toBe(EDGE_COPY.existenceHeldNote)
    expect(EDGE_COPY.existenceHeldNote).toBe('Held at 100%: your own range for this link’s effect doesn’t include zero, so the analysis treats the link as existing.')
  })
  it('TWIN (not held): its stored 80%, no note', () => {
    seedEdge({ ...STORED })
    render(<EdgePanel {...panelProps} />)
    const readout = screen.getByTestId('edge-existence-readout').textContent ?? ''
    expect(readout).toContain('Likely to exist')
    expect(readout).not.toContain('Very likely')
    expect(screen.queryByTestId('edge-existence-held-note')).toBeNull()
  })
})
