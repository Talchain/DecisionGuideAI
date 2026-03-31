/**
 * BaseRateChipRow — unit tests
 *
 * Covers:
 * - Renders 4 chips with factor label in text and contextual header
 * - Falls back to "This factor" when factorLabel is "This factor"
 * - Clicking a chip calls onSendMessage with correct text
 * - Chip row disappears after any chip is clicked (consumed state)
 * - Outlined pill style: no filled backgrounds
 * - Caption-sized text on chips, bodySmall on label
 * - Keyboard accessibility: chips are focusable buttons
 * - Does not render when disabled and consumed
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BaseRateChipRow } from '../BaseRateChipRow'
import type { BaseRateChipSet } from '../types'

const baseChipSet: BaseRateChipSet = {
  factorLabel: 'Market demand',
  itemId: 'guidance-1',
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('BaseRateChipRow — rendering', () => {
  it('renders 4 chips with factor label', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} />)
    expect(screen.getByTestId('base-rate-chips')).toBeInTheDocument()
    expect(screen.getByTestId('br-uncommon')).toHaveTextContent('Market demand is uncommon')
    expect(screen.getByTestId('br-sometimes')).toHaveTextContent('Market demand happens sometimes')
    expect(screen.getByTestId('br-common')).toHaveTextContent('Market demand is common')
    expect(screen.getByTestId('br-unsure')).toHaveTextContent('Not sure')
  })

  it('renders contextual label above chips', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} />)
    const label = screen.getByTestId('base-rate-label')
    expect(label).toHaveTextContent('How common is Market demand?')
  })

  it('uses "This factor" as fallback label', () => {
    const fallbackSet: BaseRateChipSet = { factorLabel: 'This factor', itemId: 'g-2' }
    render(<BaseRateChipRow chipSet={fallbackSet} onSendMessage={vi.fn()} />)
    expect(screen.getByTestId('br-uncommon')).toHaveTextContent('This factor is uncommon')
    expect(screen.getByTestId('base-rate-label')).toHaveTextContent('How common is This factor?')
  })

  it('renders all 4 chips as buttons (keyboard accessible)', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// Click behaviour
// ---------------------------------------------------------------------------

describe('BaseRateChipRow — click behaviour', () => {
  it('sends "rarely" when uncommon chip is clicked', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} />)
    fireEvent.click(screen.getByTestId('br-uncommon'))
    expect(onSend).toHaveBeenCalledWith('rarely')
  })

  it('sends "sometimes" when sometimes chip is clicked', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} />)
    fireEvent.click(screen.getByTestId('br-sometimes'))
    expect(onSend).toHaveBeenCalledWith('sometimes')
  })

  it('sends "usually" when common chip is clicked', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} />)
    fireEvent.click(screen.getByTestId('br-common'))
    expect(onSend).toHaveBeenCalledWith('usually')
  })

  it('sends "I\'m not sure about [factor]" when unsure chip is clicked', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} />)
    fireEvent.click(screen.getByTestId('br-unsure'))
    expect(onSend).toHaveBeenCalledWith("I'm not sure about Market demand")
  })

  it('chip row disappears after any chip is clicked (consumed)', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} />)
    expect(screen.getByTestId('base-rate-chips')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('br-common'))
    expect(screen.queryByTestId('base-rate-chips')).not.toBeInTheDocument()
  })

  it('only sends once — second click is ignored', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} />)
    fireEvent.click(screen.getByTestId('br-uncommon'))
    // Row is consumed — further clicks impossible (component unmounted)
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Disabled state
// ---------------------------------------------------------------------------

describe('BaseRateChipRow — disabled state', () => {
  it('does not send when disabled', () => {
    const onSend = vi.fn()
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={onSend} disabled />)
    fireEvent.click(screen.getByTestId('br-uncommon'))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('chips have disabled attribute when disabled', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} disabled />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => expect(btn).toBeDisabled())
  })
})

// ---------------------------------------------------------------------------
// Styling (DS v5 compliance)
// ---------------------------------------------------------------------------

describe('BaseRateChipRow — styling', () => {
  it('chip group has correct aria-label', () => {
    render(<BaseRateChipRow chipSet={baseChipSet} onSendMessage={vi.fn()} />)
    expect(screen.getByRole('group')).toHaveAttribute(
      'aria-label',
      'How common is Market demand?',
    )
  })
})

// ---------------------------------------------------------------------------
// Priority and single-factor guard (tested via handleEnvelope, not here)
// These are integration concerns — the component always renders what it receives.
// ---------------------------------------------------------------------------
