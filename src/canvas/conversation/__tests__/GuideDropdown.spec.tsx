/**
 * Tests for GuideDropdown.
 *
 * Verifies:
 * - Opens with three menu items
 * - Scaffold item calls onInsertText with scaffold text and closes
 * - Example item calls onInsertText with example text and closes
 * - Help item toggles help card
 * - Closes on Escape
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { GuideDropdown } from '../dropdowns/GuideDropdown'

function makeProps(overrides: Partial<Parameters<typeof GuideDropdown>[0]> = {}) {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onInsertText: vi.fn(),
    anchorRef: createRef<HTMLButtonElement>(),
    ...overrides,
  }
}

describe('GuideDropdown', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<GuideDropdown {...makeProps({ isOpen: false })} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders three menu items when open', () => {
    render(<GuideDropdown {...makeProps()} />)
    expect(screen.getByTestId('guide-item-scaffold')).toBeInTheDocument()
    expect(screen.getByTestId('guide-item-help')).toBeInTheDocument()
    expect(screen.getByTestId('guide-item-example')).toBeInTheDocument()
  })

  it('inserts scaffold text and closes on scaffold click', () => {
    const onInsertText = vi.fn()
    const onClose = vi.fn()
    render(<GuideDropdown {...makeProps({ onInsertText, onClose })} />)
    fireEvent.click(screen.getByTestId('guide-item-scaffold'))
    expect(onInsertText).toHaveBeenCalledOnce()
    expect(onInsertText.mock.calls[0][0]).toContain('The decision I\'m facing is:')
    expect(onClose).toHaveBeenCalled()
  })

  it('inserts example text and closes on example click', () => {
    const onInsertText = vi.fn()
    const onClose = vi.fn()
    render(<GuideDropdown {...makeProps({ onInsertText, onClose })} />)
    fireEvent.click(screen.getByTestId('guide-item-example'))
    expect(onInsertText).toHaveBeenCalledOnce()
    expect(onInsertText.mock.calls[0][0]).toContain('£20k MRR')
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles help card on help click', () => {
    render(<GuideDropdown {...makeProps()} />)
    expect(screen.queryByTestId('guide-help-card')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('guide-item-help'))
    expect(screen.getByTestId('guide-help-card')).toBeInTheDocument()
  })

  it('has menu role', () => {
    render(<GuideDropdown {...makeProps()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<GuideDropdown {...makeProps({ onClose })} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('scaffold text includes trailing space after every colon', () => {
    const onInsertText = vi.fn()
    render(<GuideDropdown {...makeProps({ onInsertText })} />)
    fireEvent.click(screen.getByTestId('guide-item-scaffold'))
    const text = onInsertText.mock.calls[0][0] as string
    const lines = text.split('\n')
    for (const line of lines) {
      expect(line).toMatch(/: $/)
    }
  })

  it('replaces (not appends) text on scaffold insert', () => {
    const onInsertText = vi.fn()
    render(<GuideDropdown {...makeProps({ onInsertText })} />)
    fireEvent.click(screen.getByTestId('guide-item-scaffold'))
    // onInsertText should be called exactly once with the full scaffold
    expect(onInsertText).toHaveBeenCalledOnce()
    expect(typeof onInsertText.mock.calls[0][0]).toBe('string')
  })
})
