/**
 * Tests for the IconBtn primitive's tooltip. (Its BiasIcon rows went with BiasIcon, U2.)
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IconBtn } from '../primitives/IconBtn'
import { Check } from 'lucide-react'

describe('IconBtn tooltip', () => {
  it('shows tooltip on enabled button', () => {
    render(<IconBtn icon={Check} tooltip="Confirm action" variant="confirm" />)

    // Button should have the tooltip content in aria-label
    const button = screen.getByLabelText(/Confirm action/)
    expect(button).toBeInTheDocument()
  })

  it('button receives hover events and shows tooltip', () => {
    render(<IconBtn icon={Check} tooltip="Confirm action" variant="confirm" />)

    const button = screen.getByLabelText(/Confirm action/)

    // Hover to trigger tooltip
    fireEvent.mouseEnter(button)

    // Tooltip should appear
    expect(screen.getByRole('tooltip')).toHaveTextContent('Confirm action')
  })
})
