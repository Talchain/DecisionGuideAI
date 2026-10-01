/**
 * MG 0ebb952a (1 Oct 2026) — THE FACTOR CARD'S LINK PILL NEVER CALLS A
 * DEFINITION "Olumi’s estimate … not yet confirmed" (`cond1-readers.md` D7).
 *
 * The pill renders outbound links to outcome/risk targets. A definitional link
 * there (a part summed into an outcome total) read "· Link strength est." with
 * the title "Link strength · Olumi’s estimate: 100%, not yet confirmed". It now
 * prints the figure and says "by definition". Edge data from the real
 * `mapDraftEdgeToCanvas` over the MG-probe wire edge; CONTROL = the same wire
 * without `definitional`, and the user's own (`user_specified`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePills } from '../EdgePills'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn(),
}))

import { useCanvasStore } from '../../../store'

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
  from: 'f1',
  to: 'o1',
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
const USER_STATED: WireEdge = {
  ...DEFINITIONAL,
  provenance_display: 'user_set',
  provenance: { source: 'user_specified', magnitude: 'user_stated', natural_effect: NATURAL },
}

function renderPill(wire: WireEdge) {
  const data = mapDraftEdgeToCanvas({ ...wire }, 0).data
  const state = {
    edges: [{ id: 'e1', source: 'f1', target: 'o1', data }],
    nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Total sprint capacity allocated' } }],
  }
  vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(state as never))
  return render(<EdgePills nodeId="f1" />).container
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EdgePills — a link that holds by definition', () => {
  it('prints the figure with "by definition", and no "Olumi’s estimate … not yet confirmed"', () => {
    const c = renderPill(DEFINITIONAL)
    const pill = screen.getByTestId('edge-pill-strength-definitional-e1')
    expect(pill.getAttribute('title')).toBe('Link strength: 100%, by definition')
    expect(pill.querySelector('.sr-only')!.textContent).toBe(' (by definition)')
    expect(screen.queryByTestId('edge-pill-strength-estimate-e1')).toBeNull()
    expect(c.innerHTML).not.toMatch(/Olumi|not yet confirmed/)
  })

  it('CONTROL: the same wire as an Olumi estimate keeps the estimate pill', () => {
    renderPill(ESTIMATE)
    expect(screen.getByTestId('edge-pill-strength-estimate-e1').getAttribute('title')).toBe(
      'Link strength · Olumi’s estimate: 100%, not yet confirmed',
    )
    expect(screen.queryByTestId('edge-pill-strength-definitional-e1')).toBeNull()
  })

  it("CONTROL: the user's own keeps the settled pill (unchanged)", () => {
    renderPill(USER_STATED)
    expect(screen.getByTestId('edge-pill-strength-e1').getAttribute('title')).toBe('Link strength: 100%, set by a person')
  })
})
