/**
 * MG 0ebb952a (1 Oct 2026) — THE EDGE INSPECTOR NEVER CALLS A DEFINITION AN
 * ESTIMATE, AND NEVER OFFERS TO CONFIRM ONE (`cond1-readers.md` D3 + D4).
 *
 * A part → total link (CEE #2445) holds by arithmetic. Before this change its
 * inspector read "Olumi estimated this strength from your description.",
 * "Olumi's current estimate is 1." and offered "Confirm this estimate" — which
 * CEE then refuses. The twin of `EdgePanel.strengthPlaceholder.spec.tsx`.
 *
 * Edge data comes from the real `mapDraftEdgeToCanvas` over the wire edge whose
 * `provenance` is verbatim from the MG CEE probe (see
 * `domain/__tests__/strengthDefinitional.spec.ts`). The CONTROL is the same
 * wire without `definitional`: it renders the confirm row, so its absence on the
 * definition is measured, not vacuous. Rendered text only; jsdom proves no layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const NATURAL = {
  amount: 1,
  amount_unit: '% of upcoming sprint capacity',
  per_source_change: 1,
  per_source_change_unit: '% of upcoming sprint capacity',
  strength_mean: 1,
  strength_mean_frame: 'edge_strength',
}
const DEFINITIONAL: WireEdge = {
  from: 'part',
  to: 'total',
  strength: { mean: 1, std: 0.001 },
  exists_probability: 1,
  effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL, definitional: true },
}
const ESTIMATE: WireEdge = {
  ...DEFINITIONAL,
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL },
}

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

function seed(wire: WireEdge) {
  const mapped = mapDraftEdgeToCanvas({ ...wire }, 0)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'part', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sprint capacity on AI reporting' } },
      { id: 'total', type: 'factor', position: { x: 0, y: 200 }, data: { label: 'Total sprint capacity allocated' } },
    ],
    edges: [{ ...mapped, id: 'e1' }],
    results: { status: 'none', report: null },
  } as never)
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — a link that holds by definition', () => {
  it('CONTROL: the same wire as an Olumi estimate says "estimated" and offers the confirm', () => {
    seed(ESTIMATE)
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-values-provenance').textContent).toContain('Olumi estimated this strength')
    expect(screen.getByTestId('edge-confirm-current-strength')).toBeTruthy()
  })

  it('D4: says it holds by definition, and not that Olumi estimated it', () => {
    seed(DEFINITIONAL)
    render(<EdgePanel {...panelProps} />)
    const provenance = screen.getByTestId('edge-values-provenance').textContent ?? ''
    expect(provenance).toContain('This link holds by definition')
    expect(provenance).not.toContain('Olumi estimated')
  })

  it('D3: offers no "Confirm this estimate" and no "Olumi’s current estimate is …"', () => {
    seed(DEFINITIONAL)
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-confirm-current-strength')).toBeNull()
    expect(container.textContent).not.toMatch(/current estimate is/)
    // No sentence anywhere in the pane calls this link an estimate — the only
    // "estimate" left is the denial in the definitional sentence itself.
    const t = (container.textContent ?? '').replace('It is arithmetic, not an estimate.', '')
    expect(t).not.toMatch(/estimat/i)
  })
})
