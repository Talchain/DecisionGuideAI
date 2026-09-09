import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RiskPanel } from '../panels/RiskPanel'
import type { InspectorPanelProps } from '../types'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const panelProps: InspectorPanelProps = {
  nodeId: 'risk-1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

function setRiskData(data: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    nodes: [
      { id: 'risk-1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk', label: 'Handover risk', ...data } },
      { id: 'risk-2', type: 'risk', position: { x: 0, y: 100 }, data: { type: 'risk', label: 'Separate risk', probability: 0.8, impact: 'low' } },
      { id: 'factor-1', type: 'factor', position: { x: 100, y: 0 }, data: { type: 'factor', label: 'Availability of experienced account managers' } },
    ],
    edges: [{ id: 'factor-risk', source: 'factor-1', target: 'risk-1', data: { weight: 0.6, weightSource: 'user' } }],
    results: { status: 'none', report: null },
    analysisFreshnessDirty: false,
  } as any)
}

function riskData(id = 'risk-1') {
  return useCanvasStore.getState().nodes.find(node => node.id === id)!.data
}

beforeEach(() => {
  vi.clearAllMocks()
  setRiskData()
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null, _dispatchAction: null })
})

describe('RiskPanel authored context and entered estimates', () => {
  it('retains full description and distinct body without writing either field', () => {
    const description = 'A departure could interrupt account handovers. '.repeat(8)
    const body = 'Record unresolved disagreements.\nPreserve the long reference: ' + 'a'.repeat(180)
    setRiskData({ description, body })
    render(<RiskPanel {...panelProps} />)

    const context = screen.getByTestId('risk-authored-context')
    expect(context.textContent).toBe(`${description}\n\n${body}`)
    expect(context).toHaveClass('whitespace-pre-wrap', 'break-words')
    expect(riskData().description).toBe(description)
    expect(riskData().body).toBe(body)
    expect(screen.queryByText('Entered estimate')).toBeNull()
  })

  it.each([undefined, '   '])('shows authored body when description is %s', (description) => {
    const body = '  Record the team’s handover concern.\nKeep the source wording.  '
    setRiskData({ description, body })
    render(<RiskPanel {...panelProps} />)
    expect(screen.getByTestId('risk-authored-context').textContent).toBe(body)
    expect(screen.queryByText('What could go wrong and how would it affect the decision?')).toBeNull()
  })

  it('does not duplicate matching body text or display malformed context', () => {
    setRiskData({ description: 'Review the handover.', body: ' Review the handover. ' })
    const { unmount } = render(<RiskPanel {...panelProps} />)
    expect(screen.getByTestId('risk-authored-context').textContent).toBe('Review the handover.')
    unmount()

    setRiskData({ description: { text: 'Malformed' }, body: 42 })
    render(<RiskPanel {...panelProps} />)
    expect(screen.queryByTestId('risk-authored-context')).toBeNull()
    expect(screen.getByText('What could go wrong and how would it affect the decision?')).toBeDefined()
  })

  it('labels the existing likelihood, impact and derived severity as an entered estimate', () => {
    setRiskData({ probability: 0.9, impact: 'high' })
    render(<RiskPanel {...panelProps} />)
    const card = screen.getByTestId('primary-control-card')
    expect(card).toHaveTextContent('Entered estimate')
    expect(screen.getByTestId('risk-probability-display')).toHaveTextContent('90%')
    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('risk-severity-badge')).toHaveTextContent('High')
  })

  it.each([undefined, NaN, Infinity, -0.2, 1.2, '0.6'])('keeps invalid or absent likelihood %s unset without rewriting it', (probability) => {
    setRiskData({ probability, impact: 'high' })
    render(<RiskPanel {...panelProps} />)
    expect(screen.getByTestId('risk-probability-display')).toHaveTextContent(/not set/i)
    expect(screen.getByRole('radio', { name: 'High' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByTestId('risk-severity-badge')).toBeNull()
    expect(riskData().probability).toBe(probability)
  })

  it('preserves entered zero and renders an unknown impact as unset', () => {
    setRiskData({ probability: 0, impact: 'extreme' })
    render(<RiskPanel {...panelProps} />)
    expect(screen.getByTestId('risk-probability-display')).toHaveTextContent('0%')
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false')
    }
    expect(screen.getByText('Not set.')).toBeDefined()
    expect(screen.queryByTestId('risk-severity-badge')).toBeNull()
  })

  it('opens and blurs the exact entered percentage without rounding or staling the model', () => {
    setRiskData({ probability: 0.376, impact: 'medium' })
    render(<RiskPanel {...panelProps} />)
    expect(screen.getByTestId('risk-probability-display')).toHaveTextContent('38%')
    fireEvent.click(screen.getByTestId('risk-probability-display'))
    const input = screen.getByTestId('risk-probability-input') as HTMLInputElement
    expect(input.value).toBe('37.6')
    fireEvent.blur(input)
    expect(riskData().probability).toBe(0.376)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

  it('uses the existing mutations for the selected risk and preserves the other risk', () => {
    setRiskData({ probability: 0.376, impact: 'medium', body: 'Preserve this context.' })
    render(<RiskPanel {...panelProps} />)
    fireEvent.click(screen.getByTestId('risk-probability-display'))
    const input = screen.getByTestId('risk-probability-input')
    fireEvent.change(input, { target: { value: '12.5' } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByRole('radio', { name: 'High' }))
    expect(riskData().probability).toBe(0.125)
    expect(riskData().impact).toBe('high')
    expect(riskData().body).toBe('Preserve this context.')
    expect(riskData('risk-2').probability).toBe(0.8)
    expect(riskData('risk-2').impact).toBe('low')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('respects the existing surrounding disabled fieldset', async () => {
    setRiskData({ probability: 0.376, impact: 'medium' })
    render(<fieldset disabled><RiskPanel {...panelProps} /></fieldset>)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('risk-probability-display'))
    await user.click(screen.getByRole('radio', { name: 'High' }))
    expect(screen.queryByTestId('risk-probability-input')).toBeNull()
    expect(riskData().probability).toBe(0.376)
    expect(riskData().impact).toBe('medium')
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

  it('retains the complete connected-factor label and navigation', async () => {
    render(<RiskPanel {...panelProps} />)
    await userEvent.click(screen.getByText('Availability of experienced account managers'))
    expect(panelProps.onNavigate).toHaveBeenCalledWith('factor-1')
  })
})
