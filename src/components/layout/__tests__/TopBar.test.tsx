import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TopBar } from '../TopBar'

describe('TopBar', () => {
  const mockProps = {
    scenarioTitle: 'Pricing Decision 2025',
    onTitleChange: vi.fn(),
    onSave: vi.fn(),
    onShare: vi.fn(),
  }

  it('renders scenario title', () => {
    render(<TopBar {...mockProps} />)
    expect(screen.getByText('Pricing Decision 2025')).toBeInTheDocument()
  })

  it('allows title editing', async () => {
    render(<TopBar {...mockProps} />)

    fireEvent.click(screen.getByRole('button', { name: /edit scenario title/i }))

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: 'New Title' } })
    // Blur triggers submit
    fireEvent.blur(input)

    expect(mockProps.onTitleChange).toHaveBeenCalledWith('New Title')
  })

  it('limits title to 60 characters', async () => {
    render(<TopBar {...mockProps} />)

    fireEvent.click(screen.getByRole('button', { name: /edit scenario title/i }))

    const input = screen.getByRole('textbox') as HTMLInputElement
    const longTitle = 'A'.repeat(70)
    fireEvent.change(input, { target: { value: longTitle } })

    expect(input).toHaveValue('A'.repeat(60))
  })

  it('shows save button disabled when not dirty', () => {
    render(<TopBar {...mockProps} isDirty={false} />)

    const saveButton = screen.getByRole('button', { name: /save scenario/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when dirty', () => {
    render(<TopBar {...mockProps} isDirty />)

    const saveButton = screen.getByRole('button', { name: /save scenario/i })
    expect(saveButton).toBeEnabled()
  })

  it('shows saved confirmation after successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(<TopBar {...mockProps} isDirty onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /save scenario/i }))

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    await waitFor(
      () => {
        expect(screen.queryByText('Saved')).not.toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  it('opens menu dropdown', async () => {
    render(<TopBar {...mockProps} />)

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /export/i })).toBeInTheDocument()
  })

  it('closes menu when clicking outside', async () => {
    render(<TopBar {...mockProps} />)

    fireEvent.click(screen.getByRole('button', { name: /more options/i }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    fireEvent.mouseUp(document.body)
    fireEvent.click(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
