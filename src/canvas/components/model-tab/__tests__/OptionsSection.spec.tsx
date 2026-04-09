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

  it('shows coaching card when all options lack interventions', () => {
    const options = [makeOptionNode('opt1', 'Option A')]
    render(<OptionsSection optionNodes={options} allNodes={[]} />)
    expect(screen.getByTestId('options-unmapped-coaching')).toBeInTheDocument()
    expect(screen.getByText(/None of these options have mapped interventions/)).toBeInTheDocument()
  })

  it('shows intervention rows with factor labels and values', () => {
    const factor = makeFactorNode('f1', 'Market size', 500000, '£')
    const option = makeOptionNode('opt1', 'Scale up', { f1: 600000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('Market size')).toBeInTheDocument()
    expect(screen.getByText('£500,000')).toBeInTheDocument()
  })

  it('shows delta chip for positive change', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option = makeOptionNode('opt1', 'Expand', { f1: 120000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText(/\+£20,000/)).toBeInTheDocument()
  })

  it('collapses to "No changes to any factors" when all interventions match baseline (status quo)', () => {
    const factor1 = makeFactorNode('f1', 'Revenue', 100000, '£')
    const factor2 = makeFactorNode('f2', 'Headcount', 10, 'FTE')
    const option = makeOptionNode('opt1', 'Hold', { f1: 100000, f2: 10 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor1, factor2]} />)
    // Status quo collapse: single line replaces verbose intervention rows
    expect(screen.getByTestId('option-status-quo-opt1')).toHaveTextContent('No changes to any factors')
    expect(screen.queryByTestId('option-interventions-opt1')).not.toBeInTheDocument()
  })

  it('shows individual "unchanged" labels in a mixed-change scenario', () => {
    const factor1 = makeFactorNode('f1', 'Revenue', 100000, '£')
    const factor2 = makeFactorNode('f2', 'Headcount', 10, 'FTE')
    // Revenue is unchanged but Headcount grows — not status quo, so individual rows still render.
    const option = makeOptionNode('opt1', 'Hire', { f1: 100000, f2: 15 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor1, factor2]} />)
    expect(screen.queryByTestId('option-status-quo-opt1')).not.toBeInTheDocument()
    expect(screen.getByText('unchanged')).toBeInTheDocument()
  })

  it('hides "Run analysis to see when each option leads and lags" copy when hasAnalysisData=true', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option = makeOptionNode('opt1', 'Grow', { f1: 120000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} hasAnalysisData={true} />)
    expect(screen.queryByText(/Run analysis to see when each option leads and lags/)).not.toBeInTheDocument()
  })

  it('shows "Run analysis to see when each option leads and lags" copy when hasAnalysisData=false', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option = makeOptionNode('opt1', 'Grow', { f1: 120000 })
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} hasAnalysisData={false} />)
    expect(screen.getByText(/Run analysis to see when each option leads and lags/)).toBeInTheDocument()
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

  // ── Object-shaped intervention values ────────────────────────────────────────

  it('renders without crash when intervention value is an object with raw_target', () => {
    const factor = makeFactorNode('f1', 'Headcount', 10, 'FTE')
    const option: Node = {
      id: 'opt1', type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Hire', interventions: { f1: { raw_target: 15, target_value: 0.6 } } },
    }
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('Headcount')).toBeInTheDocument()
    expect(screen.getByText('15 FTE')).toBeInTheDocument()
  })

  it('falls back to target_value when raw_target absent', () => {
    const factor = makeFactorNode('f1', 'Score', undefined, undefined)
    const option: Node = {
      id: 'opt1', type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Improve', interventions: { f1: { target_value: 0.7 } } },
    }
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('Score')).toBeInTheDocument()
  })

  it('skips completely un-parseable intervention values', () => {
    const factor = makeFactorNode('f1', 'Budget', 100, '£')
    const option: Node = {
      id: 'opt1', type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Bad data', interventions: { f1: { foo: 'bar' } } },
    }
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    // No intervention rows rendered since value is unparseable
    expect(screen.queryByText('Budget')).not.toBeInTheDocument()
  })

  it('handles string-valued interventions that parse to numbers', () => {
    const factor = makeFactorNode('f1', 'Revenue', 100000, '£')
    const option: Node = {
      id: 'opt1', type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Grow', interventions: { f1: '150000' } },
    }
    render(<OptionsSection optionNodes={[option]} allNodes={[factor]} />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('£150,000')).toBeInTheDocument()
  })
})
