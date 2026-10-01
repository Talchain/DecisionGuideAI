/**
 * MG ruling (1 Oct 2026) — THE LINK MINI-EDITOR OFFERS NO STRENGTH AND NO
 * DIRECTION ON A LINK THAT HOLDS BY DEFINITION, AND SAYS WHAT THE LINK IS.
 *
 * The mini-editor opens on a plain click on any link, so it is the strength
 * editor people reach first — and it never asked `edgeStrengthEditIsAssertable`:
 * it offered bands and Increases/Decreases on a part → total link, and CEE
 * refuses both writes there. Controls on the same fixture: the wire without
 * `definitional`, and the definitional link whose weight the person set
 * (`weightSource: 'user'`) — both keep today's editor. Words bound as literals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { LinkQuickEditor } from '../LinkQuickEditor'
import { useCanvasStore } from '../../store'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

const setStrength = vi.fn()
const setDirection = vi.fn()
vi.mock('../../ui/inspector-v2/useInspectorMutations', () => ({ useEdgeMutations: () => ({ setStrength, setDirection }) }))

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
const SENTENCE =
  'This link holds by definition: each unit of the cause counts as exactly one unit of the effect. It is arithmetic, not an estimate.'

function seed(variant: 'definitional' | 'estimate' | 'user') {
  const mapped = mapDraftEdgeToCanvas({ ...(variant === 'estimate' ? ESTIMATE : DEFINITIONAL) }, 0)
  const data = variant === 'user'
    ? { ...(mapped.data as Record<string, unknown>), weightSource: 'user' }
    : mapped.data
  useCanvasStore.setState({
    nodes: [
      { id: 'part', type: 'factor', data: { label: 'Sprint capacity on AI reporting' } },
      { id: 'total', type: 'factor', data: { label: 'Total sprint capacity allocated' } },
    ],
    edges: [{ id: 'e1', source: 'part', target: 'total', data }],
  } as never)
}
const mount = () => render(<LinkQuickEditor edgeId="e1" x={100} y={100} onClose={vi.fn()} onMoreDetail={vi.fn()} />)

beforeEach(() => { cleanup(); setStrength.mockReset(); setDirection.mockReset() })

describe('the link mini-editor on a link that holds by definition', () => {
  it('offers no direction and no strength bands — only "More detail"', () => {
    seed('definitional')
    mount()
    expect(screen.queryByTestId('link-quick-editor-direction')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Strength presets' })).toBeNull()
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(['More detail'])
  })

  it("says the definition in the inspector's own words, never the no-strength sentence", () => {
    seed('definitional')
    mount()
    expect(screen.getByTestId('link-quick-editor-definitional').textContent).toBe(SENTENCE)
    expect(screen.queryByTestId('link-quick-editor-no-strength')).toBeNull()
    expect(setStrength).not.toHaveBeenCalled()
    expect(setDirection).not.toHaveBeenCalled()
  })

  it('CONTROL: the same wire as an Olumi estimate keeps direction and bands, and a band writes', () => {
    seed('estimate')
    mount()
    expect(screen.getByTestId('link-quick-editor-direction')).toBeTruthy()
    const presets = screen.getByRole('group', { name: 'Strength presets' })
    fireEvent.click(presets.querySelectorAll('button')[0])
    expect(setStrength).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('link-quick-editor-definitional')).toBeNull()
  })

  it("CONTROL: a definitional link whose weight the person set keeps direction and bands", () => {
    seed('user')
    mount()
    expect(screen.getByTestId('link-quick-editor-direction')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Strength presets' })).toBeTruthy()
    expect(screen.queryByTestId('link-quick-editor-definitional')).toBeNull()
  })
})
