/** Receipt→mounted Inspector guard. Source controls are recorded separately;
 * native Vitest/DOM execution must be supplied by the current validation owner.
 * The fixture is the sanitised actual Harness graph_patch.after/returned edge.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { EDGE_COPY } from '../inspectorStrings'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'
import { overlayEdge } from '../../../utils/mergeAppliedGraph'
import fixture from './fixtures/strength-receipt-20261004.json'

const edgeId = 'receipt-edge'
const panelProps = { edgeId, techMode: true, onClose: vi.fn(), onNavigate: vi.fn() }

function seed() {
  const before = { ...fixture.returned_edge, ...fixture.graph_patch.before }
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: before.from, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly operating spend' } },
      { id: before.to, type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Monthly recurring revenue' } },
    ],
    edges: [{ ...mapDraftEdgeToCanvas(before as never, 0), id: edgeId }],
    results: { status: 'none', report: null },
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
  } as never)
}

function accept(edge: Record<string, unknown>) {
  act(() => {
    const held = useCanvasStore.getState().edges[0]
    const applied = overlayEdge(held, edge, { acquireServerStrengthOnNoop: true })
    useCanvasStore.setState({ edges: [applied] } as never)
  })
}

function readout() {
  return screen.getByLabelText(EDGE_COPY.strengthSpreadReadoutLabel).textContent ?? ''
}

beforeEach(() => {
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  seed()
})

describe('Inspector binds every numeric channel to the current receipt edge', () => {
  it('updates the still-mounted spread from graph_patch.after and the same returned graph', () => {
    expect(fixture.returned_edge.strength).toEqual(fixture.graph_patch.after.strength)
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('strength-band-strong'))
    accept(fixture.returned_edge)
    expect(useCanvasStore.getState().edges[0].data?.strengthStd).toBe(0.275)
    expect(readout()).toContain('0.55')
    expect(readout()).toContain('0.28')
    expect(readout()).not.toContain('0.17')
  })

  it('rereads a spread-only update even when mean and provenance do not change', () => {
    accept(fixture.returned_edge)
    render(<EdgePanel {...panelProps} />)
    accept({ ...fixture.returned_edge, strength: { mean: 0.55, std: 0.01 } })
    expect(readout()).toContain('0.01')
    expect(readout()).not.toContain('0.28')
  })

  it('rereads strength, direction and spread together instead of retaining a clicked band', () => {
    render(<EdgePanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('strength-band-strong'))
    accept({ ...fixture.returned_edge, strength: { mean: -0.85, std: 0.02 }, effect_direction: 'negative' })
    expect(readout()).toContain('0.85')
    expect(readout()).toContain('0.02')
    expect(screen.getByTestId('strength-band-very-strong').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('strength-band-strong').getAttribute('aria-pressed')).toBe('false')
  })

  it('does not attach fresh provenance to an unstated mount-time default', () => {
    render(<EdgePanel {...panelProps} />)
    act(() => {
      const edge = useCanvasStore.getState().edges[0]
      const data = { ...edge.data, strengthStdSource: undefined }
      useCanvasStore.setState({ edges: [{ ...edge, data }] } as never)
    })
    expect(screen.queryByLabelText(EDGE_COPY.strengthSpreadReadoutLabel)).toBeNull()
    expect(screen.getByTestId('edge-std-unset').textContent).toContain('Not set')
  })

  it('a cold remount agrees with the mounted receipt reader', () => {
    const view = render(<EdgePanel {...panelProps} />)
    accept(fixture.returned_edge)
    const mounted = readout()
    view.unmount()
    render(<EdgePanel {...panelProps} />)
    expect(readout()).toBe(mounted)
  })

  it('the plain view keeps the scientific figures behind advanced detail', () => {
    accept(fixture.returned_edge)
    render(<EdgePanel {...panelProps} techMode={false} />)
    expect(screen.queryByLabelText(EDGE_COPY.strengthSpreadReadoutLabel)).toBeNull()
    expect(screen.getByTestId('strength-band-strong').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('edge-strength-spans-bands')).toBeTruthy()
  })
})
