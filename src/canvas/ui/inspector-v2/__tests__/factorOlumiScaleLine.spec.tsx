/**
 * Each factor panel shows the Olumi-scale line under its value, only when CEE stamped
 * `observed_state.frame_source: 'olumi_convention'` (#2848). Bound to the surface the served build mounts: a factor
 * click on staging ffe7e962 mounts the inspector-v2 factor panel with `factor-value-row` visible (0-LLM probe,
 * 8 Oct 13:36Z). Contrast: the same panel without the stamp shows the value row and no line.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { FactorExternalPanel } from '../panels/FactorExternalPanel'
import { useCanvasStore } from '../../../store'

const noop = () => {}
const SENTENCE = 'Olumi reads ‘Pro plan price’ on a scale of £0 to £98 a month: a scale for reading sizes, not a forecast or a limit.'

function seed(category: string, stamped: boolean) {
  const observedState = { value: 49 / 98, raw_value: 49, cap: 98, unit: '£/month', ...(stamped ? { frame_source: 'olumi_convention' } : {}) }
  useCanvasStore.setState({
    nodes: [{ id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Pro plan price', category, observedState } } as unknown as Node],
    edges: [],
    results: { status: 'idle', report: null },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  } as never, false)
}

const PANELS = [
  ['controllable', FactorControllablePanel],
  ['observable', FactorObservablePanel],
  ['external', FactorExternalPanel],
] as const

beforeEach(() => cleanup())

describe.each(PANELS)('%s factor panel', (category, Panel) => {
  it('shows the approved line under the value when Olumi chose the scale', () => {
    seed(category, true)
    render(<Panel nodeId="f1" techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.getByTestId('factor-olumi-scale')).toHaveTextContent(SENTENCE)
  })

  it('contrast: without the stamp there is no line, and the value row still renders', () => {
    seed(category, false)
    render(<Panel nodeId="f1" techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.queryByTestId('factor-olumi-scale')).toBeNull()
    expect(screen.queryByText(/a scale for reading sizes/)).toBeNull()
  })
})
