/**
 * Core's option switch (`<option>__on`, label "<option> in place") is the engine's working, never the model (#2884). The
 * option's inspector showed it: "Changes Hire a Tech lead in place" with a "Very high (1)" box (served 82fc0fde, 21 Oct).
 * Shapes from that served hiring board (core mapper: the switch is a factor, the option's own effect a link from it).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen } from '@testing-library/react'

vi.mock('../../../hooks/useModelEditAuthority', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useModelEditAuthority: () => ({ proposeOptionIntervention: vi.fn() }),
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: vi.fn(async () => ({ userId: null, accessToken: null })), supabase: {} }))
vi.mock('@xyflow/react', async importOriginal => ({ ...(await importOriginal<Record<string, unknown>>()), useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const node = (id: string, type: string, data: Record<string, unknown>) => ({ id, type, position: { x: 0, y: 0 }, data: { kind: type, ...data } })
function seed(switchLabel: string) {
  useCanvasStore.setState({
    nodes: [
      node('tech_lead', 'option', { label: 'Hire a Tech lead', interventions: { tech_lead__on: { value: 1, raw_value: 1, source: 'cee_inference' } } }),
      node('tech_lead__on', 'factor', { label: switchLabel, category: 'controllable', observedState: { value: 0, raw_value: 0, cap: 1 } }),
      node('leadership', 'factor', { label: 'Leadership capacity', category: 'controllable' }),
    ] as never[],
    edges: [
      { id: 'e-switch', source: 'tech_lead', target: 'tech_lead__on', data: {} },
      { id: 'tech_lead_effect', source: 'tech_lead__on', target: 'leadership', data: {} },
    ] as never[],
    results: { status: 'idle', report: null }, ceeAnalysisReady: null, lastServerGraphHash: 'gh',
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }, goalThreshold: null, confirmedNodeIds: new Set(), _internal: {},
  } as never)
}
afterEach(() => cleanup())

describe('OptionPanel never shows core\'s option switch', () => {
  it('⭐ no "… in place" row or box; the option\'s own effect reads as a link to the factor it moves', () => {
    seed('Hire a Tech lead in place')
    render(<InspectorRouter nodeId="tech_lead" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByText(/in place/)).toBeNull()
    expect(screen.queryByTestId('inspector-intervention-tech_lead__on')).toBeNull()
    expect(screen.getAllByText('Leadership capacity').length).toBeGreaterThan(0)
  })

  it('CONTROL: a factor of the person\'s own with that id but not the mapper\'s label is the model, and is shown', () => {
    seed('Tech lead uptake')
    render(<InspectorRouter nodeId="tech_lead" edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-intervention-tech_lead__on')).toBeInTheDocument()
  })
})
