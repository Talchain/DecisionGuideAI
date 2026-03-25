/**
 * OptionsSection — unit tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionsSection } from '../OptionsSection'
import type { Node } from '@xyflow/react'

const mockUpdateNode = vi.fn()

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ updateNode: mockUpdateNode })
  ),
}))

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function makeOptionNode(id: string, label: string, interventions?: Record<string, number>): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, interventions },
  }
}

function makeFactorNode(id: string, label: string, rawValue?: number, unit?: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      observedState: { raw_value: rawValue, unit, value: rawValue ? rawValue / 100 : undefined },
    },
  }
}

describe('OptionsSection', () => {
  it('renders nothing when no option nodes', () => {
    const { container } = render(<OptionsSection optionNodes={[]} allNodes={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders option card with label', () => {
    const options = [makeOptionNode('opt1', 'Option Alpha')]
    render(<OptionsSection optionNodes={options} allNodes={[]} />)
    expect(screen.getByText('Option Alpha')).toBeInTheDocument()
  })

  it('shows coaching message when option has no interventions', () => {
    const options = [makeOptionNode('opt1', 'Option A')]
    render(<OptionsSection optionNodes={options} allNodes={[]} />)
    expect(screen.getByText(/AI hasn't mapped how this option changes/)).toBeInTheDocument()
  })

  it('shows intervention rows with factor labels and values', () => {
    const factor = makeFactorNode('f1', 'Market size', 500000, '£')
    const option = makeOptionNode('opt1', 'Scale up', { f1: 600000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('Market size')).toBeInTheDocument()
    expect(screen.getByText('£500000')).toBeInTheDocument()
  })

  it('shows delta chip for positive change', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option = makeOptionNode('opt1', 'Expand', { f1: 120000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText(/\+£20000/)).toBeInTheDocument()
  })

  it('shows "unchanged" when intervention matches baseline', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option = makeOptionNode('opt1', 'Hold', { f1: 100000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('unchanged')).toBeInTheDocument()
  })

  it('calls updateNode when intervention value is edited', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000)
    const option = makeOptionNode('opt1', 'Option', { f1: 50000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)

    const displayEl = screen.getByTestId('intervention-opt1-f1-display')
    fireEvent.click(displayEl)

    const input = screen.getByTestId('intervention-opt1-f1')
    fireEvent.change(input, { target: { value: '75000' } })
    fireEvent.blur(input)

    expect(mockUpdateNode).toHaveBeenCalledWith(
      'opt1',
      expect.objectContaining({
        data: expect.objectContaining({
          interventions: expect.objectContaining({ f1: 75000 }),
        }),
      })
    )
  })

  it('shows count badge matching option count', () => {
    const options = [
      makeOptionNode('opt1', 'Option A'),
      makeOptionNode('opt2', 'Option B'),
    ]
    render(<OptionsSection optionNodes={options} allNodes={[]} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
