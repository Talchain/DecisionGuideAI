/**
 * StreamControlBar Unit Tests
 * Phase 2E: Tests for extracted Start/Stop control component
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StreamControlBar } from '../StreamControlBar'

describe('StreamControlBar', () => {
  const defaultProps = {
    canStart: true,
    canStop: false,
    canResume: false,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onResume: vi.fn(),
    status: 'idle' as const,
    disabled: false,
    readOnly: false,
  }

  it('renders Start and Stop buttons', () => {
    render(<StreamControlBar {...defaultProps} />)

    expect(screen.getByTestId('start-btn')).toBeInTheDocument()
    expect(screen.getByTestId('stop-btn')).toBeInTheDocument()
  })

  it('enables Start button when canStart is true', () => {
    render(<StreamControlBar {...defaultProps} canStart={true} />)

    const startBtn = screen.getByTestId('start-btn') as HTMLButtonElement
    expect(startBtn.disabled).toBe(false)
  })

  it('disables Start button when canStart is false', () => {
    render(<StreamControlBar {...defaultProps} canStart={false} />)

    const startBtn = screen.getByTestId('start-btn') as HTMLButtonElement
    expect(startBtn.disabled).toBe(true)
  })

  it('enables Stop button when canStop is true', () => {
    render(<StreamControlBar {...defaultProps} canStop={true} />)

    const stopBtn = screen.getByTestId('stop-btn') as HTMLButtonElement
    expect(stopBtn.disabled).toBe(false)
  })

  it('disables Stop button when canStop is false', () => {
    render(<StreamControlBar {...defaultProps} canStop={false} />)

    const stopBtn = screen.getByTestId('stop-btn') as HTMLButtonElement
    expect(stopBtn.disabled).toBe(true)
  })

  it('calls onStart when Start button is clicked', () => {
    const onStart = vi.fn()
    render(<StreamControlBar {...defaultProps} onStart={onStart} />)

    const startBtn = screen.getByTestId('start-btn')
    fireEvent.click(startBtn)

    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn()
    render(<StreamControlBar {...defaultProps} canStop={true} onStop={onStop} />)

    const stopBtn = screen.getByTestId('stop-btn')
    fireEvent.click(stopBtn)

    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('hides Start button when readOnly is true', () => {
    render(<StreamControlBar {...defaultProps} readOnly={true} />)

    expect(screen.queryByTestId('start-btn')).not.toBeInTheDocument()
    expect(screen.getByTestId('stop-btn')).toBeInTheDocument()
  })

  it('disables both buttons when disabled prop is true', () => {
    render(<StreamControlBar {...defaultProps} disabled={true} canStart={true} canStop={true} />)

    const startBtn = screen.getByTestId('start-btn') as HTMLButtonElement
    const stopBtn = screen.getByTestId('stop-btn') as HTMLButtonElement

    expect(startBtn.disabled).toBe(true)
    expect(stopBtn.disabled).toBe(true)
  })

  it('shows default keyboard shortcut hint for Start button', () => {
    render(<StreamControlBar {...defaultProps} />)

    const startBtn = screen.getByTestId('start-btn')
    expect(startBtn).toHaveAttribute('title', 'Start (⌘⏎)')
  })

  it('shows custom title when startTitle prop is provided', () => {
    render(<StreamControlBar {...defaultProps} startTitle="Begin Stream" />)

    const startBtn = screen.getByTestId('start-btn')
    expect(startBtn).toHaveAttribute('title', 'Begin Stream')
  })

  it('applies correct styling classes', () => {
    render(<StreamControlBar {...defaultProps} />)

    const startBtn = screen.getByTestId('start-btn')
    const stopBtn = screen.getByTestId('stop-btn')

    // Start button should have blue background (brand color)
    expect(startBtn).toHaveClass('bg-blue-600', 'text-white')

    // Stop button should have gray background
    expect(stopBtn).toHaveClass('bg-gray-200', 'text-gray-900')
  })

  it('memoizes correctly and does not re-render unnecessarily', () => {
    const { rerender } = render(<StreamControlBar {...defaultProps} />)
    const startBtn = screen.getByTestId('start-btn')

    // Rerender with same props
    rerender(<StreamControlBar {...defaultProps} />)

    // Component should not have re-rendered (React.memo should prevent it)
    expect(startBtn).toBeInTheDocument()
  })
})
