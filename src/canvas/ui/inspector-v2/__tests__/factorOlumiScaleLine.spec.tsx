/**
 * Each factor panel shows, under its value, a short plain line when CEE stamped
 * `observed_state.frame_source: 'olumi_convention'` (#2848), and Science's full sentence one press away behind
 * "Why?" (Paul 8 Oct, progressive disclosure). Bound to the surface the served build mounts: a factor click on staging
 * ffe7e962 mounts the inspector-v2 factor panel with `factor-value-row` visible (0-LLM probe, 8 Oct 13:36Z).
 * Contrast: the same panel without the stamp shows no line and no Why? control.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { FactorExternalPanel } from '../panels/FactorExternalPanel'
import { useCanvasStore } from '../../../store'

const noop = () => {}
const SHORT = "Sizing scale (Olumi's): £0–£98 a month"
const WHY = 'Olumi reads ‘Pro plan price’ on a scale of £0 to £98 a month: a scale for reading sizes, not a forecast or a limit.'

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
  it('shows the short line verbatim; the full sentence appears only after Why?', () => {
    seed(category, true)
    render(<Panel nodeId="f1" techMode={false} onClose={noop} onNavigate={noop} />)
    const block = screen.getByTestId('factor-olumi-scale')
    expect(within(block).getByTestId('factor-olumi-scale-short')).toHaveTextContent(SHORT)
    expect(within(block).queryByTestId('factor-olumi-scale-why')).toBeNull()
    expect(screen.queryByText(/a scale for reading sizes/)).toBeNull()
    const why = within(block).getByRole('button', { name: 'Why?' })
    expect(why).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(why)
    expect(within(block).getByTestId('factor-olumi-scale-why')).toHaveTextContent(WHY)
    expect(within(block).getByRole('button', { name: 'Hide why' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('Why? opens from the keyboard', () => {
    seed(category, true)
    render(<Panel nodeId="f1" techMode={false} onClose={noop} onNavigate={noop} />)
    fireEvent.keyDown(within(screen.getByTestId('factor-olumi-scale')).getByRole('button', { name: 'Why?' }), { key: 'Enter' })
    expect(screen.getByTestId('factor-olumi-scale-why')).toHaveTextContent(WHY)
  })

  it('contrast: without the stamp there is no line and no Why? control', () => {
    seed(category, false)
    render(<Panel nodeId="f1" techMode={false} onClose={noop} onNavigate={noop} />)
    expect(screen.queryByTestId('factor-olumi-scale')).toBeNull()
    expect(screen.queryByText(/Sizing scale/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull()
  })
})
