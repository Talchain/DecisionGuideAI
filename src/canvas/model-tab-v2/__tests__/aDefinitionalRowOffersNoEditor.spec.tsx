/**
 * MG ruling (1 Oct 2026) — THE MODEL TAB OFFERS NO STRENGTH EDITOR ON A LINK
 * THAT HOLDS BY DEFINITION; THE CELL SAYS "by definition" INSTEAD.
 *
 * The relationship row's value cell is a `<button>` ("Change this value") for
 * every edge in `editConnectedIds`, which the host builds from
 * `edgeStrengthEditIsAssertable`. A definitional link passed that gate, so the
 * row opened an editor whose write CEE refuses. Mounted through the real host,
 * not the row alone, so the row's `editConnected` comes from the real gate.
 * Controls on the same fixture: the wire without `definitional`, and the
 * definitional link whose weight the person set (`weightSource: 'user'`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }) }
})

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'

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

const EDGE = 'e1'
const NODES = [
  { id: 'part', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Sprint capacity on AI reporting', kind: 'factor' } },
  { id: 'total', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Total sprint capacity allocated', kind: 'factor' } },
]

function renderPanel(variant: 'definitional' | 'estimate' | 'user') {
  const mapped = mapDraftEdgeToCanvas({ ...(variant === 'estimate' ? ESTIMATE : DEFINITIONAL) }, 0)
  const data = variant === 'user'
    ? { ...(mapped.data as Record<string, unknown>), weightSource: 'user' }
    : mapped.data
  const edges = [{ ...mapped, id: EDGE, source: 'part', target: 'total', data }]
  useCanvasStore.setState({ nodes: NODES, edges, lastServerGraphHash: 'abc123' } as never, false)
  render(<ModelTabV2Panel nodes={NODES as never} edges={edges as never} goalThreshold={null} />)
  fireEvent.click(screen.getByTestId('model-group-v2-relationships-toggle'))
  return screen.getByTestId(`model-row-v2-${EDGE}-value`)
}

afterEach(() => cleanup())

describe('the Model tab relationship row', () => {
  it('a definitional link: the value cell is text, not the "Change this value" button', () => {
    const cell = renderPanel('definitional')
    expect(cell.tagName).toBe('SPAN')
    expect(within(cell).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Change / })).toBeNull()
  })

  it('…and the cell where the editor was says "by definition"', () => {
    const cell = renderPanel('definitional')
    expect(cell.textContent).toContain('· by definition')
  })

  it('CONTROL: the same wire as an Olumi estimate keeps the editor button', () => {
    const cell = renderPanel('estimate')
    expect(cell.tagName).toBe('BUTTON')
    expect(cell.getAttribute('title')).toBe('Change this value')
  })

  it("CONTROL: a definitional link whose weight the person set keeps the editor button", () => {
    const cell = renderPanel('user')
    expect(cell.tagName).toBe('BUTTON')
    expect(cell.getAttribute('title')).toBe('Change this value')
  })
})
