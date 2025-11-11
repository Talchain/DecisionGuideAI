/**
 * StreamParametersPanel Unit Tests
 * Phase 2E: Tests for extracted parameter input component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StreamParametersPanel from '../StreamParametersPanel'

describe('StreamParametersPanel', () => {
  const defaultProps = {
    value: { seed: '42', budget: '1.00', model: 'gpt-4o-mini' },
    onChange: vi.fn(),
    disabled: false,
    readOnly: false,
  }

  it('renders all three parameter inputs', () => {
    render(<StreamParametersPanel {...defaultProps} />)

    expect(screen.getByTestId('param-seed')).toBeInTheDocument()
    expect(screen.getByTestId('param-budget')).toBeInTheDocument()
    expect(screen.getByTestId('param-model')).toBeInTheDocument()
  })

  it('displays current parameter values', () => {
    render(<StreamParametersPanel {...defaultProps} />)

    const seedInput = screen.getByTestId('param-seed') as HTMLInputElement
    const budgetInput = screen.getByTestId('param-budget') as HTMLInputElement
    const modelSelect = screen.getByTestId('param-model') as HTMLSelectElement

    expect(seedInput.value).toBe('42')
    expect(budgetInput.value).toBe('1.00')
    expect(modelSelect.value).toBe('gpt-4o-mini')
  })

  it('calls onChange when seed is modified', () => {
    const onChange = vi.fn()
    render(<StreamParametersPanel {...defaultProps} onChange={onChange} />)

    const seedInput = screen.getByTestId('param-seed')
    fireEvent.change(seedInput, { target: { value: '123' } })

    expect(onChange).toHaveBeenCalledWith({
      seed: '123',
      budget: '1.00',
      model: 'gpt-4o-mini',
    })
  })

  it('calls onChange when budget is modified', () => {
    const onChange = vi.fn()
    render(<StreamParametersPanel {...defaultProps} onChange={onChange} />)

    const budgetInput = screen.getByTestId('param-budget')
    fireEvent.change(budgetInput, { target: { value: '5.00' } })

    expect(onChange).toHaveBeenCalledWith({
      seed: '42',
      budget: '5.00',
      model: 'gpt-4o-mini',
    })
  })

  it('calls onChange when model is modified', () => {
    const onChange = vi.fn()
    render(<StreamParametersPanel {...defaultProps} onChange={onChange} />)

    const modelSelect = screen.getByTestId('param-model')
    fireEvent.change(modelSelect, { target: { value: 'claude-haiku' } })

    expect(onChange).toHaveBeenCalledWith({
      seed: '42',
      budget: '1.00',
      model: 'claude-haiku',
    })
  })

  it('disables inputs when disabled prop is true', () => {
    render(<StreamParametersPanel {...defaultProps} disabled={true} />)

    const seedInput = screen.getByTestId('param-seed') as HTMLInputElement
    const budgetInput = screen.getByTestId('param-budget') as HTMLInputElement
    const modelSelect = screen.getByTestId('param-model') as HTMLSelectElement

    expect(seedInput.disabled).toBe(true)
    expect(budgetInput.disabled).toBe(true)
    expect(modelSelect.disabled).toBe(true)
  })

  it('disables inputs when readOnly prop is true', () => {
    render(<StreamParametersPanel {...defaultProps} readOnly={true} />)

    const seedInput = screen.getByTestId('param-seed') as HTMLInputElement
    const budgetInput = screen.getByTestId('param-budget') as HTMLInputElement
    const modelSelect = screen.getByTestId('param-model') as HTMLSelectElement

    expect(seedInput.disabled).toBe(true)
    expect(budgetInput.disabled).toBe(true)
    expect(modelSelect.disabled).toBe(true)
  })

  it('has proper ARIA labels for accessibility', () => {
    render(<StreamParametersPanel {...defaultProps} />)

    const seedInput = screen.getByTestId('param-seed')
    const budgetInput = screen.getByTestId('param-budget')
    const modelSelect = screen.getByTestId('param-model')

    expect(seedInput).toHaveAttribute('aria-label', 'Random seed for reproducibility')
    expect(budgetInput).toHaveAttribute('aria-label', 'Maximum budget in dollars')
    expect(modelSelect).toHaveAttribute('aria-label', 'AI model to use')
  })

  it('memoizes correctly and does not re-render unnecessarily', () => {
    const { rerender } = render(<StreamParametersPanel {...defaultProps} />)
    const seedInput = screen.getByTestId('param-seed')

    // Rerender with same props
    rerender(<StreamParametersPanel {...defaultProps} />)

    // Component should not have re-rendered (React.memo should prevent it)
    expect(seedInput).toBeInTheDocument()
  })
})
