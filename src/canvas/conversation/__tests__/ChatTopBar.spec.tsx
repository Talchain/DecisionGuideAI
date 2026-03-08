/**
 * Tests for ChatTopBar (Zone 1).
 *
 * Verifies:
 * - Run analysis chip visible only in ideate/evaluate stages
 * - Collapse, attach callbacks fire correctly
 * - Generate model chip renders in correct states
 * - Guide and Thinking mode dropdowns open/close
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatTopBar } from '../zones/ChatTopBar'

vi.mock('../../hooks/useStagePill', () => ({
  useStagePill: () => ({ stage: 'frame' }),
}))

function makeProps(overrides: Partial<Parameters<typeof ChatTopBar>[0]> = {}) {
  return {
    stage: 'frame' as const,
    isThinking: false,
    generateState: 'disabled' as const,
    onCollapse: vi.fn(),
    onAttach: vi.fn(),
    onRunAnalysis: vi.fn(),
    onGenerateModel: vi.fn(),
    onInsertText: vi.fn(),
    ...overrides,
  }
}

describe('ChatTopBar', () => {
  it('renders collapse and attach buttons', () => {
    render(<ChatTopBar {...makeProps()} />)
    expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument()
    expect(screen.getByLabelText('Attach evidence')).toBeInTheDocument()
  })

  it('fires onCollapse when collapse button clicked', () => {
    const onCollapse = vi.fn()
    render(<ChatTopBar {...makeProps({ onCollapse })} />)
    fireEvent.click(screen.getByLabelText('Collapse panel'))
    expect(onCollapse).toHaveBeenCalledOnce()
  })

  it('fires onAttach when attach button clicked', () => {
    const onAttach = vi.fn()
    render(<ChatTopBar {...makeProps({ onAttach })} />)
    fireEvent.click(screen.getByLabelText('Attach evidence'))
    expect(onAttach).toHaveBeenCalledOnce()
  })

  it('hides run analysis chip in framing stage', () => {
    render(<ChatTopBar {...makeProps({ stage: 'frame' })} />)
    expect(screen.queryByTestId('run-analysis-chip')).not.toBeInTheDocument()
  })

  it('shows run analysis chip in ideate stage', () => {
    render(<ChatTopBar {...makeProps({ stage: 'ideate' })} />)
    expect(screen.getByTestId('run-analysis-chip')).toBeInTheDocument()
  })

  it('shows run analysis chip in evaluate stage', () => {
    render(<ChatTopBar {...makeProps({ stage: 'evaluate' })} />)
    expect(screen.getByTestId('run-analysis-chip')).toBeInTheDocument()
  })

  it('hides run analysis chip in decide stage', () => {
    render(<ChatTopBar {...makeProps({ stage: 'decide' })} />)
    expect(screen.queryByTestId('run-analysis-chip')).not.toBeInTheDocument()
  })

  it('hides run analysis chip in optimise stage', () => {
    render(<ChatTopBar {...makeProps({ stage: 'optimise' })} />)
    expect(screen.queryByTestId('run-analysis-chip')).not.toBeInTheDocument()
  })

  it('renders generate model chip in disabled state', () => {
    render(<ChatTopBar {...makeProps({ generateState: 'disabled' })} />)
    expect(screen.getByTestId('generate-model-chip')).toBeInTheDocument()
    expect(screen.getByTestId('generate-model-chip')).toBeDisabled()
  })

  it('renders generate model chip in active state and fires callback', () => {
    const onGenerateModel = vi.fn()
    render(<ChatTopBar {...makeProps({ generateState: 'active', onGenerateModel })} />)
    const chip = screen.getByTestId('generate-model-chip')
    expect(chip).not.toBeDisabled()
    fireEvent.click(chip)
    expect(onGenerateModel).toHaveBeenCalledOnce()
  })

  it('renders generate model chip in loading state with spinner', () => {
    render(<ChatTopBar {...makeProps({ generateState: 'loading' })} />)
    expect(screen.getByText('Generating…')).toBeInTheDocument()
  })

  it('opens guide dropdown on click', () => {
    render(<ChatTopBar {...makeProps()} />)
    fireEvent.click(screen.getByTestId('guide-chip'))
    expect(screen.getByTestId('guide-dropdown')).toBeInTheDocument()
  })

  it('opens thinking mode dropdown on click', () => {
    render(<ChatTopBar {...makeProps()} />)
    fireEvent.click(screen.getByTestId('thinking-mode-chip'))
    expect(screen.getByTestId('thinking-mode-dropdown')).toBeInTheDocument()
  })

  it('generate model chip disabled does not fire callback', () => {
    const onGenerateModel = vi.fn()
    render(<ChatTopBar {...makeProps({ generateState: 'disabled', onGenerateModel })} />)
    fireEvent.click(screen.getByTestId('generate-model-chip'))
    expect(onGenerateModel).not.toHaveBeenCalled()
  })

  it('generate model chip loading is disabled', () => {
    render(<ChatTopBar {...makeProps({ generateState: 'loading' })} />)
    expect(screen.getByTestId('generate-model-chip')).toBeDisabled()
  })
})
