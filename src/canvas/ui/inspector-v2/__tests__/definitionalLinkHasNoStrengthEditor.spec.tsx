/**
 * MG ruling (1 Oct 2026) — THE EDGE INSPECTOR OPENS NO STRENGTH EDITOR ON A LINK
 * THAT HOLDS BY DEFINITION, AND SAYS SO IN THE DEFINITION'S WORDS.
 *
 * Three entry points in one pane:
 *   P — `EdgePanel`'s strength fieldset (direction, bands, fine-tune, β), which
 *       `edgeStrengthEditIsAssertable` left ENABLED on a definitional link;
 *   N — `InspectorRouter`'s footer note, which said "The link strength saves to
 *       the shared model" — false, CEE refuses the write;
 *   A — `EdgeAdvancedEditor`'s techMode β and "Effect direction" fields, which
 *       never asked the gate at all.
 *
 * Edge data comes from the real `mapDraftEdgeToCanvas` over the MG CEE probe
 * wire (as `EdgePanel.strengthDefinitional.spec.tsx`). Every row has two
 * controls on the same fixture: the wire without `definitional`, and the
 * definitional link whose weight the person set (`weightSource: 'user'`) —
 * both keep today's editor. Words are bound as exact literals. Rendered DOM
 * only; jsdom proves no layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }
})

import { EdgePanel } from '../panels/EdgePanel'
import { InspectorRouter } from '../InspectorRouter'
import { EdgeAdvancedEditor } from '../editors/EdgeAdvancedEditor'
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

const SENTENCE =
  'This link holds by definition: each unit of the cause counts as exactly one unit of the effect. It is arithmetic, not an estimate.'
const NO_BASIS = 'no strength on record'

type Variant = 'definitional' | 'estimate' | 'user'
function seed(variant: Variant) {
  const mapped = mapDraftEdgeToCanvas({ ...(variant === 'estimate' ? ESTIMATE : DEFINITIONAL) }, 0)
  const data = variant === 'user'
    ? { ...(mapped.data as Record<string, unknown>), weightSource: 'user' }
    : mapped.data
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'part', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sprint capacity on AI reporting' } },
      { id: 'total', type: 'factor', position: { x: 0, y: 200 }, data: { label: 'Total sprint capacity allocated' } },
    ],
    edges: [{ ...mapped, id: 'e1', data }],
    results: { status: 'none', report: null },
  } as never)
}

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

beforeEach(() => {
  cleanup()
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('P — EdgePanel: the strength editor', () => {
  it('a definitional link renders no strength fieldset, no direction control and no strength presets', () => {
    seed('definitional')
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-strength-controls')).toBeNull()
    expect(screen.queryByTestId('edge-direction-control')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Strength presets' })).toBeNull()
  })

  it('…and shows the definition where the editor was, never the no-basis reason', () => {
    seed('definitional')
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-strength-definitional').textContent).toBe('Link strength: by definition')
    expect(screen.getByTestId('edge-values-provenance').textContent).toContain(SENTENCE)
    expect(container.textContent).not.toContain(NO_BASIS)
  })

  it('CONTROL: the same wire as an Olumi estimate keeps the enabled editor, exactly as today', () => {
    seed('estimate')
    render(<EdgePanel {...panelProps} />)
    const fieldset = screen.getByTestId('edge-strength-controls')
    expect(fieldset.hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('group', { name: 'Strength presets' })).toBeTruthy()
    expect(screen.queryByTestId('edge-strength-definitional')).toBeNull()
  })

  it("CONTROL: a definitional link whose weight the person set keeps the enabled editor", () => {
    seed('user')
    render(<EdgePanel {...panelProps} />)
    const fieldset = screen.getByTestId('edge-strength-controls')
    expect(fieldset.hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('group', { name: 'Strength presets' })).toBeTruthy()
    expect(screen.queryByTestId('edge-strength-definitional')).toBeNull()
  })
})

describe("N — InspectorRouter: the pane's note on what saves", () => {
  const note = () => screen.getByTestId('inspector-authority-notice').textContent

  it('a definitional link: the definition, never "saves to the shared model" and never the no-basis reason', () => {
    seed('definitional')
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(note()).toBe('This link holds by definition, so its strength is not changed here. Other edits here are not sent yet.')
    expect(note()).not.toContain('saves to the shared model')
    expect(note()).not.toContain(NO_BASIS)
  })

  it('CONTROL: the Olumi estimate keeps "The link strength saves to the shared model"', () => {
    seed('estimate')
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(note()).toBe('The link strength saves to the shared model. Other edits here are not sent yet.')
  })

  it("CONTROL: the person's own weight keeps it too", () => {
    seed('user')
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(note()).toBe('The link strength saves to the shared model. Other edits here are not sent yet.')
  })
})

describe('A — EdgeAdvancedEditor (techMode): β and direction', () => {
  const beta = () => screen.getByLabelText('Effect coefficient (β)') as HTMLInputElement
  const dir = () => screen.getByLabelText('Effect direction') as HTMLSelectElement
  const described = (el: HTMLElement) =>
    document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? ''

  it('a definitional link: β and direction are read-only, and β states the definition', () => {
    seed('definitional')
    render(<EdgeAdvancedEditor edgeId="e1" linkKind="causal" onSendSettled={vi.fn()} />)
    expect(beta().disabled).toBe(true)
    expect(dir().disabled).toBe(true)
    expect(described(beta())).toBe(SENTENCE)
  })

  it('CONTROL: the Olumi estimate keeps both fields editable', () => {
    seed('estimate')
    render(<EdgeAdvancedEditor edgeId="e1" linkKind="causal" onSendSettled={vi.fn()} />)
    expect(beta().disabled).toBe(false)
    expect(dir().disabled).toBe(false)
    expect(described(beta())).not.toContain('by definition')
  })

  it("CONTROL: the person's own weight keeps both fields editable", () => {
    seed('user')
    render(<EdgeAdvancedEditor edgeId="e1" linkKind="causal" onSendSettled={vi.fn()} />)
    expect(beta().disabled).toBe(false)
    expect(dir().disabled).toBe(false)
  })
})
